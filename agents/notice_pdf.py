"""Professional, dependency-free PDF generator for enforcement notices.

Renders the draft enforcement notice into a styled A4 document using only the
Python standard library (no reportlab/fpdf) — so it runs on the Render backend
with zero extra packages. Features:

- Branded header band + accent rule
- Metadata panel (reference / date / authority)
- Bold section headings with accent underlines
- Bullet lists
- A light "DRAFT" watermark (it is an officer-review draft)
- Footer with disclaimer + page number
- Exact line wrapping using Adobe Helvetica font metrics
- Multi-page flow with automatic page breaks
"""
from __future__ import annotations

import base64
import re
import struct

# --- Adobe AFM advance widths (per 1000 em) for printable ASCII 32..126 -------
_HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
         556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
         1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
         667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
         333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
         556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
_HELVB = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
          556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
          975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
          667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
          333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
          611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]

# Unicode punctuation -> latin-1/ASCII (the standard-14 fonts can't render — ' " etc.)
_TRANS = {
    "—": "-", "–": "-", "‒": "-", "−": "-",
    "‘": "'", "’": "'", "“": '"', "”": '"',
    "•": "-", "·": "-", "…": "...", " ": " ", "₹": "Rs ", "→": "->", "≥": ">=", "≤": "<=",
}

# Palette
NAVY = (0.106, 0.161, 0.290)
ACCENT = (0.16, 0.45, 0.75)
WHITE = (1, 1, 1)
DARK = (0.13, 0.13, 0.16)
GRAY = (0.42, 0.42, 0.46)
LIGHT = (0.955, 0.965, 0.980)
RULE = (0.80, 0.82, 0.86)
BORDER = (0.85, 0.87, 0.90)


def _ascii(s: str) -> str:
    for k, v in _TRANS.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


def _char_w(ch: str, bold: bool) -> int:
    o = ord(ch)
    return (_HELVB if bold else _HELV)[o - 32] if 32 <= o <= 126 else 556


def _text_w(s: str, size: float, bold: bool = False) -> float:
    return sum(_char_w(c, bold) for c in s) * size / 1000.0


def _wrap(text: str, size: float, max_w: float, bold: bool = False) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    lines, cur = [], words[0]
    for w in words[1:]:
        if _text_w(cur + " " + w, size, bold) <= max_w:
            cur += " " + w
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def _pdf_esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _jpeg_from_data_uri(uri: str | None) -> tuple[bytes, int, int, int] | None:
    """Decode a base64 JPEG data URI → (bytes, width, height, n_components).

    Dimensions come from the SOF0/1/2 marker so the image can be scaled with
    the right aspect ratio. Returns None for anything that isn't a sane JPEG.
    """
    if not uri or "base64," not in uri:
        return None
    try:
        raw = base64.b64decode(uri.split("base64,", 1)[1], validate=False)
    except Exception:  # noqa: BLE001 — a broken URI just means "no image"
        return None
    if len(raw) < 4 or raw[:2] != b"\xff\xd8":
        return None
    i = 2
    while i + 9 < len(raw):
        if raw[i] != 0xFF:
            i += 1
            continue
        marker = raw[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):  # baseline / extended / progressive SOF
            h, w = struct.unpack(">HH", raw[i + 5 : i + 9])
            ncomp = raw[i + 9]
            if w > 0 and h > 0:
                return raw, w, h, ncomp
            return None
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        (seglen,) = struct.unpack(">H", raw[i + 2 : i + 4])
        i += 2 + seglen
    return None


def _parse(text: str):
    """Split notice text into (title, [(label,value)] meta, [(heading,[body])] blocks)."""
    lines = text.split("\n")
    i, n = 0, len(lines)
    while i < n and not lines[i].strip():
        i += 1
    title = lines[i].strip() if i < n else "ENFORCEMENT NOTICE"
    i += 1
    meta = []
    while i < n and lines[i].strip():
        m = re.match(r"^([A-Za-z][A-Za-z ]+):\s*(.*)$", lines[i])
        if m:
            meta.append((m.group(1), m.group(2)))
        i += 1
    blocks, head, body = [], None, []
    def flush():
        nonlocal head, body
        if head is not None or body:
            blocks.append((head, body))
        head, body = None, []
    while i < n:
        s = lines[i].strip()
        i += 1
        if not s:
            if body and body[-1] != "":
                body.append("")
            continue
        if len(s) <= 40 and re.match(r"^[A-Z0-9][A-Z0-9 /&().,-]*:$", s):
            flush()
            head = s[:-1]
        else:
            body.append(s)
    flush()
    return title, meta, blocks


