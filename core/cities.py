"""Central city registry — the single source of truth for "which cities exist".

Every layer that needs the city list (IVR menu, Telegram keyboard, batch
scripts, cron loops) reads from here instead of hardcoding names, so adding a
city really is just dropping a YAML into core/config/cities/.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml

CITIES_DIR = Path(__file__).resolve().parent / "config" / "cities"

# The three launch cities (Delhi, Bengaluru, Mumbai) keep their positions in
# every channel (IVR digits 1-3, Telegram keyboard) so existing subscribers'
# muscle memory survives; the seven added in Aug 2026 (and any future city)
# append in alphabetical order.
LAUNCH_ORDER = ["delhi", "bengaluru", "mumbai"]


@lru_cache(maxsize=1)
def _all_configs() -> tuple[dict, ...]:
    configs = []
    for path in sorted(CITIES_DIR.glob("*.yml")):
        try:
            cfg = yaml.safe_load(path.read_text()) or {}
        except yaml.YAMLError:
            continue
        if cfg.get("city_id"):
            configs.append(cfg)
    return tuple(configs)


def load_city(city_id: str) -> dict:
    """One city's config, or KeyError if it doesn't exist."""
    for cfg in _all_configs():
        if cfg["city_id"] == city_id:
            return dict(cfg)
    raise KeyError(f"unknown city_id: {city_id}")


def list_cities(active_only: bool = True) -> list[dict]:
    """All city configs, launch cities first, then alphabetical by city_id."""
    cfgs = [dict(c) for c in _all_configs() if not active_only or c.get("active", True)]
    order = {cid: i for i, cid in enumerate(LAUNCH_ORDER)}
    return sorted(cfgs, key=lambda c: (order.get(c["city_id"], len(order)), c["city_id"]))


def list_city_ids(active_only: bool = True) -> list[str]:
    return [c["city_id"] for c in list_cities(active_only)]
