"""Validate a candidate palette before it reaches the tokens.

Every pair a user actually reads is checked against WCAG AA (4.5:1 body, 3:1 large text and UI
edges). Colour chosen by eye is how the app ended up with 680 contrast failures the first time; this
makes the palette a thing that either passes or does not.

    .venv/bin/python scripts/check_palette.py
"""
from __future__ import annotations


def lum(hex_colour: str) -> float:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4  # noqa: E731
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def ratio(a: str, b: str) -> float:
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


LIGHT = {
    # Ink is a warm near-black. Blue-black on blue-grey is precisely what made the old palette read
    # cold and flat.
    "ink": "#101116", "ink-2": "#3a3d47", "muted": "#585c68", "faint": "#5f636f",
    # Near-white canvas with pure-white cards, separated by a visible border rather than by a big
    # background-contrast step. This is what modern data products do (Linear, Stripe, Vercel) and it
    # is what makes a light UI feel like paper instead of like a dialog box.
    "surface": "#ffffff", "surface-2": "#f6f6fb", "surface-3": "#ececf4", "canvas": "#f0f0f6",
    # Two different jobs, so two different weights: `line` is a soft card edge (decorative, and a
    # heavy one is what makes a light UI look like a dialog box), `line-strong` is a real form-control
    # boundary and must clear the 3:1 that WCAG 1.4.11 requires for UI components.
    "line": "#e4e4ee", "line-strong": "#88889a",
    # A deep indigo rather than a mid blue: richer, more confident, and further from the AQI band
    # hues so it never competes with the data.
    "primary": "#4f46e5", "primary-soft": "#eeedfd", "primary-ink": "#ffffff",
    "accent": "#0b6f66", "accent-soft": "#d9f2ee", "accent-ink": "#ffffff",
    "warn": "#9a4507", "warn-soft": "#fdf0da", "warn-ink": "#ffffff",
    "danger": "#be123c", "danger-soft": "#ffe6ea", "danger-ink": "#ffffff",
    "nav": "#15161d", "nav-ink": "#a9afbc", "nav-ink-strong": "#ffffff",
}

DARK = {
    "ink": "#eef3fb", "ink-2": "#cbd5e1", "muted": "#a3b2c8", "faint": "#8d9db6",
    # navy kept, but the ladder widened: canvas < recessed < card < raised, each clearly apart
    "canvas": "#070d18", "surface-2": "#0e1729", "surface": "#131d33", "surface-3": "#1b2740",
    "line": "#24324f", "line-strong": "#6b7b96",
    "primary": "#818cf8", "primary-soft": "#1c2450", "primary-ink": "#0a0f24",
    "accent": "#2dd4bf", "accent-soft": "#0f302c", "accent-ink": "#04211d",
    "warn": "#fbbf24", "warn-soft": "#33280c", "warn-ink": "#241a02",
    "danger": "#fb7185", "danger-soft": "#3a1420", "danger-ink": "#2b0710",
    "nav": "#05090f", "nav-ink": "#94a3b8", "nav-ink-strong": "#ffffff",
}

# (foreground, background, minimum) — everything a user reads or relies on to see an edge
PAIRS = [
    ("ink", "surface", 4.5), ("ink", "surface-2", 4.5), ("ink", "canvas", 4.5), ("ink", "surface-3", 4.5),
    ("ink-2", "surface", 4.5), ("ink-2", "surface-2", 4.5), ("ink-2", "canvas", 4.5),
    ("muted", "surface", 4.5), ("muted", "surface-2", 4.5), ("muted", "canvas", 4.5), ("muted", "surface-3", 4.5),
    ("faint", "surface", 4.5), ("faint", "surface-2", 4.5), ("faint", "canvas", 4.5),
    ("primary", "surface", 4.5), ("primary", "surface-2", 4.5), ("primary", "primary-soft", 4.5),
    ("primary-ink", "primary", 4.5),
    ("accent", "surface", 4.5), ("accent", "accent-soft", 4.5), ("accent-ink", "accent", 4.5),
    ("warn", "surface", 4.5), ("warn", "warn-soft", 4.5), ("warn-ink", "warn", 4.5),
    ("danger", "surface", 4.5), ("danger", "danger-soft", 4.5), ("danger-ink", "danger", 4.5),
    ("nav-ink", "nav", 4.5), ("nav-ink-strong", "nav", 4.5),
    # edges only need 3:1
    ("line-strong", "surface", 3.0), ("line-strong", "canvas", 3.0),
]

# The ladder, expressed as what each step is FOR rather than as a single chain:
#   a card must lift off the page, a recessed area inside a card must read as recessed, and a
#   raised chip or hover state must read as raised. "Flat" is what happens when these collapse.
LADDER = [
    ("canvas", "surface", 1.06, "a card must lift off the page"),
    ("surface", "surface-2", 1.03, "a recessed area inside a card must read"),
    ("surface", "surface-3", 1.07, "a raised chip / hover state must read"),
]


def report(name: str, p: dict[str, str]) -> int:
    print(f"\n=== {name} ===")
    bad = 0
    for fg, bg, need in PAIRS:
        got = ratio(p[fg], p[bg])
        ok = got >= need
        bad += 0 if ok else 1
        if not ok:
            print(f"  FAIL {fg:16s} on {bg:14s} {got:5.2f}:1  (needs {need})")
    print(f"  {len(PAIRS) - bad}/{len(PAIRS)} pairs pass AA")
    print("  surface ladder:")
    for a, b, need, why in LADDER:
        r = ratio(p[a], p[b])
        ok = r >= need
        bad += 0 if ok else 1
        print(f"    {a:9s} -> {b:10s} {r:4.2f} (>= {need})  {why}{'' if ok else '   <-- TOO CLOSE'}")
    return bad


if __name__ == "__main__":
    total = report("LIGHT", LIGHT) + report("DARK", DARK)
    print(f"\n{'PALETTE OK' if total == 0 else f'{total} FAILING PAIRS'}")
    raise SystemExit(1 if total else 0)