class _Doc:
    W, H, M = 595, 842, 50

    def __init__(self, watermark: str | None = "DRAFT"):
        self.pages, self.ops, self.y, self.pageno = [], [], self.H - self.M, 0
        self.watermark = watermark

    @property
    def cw(self) -> float:
        return self.W - 2 * self.M

    def _watermark(self):
        if not self.watermark:
            return
        self.ops.append("BT /F2 92 Tf 0.930 0.930 0.945 rg "
                        f"0.7071 0.7071 -0.7071 0.7071 150 300 Tm ({_pdf_esc(self.watermark)}) Tj ET")

    def start_page(self):
        self.pageno += 1
        self.ops = []
        self._watermark()
        self.y = self.H - self.M

    def rect(self, x, y, w, h, c):
        self.ops.append(f"{c[0]:.3f} {c[1]:.3f} {c[2]:.3f} rg {x:.2f} {y:.2f} {w:.2f} {h:.2f} re f")

    def box(self, x, y, w, h, c, lw=0.8):
        self.ops.append(f"{lw} w {c[0]:.3f} {c[1]:.3f} {c[2]:.3f} RG {x:.2f} {y:.2f} {w:.2f} {h:.2f} re S")

    def line(self, x1, x2, y, c, lw=1.0):
        self.ops.append(f"{lw} w {c[0]:.3f} {c[1]:.3f} {c[2]:.3f} RG {x1:.2f} {y:.2f} m {x2:.2f} {y:.2f} l S")

    def text(self, x, y, s, size, bold=False, color=DARK):
        f = "F2" if bold else "F1"
        self.ops.append(f"BT /{f} {size} Tf {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg "
                        f"1 0 0 1 {x:.2f} {y:.2f} Tm ({_pdf_esc(s)}) Tj ET")

    def ensure(self, h):
        if self.y - h < self.M + 46:
            self._footer()
            self.pages.append("\n".join(self.ops))
            self.start_page()

    def para(self, s, size=10.5, color=DARK, indent=0.0):
        lead = size * 1.4
        for ln in _wrap(s, size, self.cw - indent, False):
            self.ensure(lead)
            self.text(self.M + indent, self.y, ln, size, False, color)
            self.y -= lead

    def bullet(self, s, size=10.5):
        lead = size * 1.4
        lines = _wrap(s, size, self.cw - 16, False)
        self.ensure(lead)
        self.rect(self.M + 3, self.y + 2.6, 2.6, 2.6, ACCENT)
        self.text(self.M + 14, self.y, lines[0], size, False, DARK)
        self.y -= lead
        for ln in lines[1:]:
            self.ensure(lead)
            self.text(self.M + 14, self.y, ln, size, False, DARK)
            self.y -= lead

    def _footer(self):
        y = self.M - 4
        self.line(self.M, self.W - self.M, y + 14, RULE, 0.6)
        self.text(self.M, y, "VayuNetra AI  -  system-generated draft. Verify and authorise before official issuance.",
                  7.5, False, GRAY)
        pt = f"Page {self.pageno}"
        self.text(self.W - self.M - _text_w(pt, 7.5), y, pt, 7.5, False, GRAY)

    def finish(self):
        self._footer()
        self.pages.append("\n".join(self.ops))


BAR_BASE = (0.83, 0.20, 0.20)     # forecast, no action
BAR_COMP = (0.05, 0.55, 0.38)     # with compliance
AXIS = (0.62, 0.65, 0.70)


