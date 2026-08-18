"""Inline data, screenshots and the QR into the deck template → docs/VayuNetra_Pitch.html
(single self-contained file; works offline; open in a browser, press F).

    .venv/bin/python docs/pitch/build_pitch_data.py   # first, with the API on :8000
    .venv/bin/python docs/pitch/build_deck.py
"""
from __future__ import annotations

import base64
import io
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
TEMPLATE = HERE / "deck.html"
DATA = HERE / "pitch_data.json"
SHOTS = HERE / "shots"
OUT = ROOT / "docs" / "VayuNetra_Pitch.html"
LIVE_URL = "https://vayunetra-aqi.vercel.app"


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def qr_uri() -> str:
    import qrcode

    img = qrcode.make(LIVE_URL, box_size=8, border=1)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def main() -> None:
    html = TEMPLATE.read_text()
    data = json.loads(DATA.read_text())
    shots = {p.stem: data_uri(p, "image/jpeg") for p in sorted(SHOTS.glob("*.jpg"))}
    arch = ROOT / "docs" / "architecture-dark.png"
    if arch.exists():
        shots["arch"] = data_uri(arch, "image/png")
    for name, uri in shots.items():
        html = html.replace("{{IMG:%s}}" % name, uri)
    html = html.replace("{{QR}}", qr_uri())
    # only the shots the runtime needs (offline fallback for the live overlay)
    html = html.replace("{{SHOTS}}", json.dumps({"action": shots.get("action", "")}))
    html = html.replace("{{DATA}}", json.dumps(data, separators=(",", ":")).replace("</", "<\\/"))
    missing = [m for m in ("{{IMG:", "{{QR}}", "{{DATA}}", "{{SHOTS}}") if m in html]
    if missing:
        raise SystemExit(f"unfilled placeholders: {missing}")
    OUT.write_text(html)
    print(f"wrote {OUT} ({OUT.stat().st_size/1024/1024:.1f} MB)")


if __name__ == "__main__":
    main()
