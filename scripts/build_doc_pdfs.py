"""Render the markdown docs to print-quality PDFs (A4, Chromium).

USER_GUIDE.md and DEMO_VIDEO_SCRIPT.md are the sources of record; this keeps
docs/*.pdf regenerable instead of hand-maintained. Also renders the one-page
submission document from docs/SUBMISSION.md if present.

Usage: python scripts/build_doc_pdfs.py            (needs web/node_modules playwright)
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import markdown

REPO = Path(__file__).resolve().parent.parent
DOCS = REPO / "docs"
BUILD = REPO / "web" / ".pdfbuild"   # inside web/ so `import playwright` resolves

CSS = """
:root{--navy:#1b294a;--ink:#0f172a;--slate:#3f4a5a;--muted:#6b7686;--line:#dfe4ea;--card:#f4f6f8;--green:#0b7a52;--blue:#12628f}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Ubuntu,"DejaVu Sans","Segoe UI",sans-serif;color:var(--slate);font-size:9.8pt;line-height:1.55}
h1{font-size:22pt;color:var(--navy);margin:0 0 3mm;letter-spacing:-.3pt}
h2{font-size:14pt;color:var(--navy);border-bottom:2px solid var(--green);padding-bottom:1.2mm;margin:7mm 0 3mm;page-break-after:avoid}
h3{font-size:11pt;color:var(--ink);margin:4.5mm 0 1.6mm;page-break-after:avoid}
h4{font-size:10pt;color:var(--ink);margin:3mm 0 1.2mm}
p{margin-bottom:2.6mm} ul,ol{margin:0 0 2.8mm 5mm} li{margin-bottom:1.2mm}
b,strong{color:var(--ink)} em{color:var(--ink)}
code{font-family:"Ubuntu Mono","DejaVu Sans Mono",monospace;font-size:8.7pt;background:var(--card);padding:.2mm 1.2mm;border-radius:2px;color:var(--ink)}
pre{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:2.5mm 3mm;font-size:8.4pt;overflow-x:auto;margin:2mm 0 3.5mm}
pre code{background:none;padding:0}
a{color:var(--blue);text-decoration:none;word-break:break-all}
table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:8.8pt;page-break-inside:auto}
th{background:var(--navy);color:#fff;text-align:left;padding:1.8mm 2.4mm;font-size:8.3pt}
td{padding:1.7mm 2.4mm;border-bottom:1px solid var(--line);vertical-align:top}
tr:nth-child(even) td{background:#f8fafc} tr{page-break-inside:avoid}
blockquote{border-left:3px solid var(--green);background:#ecfdf5;padding:2.5mm 3.5mm;margin:2.5mm 0 4mm;border-radius:0 6px 6px 0}
blockquote p{margin-bottom:1.5mm}
hr{border:0;border-top:1px solid var(--line);margin:5mm 0}
img{max-width:100%;border-radius:6px;border:1px solid var(--line);margin:1.5mm 0 1mm;page-break-inside:avoid}
figure{margin:2mm 0 4mm;page-break-inside:avoid} figcaption,.cap{font-size:8.3pt;color:var(--muted);margin-top:1mm}
img.half{max-width:49%}
.title{margin-bottom:6mm} .title .sub{color:var(--muted);font-size:9.5pt}
"""

DOCS_TO_BUILD = [
    ("USER_GUIDE.md", "USER_GUIDE.pdf", "VayuNetra — User Guide & Project Reference"),
    ("DEMO_VIDEO_SCRIPT.md", "DEMO_VIDEO_SCRIPT.pdf", "VayuNetra — Demo Video Script"),
    ("SUBMISSION.md", "VayuNetra_Submission.pdf", "VayuNetra · ET AI Hackathon 2026 · PS-5"),
]


def md_to_html(md_text: str, footer_label: str) -> str:
    body = markdown.markdown(md_text, extensions=["tables", "fenced_code", "sane_lists"])
    body = body.replace('src="architecture-dark.png"', f'src="file://{DOCS}/architecture-dark.png"')
    # relative image paths in the markdown (guide/*.jpg, *.svg, *.png) resolve against docs/
    import re as _re
    body = _re.sub(r'src="(?!https?://|file://|data:)([^"]+)"', lambda m: f'src="file://{DOCS}/{m.group(1)}"', body)
    # portrait screenshots (rail clips, cell story, phone) print at reduced width so they don't eat a page
    def _size(m):
        tag = m.group(0)
        if _re.search(r"guide/(1[2-9]|2[0-2]|2[4-7]|29|3[0-3]|37|38|40|41|43)-", tag):
            return tag.replace("<img ", '<img style="max-width:58%;display:block;margin:1.5mm auto" ')
        if "44-mobile" in tag:
            return tag.replace("<img ", '<img style="max-width:34%;display:block;margin:1.5mm auto" ')
        return tag
    body = _re.sub(r"<img [^>]+>", _size, body)
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{body}</body></html>"


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    jobs = []
    for src, out, label in DOCS_TO_BUILD:
        p = DOCS / src
        if not p.exists():
            print(f"skip {src} (missing)")
            continue
        html_path = BUILD / (out.replace(".pdf", ".html"))
        html_path.write_text(md_to_html(p.read_text(), label))
        jobs.append((html_path, DOCS / out, label))

    script = BUILD / "render.mjs"
    script.write_text("""
import { chromium } from "playwright";
const jobs = JSON.parse(process.argv[2]);
const b = await chromium.launch();
const p = await b.newPage();
for (const [src, out, label] of jobs) {
  await p.goto("file://" + src); await p.waitForTimeout(600);
  await p.pdf({ path: out, format: "A4", printBackground: true,
    margin: { top: "14mm", right: "14mm", bottom: "15mm", left: "14mm" },
    displayHeaderFooter: true, headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;text-align:center;font-size:7.5px;color:#9aa3ae;font-family:sans-serif;">${label} · <span class="pageNumber"></span>/<span class="totalPages"></span></div>` });
  console.log("wrote", out);
}
await b.close();
""")
    import json
    subprocess.run(["node", str(script), json.dumps([[str(a), str(b), c] for a, b, c in jobs])],
                   cwd=REPO / "web", check=True)


if __name__ == "__main__":
    main()