def _draw_impact_chart(d: "_Doc", chart: dict) -> None:
    """Grouped bars per horizon: cell forecast vs modeled-compliance forecast."""
    horizons = chart.get("horizons") or []
    if not horizons:
        return
    ch_h, legend_h = 92.0, 16.0
    d.ensure(ch_h + legend_h + 26)
    top = d.y
    base_y = top - ch_h
    max_v = max(max(h["base"], h["with_compliance"]) for h in horizons) or 1.0

    # y gridlines at 0 / half / max, with labels
    for frac in (0.0, 0.5, 1.0):
        gy = base_y + ch_h * 0.82 * frac
        d.line(d.M + 30, d.W - d.M, gy, RULE, 0.5)
        label = f"{round(max_v * frac)}"
        d.text(d.M + 26 - _text_w(label, 7), gy - 2.4, label, 7, False, GRAY)
    d.text(d.M + 26 - _text_w("ug/m3", 6.5), base_y + ch_h * 0.82 + 10, "ug/m3", 6.5, False, GRAY)

    group_w = (d.cw - 60) / len(horizons)
    bar_w = min(34.0, group_w / 3)
    for i, h in enumerate(horizons):
        gx = d.M + 40 + i * group_w + (group_w - 2 * bar_w - 6) / 2
        for k, (val, color) in enumerate(((h["base"], BAR_BASE), (h["with_compliance"], BAR_COMP))):
            bh = ch_h * 0.82 * (float(val) / max_v)
            bx = gx + k * (bar_w + 6)
            d.rect(bx, base_y, bar_w, bh, color)
            lbl = f"{round(float(val))}"
            d.text(bx + (bar_w - _text_w(lbl, 7.5, True)) / 2, base_y + bh + 3, lbl, 7.5, True, DARK)
        xl = f"+{h['h']}h"
        d.text(d.M + 40 + i * group_w + (group_w - _text_w(xl, 8)) / 2 - 3, base_y - 11, xl, 8, False, GRAY)

    # baseline + legend
    d.line(d.M + 30, d.W - d.M, base_y, AXIS, 0.8)
    ly = base_y - 26
    d.rect(d.M + 40, ly, 7, 7, BAR_BASE)
    d.text(d.M + 51, ly, "forecast, no action", 8, False, DARK)
    lx2 = d.M + 51 + _text_w("forecast, no action", 8) + 18
    d.rect(lx2, ly, 7, 7, BAR_COMP)
    d.text(lx2 + 11, ly, "with source compliance (modeled)", 8, False, DARK)
    d.y = ly - 14


