"""Push the officer morning brief to each city's Telegram subscribers (daily CI step).

    python scripts/send_morning_brief.py            # every active city
    python scripts/send_morning_brief.py --city delhi --dry-run

Skips cleanly (exit 0) when TELEGRAM_BOT_TOKEN is not configured. Uses the API's own
brief builder so what subscribers receive is exactly what the console shows.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import core.env  # noqa: F401,E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", default=None)
    ap.add_argument("--dry-run", action="store_true", help="print the brief text, send nothing")
    args = ap.parse_args()

    from agents.brief import render_brief_text
    from api.main import _brief_data
    from core.cities import list_city_ids

    cities = [args.city] if args.city else list_city_ids()
    if not args.dry_run and not os.getenv("TELEGRAM_BOT_TOKEN"):
        print("TELEGRAM_BOT_TOKEN not set — nothing sent (that is fine in CI without secrets)")
        return
    from channels.telegram import broadcast_telegram_text
    from core.supa import client

    db = client()
    for cid in cities:
        try:
            text = render_brief_text(_brief_data(cid), console_url=os.getenv("PUBLIC_WEB_URL"))
        except Exception as e:  # noqa: BLE001 — one city must not stop the others
            print(f"{cid}: brief failed: {str(e)[:120]}")
            continue
        if args.dry_run:
            print(text, "\n" + "-" * 60)
            continue
        r = asyncio.run(broadcast_telegram_text(cid, text, db))
        print(f"{cid}: {r.get('status')} sent={r.get('sent', 0)}/{r.get('total', 0)}")


if __name__ == "__main__":
    main()
