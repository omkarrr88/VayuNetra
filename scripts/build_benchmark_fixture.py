"""Mirror docs/benchmarks/*.json headline summaries into the web + demo fixtures.

    python scripts/build_benchmark_fixture.py

Run after `python -m ml.eval.benchmark ...` so the offline console shows the same measured
numbers the API serves from GET /metrics/benchmark.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from api.main import _benchmark_summary  # noqa: E402
from core.cities import list_city_ids  # noqa: E402

BENCH = Path("docs/benchmarks")
OUT = (Path("web/src/fixtures/benchmarks.json"), Path("demo/fixtures/benchmarks.json"))


def main() -> None:
    out = {}
    for city in list_city_ids():
        o = {"city_id": city, "history": None, "live": None}
        for key, name in (("history", f"{city}.json"), ("live", f"{city}_live.json")):
            p = BENCH / name
            if p.exists():
                o[key] = _benchmark_summary(json.loads(p.read_text()))
        out[city] = o
    for p in OUT:
        p.write_text(json.dumps(out, indent=1))
    print({c: (bool(v["history"]), bool(v["live"])) for c, v in out.items()})


if __name__ == "__main__":
    main()
