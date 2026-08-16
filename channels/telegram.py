"""Telegram channel adapter for Agent 4 advisories."""
from __future__ import annotations

import argparse
import asyncio
import os
from typing import Any

import core.env  # noqa: F401  (loads .env)


def format_telegram_message(advisory: dict) -> str:
    return (
        f"VayuNetra alert for {advisory['ward_id']}\n"
        f"Risk: {advisory['risk_tier'].replace('_', ' ')} (+{advisory['horizon_h']}h)\n"
        f"{advisory['message']}"
    )


async def send_telegram_advisory(advisory: dict, chat_id: str | None = None) -> dict:
    """Send one advisory through a real Telegram bot.

    Requires TELEGRAM_BOT_TOKEN and either TELEGRAM_CHAT_ID or --chat-id. The token is
    never logged. This function is intentionally thin so tests and DEMO_MODE can keep
    using format_telegram_message without live network calls.
    """
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is missing")
    if not chat_id:
        raise RuntimeError("TELEGRAM_CHAT_ID is missing; message the bot once, then set the chat id")

    msg = await send_telegram_message(chat_id, format_telegram_message(advisory))
    return {"chat_id": str(chat_id), "message_id": msg.message_id}


async def send_telegram_message(chat_id: str, text: str, reply_markup: Any | None = None):
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is missing")
    from telegram import Bot

    bot = Bot(token=token)
    return await bot.send_message(chat_id=chat_id, text=text, reply_markup=reply_markup)


def _city_keyboard():
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup

    from core.cities import list_cities

    buttons = [
        InlineKeyboardButton(c["name"], callback_data=f"subscribe:{c['city_id']}")
        for c in list_cities()
    ]
    # rows of three keep the keyboard thumb-sized however many cities exist
    rows = [buttons[i : i + 3] for i in range(0, len(buttons), 3)]
    return InlineKeyboardMarkup(rows)


def _upsert_subscriber(db: Any, chat_id: str, city_id: str, language: str = "en") -> None:
    db.table("advisory_subscribers").upsert({
        "chat_id": str(chat_id),
        "city_id": city_id,
        "language": language,
        "active": True,
    }, on_conflict="chat_id").execute()


def subscriber_chat_ids(db: Any, city_id: str) -> list[str]:
    rows = (
        db.table("advisory_subscribers")
        .select("chat_id")
        .eq("city_id", city_id)
        .eq("active", True)
        .limit(1000)
        .execute()
        .data
    )
    return [str(r["chat_id"]) for r in rows if r.get("chat_id")]


async def broadcast_telegram_advisory(advisory: dict, db: Any | None = None) -> dict:
    """Send to subscribed chats, plus TELEGRAM_CHAT_ID as legacy fallback."""
    city_id = advisory.get("city_id") or "delhi"
    chat_ids: list[str] = []
    if db is not None:
        try:
            chat_ids.extend(subscriber_chat_ids(db, city_id))
        except Exception:
            chat_ids = []
    fallback = os.getenv("TELEGRAM_CHAT_ID")
    if fallback and fallback not in chat_ids:
        chat_ids.append(fallback)
    if not chat_ids:
        return {"status": "skipped", "detail": "no Telegram subscribers or TELEGRAM_CHAT_ID configured", "sent": 0}

    sent = 0
    errors = []
    for chat_id in chat_ids:
        try:
            await send_telegram_advisory(advisory, chat_id=chat_id)
            sent += 1
        except Exception as exc:  # noqa: BLE001
            errors.append({"chat_id": chat_id, "detail": str(exc)[:160]})
    return {
        "status": "sent" if sent else "error",
        "sent": sent,
        "total": len(chat_ids),
        "errors": errors[:3],
    }


async def handle_subscription_update(update: dict, db: Any) -> dict:
    """Handle Telegram /start and inline city-pick callbacks."""
    message = update.get("message") or {}
    callback = update.get("callback_query") or {}
    chat = message.get("chat") or (callback.get("message") or {}).get("chat") or {}
    chat_id = chat.get("id")
    if not chat_id:
        return {"status": "ignored", "detail": "missing chat id"}

    text = (message.get("text") or "").strip().lower()
    data = (callback.get("data") or "").strip().lower()

    if text.startswith("/start"):
        await send_telegram_message(
            str(chat_id),
            "Welcome to VayuNetra alerts. Pick your city to subscribe:",
            reply_markup=_city_keyboard(),
        )
        return {"status": "city_prompted", "chat_id": str(chat_id)}

    from core.cities import list_city_ids

    city = None
    if data.startswith("subscribe:"):
        city = data.split(":", 1)[1]
    elif text in set(list_city_ids()):
        city = text

    if city:
        _upsert_subscriber(db, str(chat_id), city)
        await send_telegram_message(str(chat_id), f"Subscribed to VayuNetra {city.title()} advisories.")
        return {"status": "subscribed", "chat_id": str(chat_id), "city_id": city}

    await send_telegram_message(str(chat_id), "Send /start and pick your city to receive alerts.")
    return {"status": "help_sent", "chat_id": str(chat_id)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chat-id", help="Telegram chat id; defaults to TELEGRAM_CHAT_ID")
    ap.add_argument("--message", default="VayuNetra Telegram delivery smoke test")
    args = ap.parse_args()

    advisory = {
        "ward_id": "smoke-test",
        "risk_tier": "moderate",
        "horizon_h": 24,
        "message": args.message,
    }
    result = asyncio.run(send_telegram_advisory(advisory, args.chat_id))
    print(f"sent Telegram advisory message_id={result['message_id']}")


if __name__ == "__main__":
    main()