def notice_pdf_bytes(
    text: str,
    image_data_uri: str | None = None,
    impact_chart: dict | None = None,
    *,
    subtitle: str = "Urban Air Quality Intelligence - Enforcement Cell",
    tag: str = "DRAFT FOR OFFICER REVIEW",
    watermark: str | None = "DRAFT",
) -> bytes:
    """Render an enforcement-notice PDF (bytes) from plain/structured notice text.

    `image_data_uri` (base64 JPEG) is embedded where the notice text carries the
    `[[SATELLITE_IMAGE]]` marker — the actual satellite patch, in the document,
    like a real evidence annexure. `impact_chart` (the dossier's
    impact_projection dict) is drawn as a grouped bar chart at the
    `[[IMPACT_CHART]]` marker: forecast without action vs with compliance.
    """
    title, meta, blocks = _parse(_ascii(text))
    img = _jpeg_from_data_uri(image_data_uri)
    d = _Doc(watermark=watermark)
    d.start_page()

    # Header band + accent stripe
    d.rect(0, d.H - 76, d.W, 76, NAVY)
    d.rect(0, d.H - 80, d.W, 4, ACCENT)
    d.text(d.M, d.H - 40, "VAYUNETRA", 22, True, WHITE)
    d.text(d.M, d.H - 58, _ascii(subtitle), 9.5, False, (0.80, 0.85, 0.92))
    tag = _ascii(tag)
    d.text(d.W - d.M - _text_w(tag, 9, True), d.H - 40, tag, 9, True, (0.80, 0.85, 0.92))

    # Title
    d.y = d.H - 76 - 34
    d.text((d.W - _text_w(title, 17, True)) / 2, d.y, title, 17, True, NAVY)
    d.y -= 12
    d.line(d.M, d.W - d.M, d.y, RULE, 0.8)
    d.y -= 22

    # Metadata panel
    if meta:
        boxh = len(meta) * 18 + 14
        top = d.y
        d.rect(d.M, top - boxh, d.cw, boxh, LIGHT)
        d.box(d.M, top - boxh, d.cw, boxh, BORDER)
        ry = top - 17
        for label, val in meta:
            d.text(d.M + 14, ry, label.upper(), 8.5, True, ACCENT)
            d.text(d.M + 150, ry, val, 10, False, DARK)
            ry -= 18
        d.y = top - boxh - 24

    # Sections
    for head, body in blocks:
        if head:
            d.ensure(64)  # never orphan a heading at the page foot
            d.text(d.M, d.y, head.upper(), 11, True, NAVY)
            d.line(d.M, d.M + min(_text_w(head.upper(), 11, True), 130), d.y - 4, ACCENT, 1.4)
            d.y -= 19
        for ln in body:
            if ln == "":
                d.y -= 5
            elif ln == "[[IMPACT_CHART]]":
                if impact_chart and impact_chart.get("horizons"):
                    _draw_impact_chart(d, impact_chart)
            elif ln == "[[SATELLITE_IMAGE]]":
                if img:
                    _raw, iw, ih, _nc = img
                    w = min(250.0, d.cw * 0.55)
                    h = w * ih / iw
                    d.ensure(h + 14)
                    d.y -= 4
                    d.box(d.M - 1, d.y - h - 1, w + 2, h + 2, BORDER, 0.8)
                    d.ops.append(f"q {w:.2f} 0 0 {h:.2f} {d.M:.2f} {d.y - h:.2f} cm /Im1 Do Q")
                    d.y -= h + 10
            elif ln.startswith("- "):
                d.bullet(ln[2:])
            elif ln.lower().startswith("this is a system-generated"):
                d.y -= 4
                d.para(ln, 9, GRAY)
            else:
                d.para(ln)
        d.y -= 9

    d.finish()
    return _assemble(d.pages, img)


def _assemble(pages: list[str], img: tuple[bytes, int, int, int] | None = None) -> bytes:
    objs: dict[int, bytes] = {}
    objs[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
    kids = " ".join(f"{5 + 2 * k} 0 R" for k in range(len(pages)))
    objs[2] = f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode()
    objs[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    objs[4] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    img_no = 5 + 2 * len(pages)
    xobj = f" /XObject << /Im1 {img_no} 0 R >>" if img else ""
    for k, content in enumerate(pages):
        page_no, c_no = 5 + 2 * k, 6 + 2 * k
        objs[page_no] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >>{xobj} >> /Contents {c_no} 0 R >>"
        ).encode()
        body = content.encode("latin-1", "replace")
        objs[c_no] = b"<< /Length " + str(len(body)).encode() + b" >>\nstream\n" + body + b"\nendstream"
    if img:
        raw, iw, ih, ncomp = img
        cs = b"/DeviceGray" if ncomp == 1 else b"/DeviceRGB"
        objs[img_no] = (
            b"<< /Type /XObject /Subtype /Image /Width " + str(iw).encode()
            + b" /Height " + str(ih).encode()
            + b" /ColorSpace " + cs
            + b" /BitsPerComponent 8 /Filter /DCTDecode /Length " + str(len(raw)).encode()
            + b" >>\nstream\n" + raw + b"\nendstream"
        )

    out = b"%PDF-1.4\n"
    offsets: dict[int, int] = {}
    for num in sorted(objs):
        offsets[num] = len(out)
        out += f"{num} 0 obj\n".encode() + objs[num] + b"\nendobj\n"
    xref_pos = len(out)
    size = max(objs) + 1
    out += b"xref\n0 " + str(size).encode() + b"\n0000000000 65535 f \n"
    for num in range(1, size):
        out += ("%010d 00000 n \n" % offsets[num]).encode()
    out += (b"trailer\n<< /Size " + str(size).encode() + b" /Root 1 0 R >>\n"
            b"startxref\n" + str(xref_pos).encode() + b"\n%%EOF")
    return out
