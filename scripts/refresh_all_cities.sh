#!/bin/bash
# One command to bring EVERY city's model outputs current: forecasts,
# attribution, enforcement worklist, advisories. Same steps as the daily CI
# job — run this the morning of a demo so no city's panel is stale, whatever
# the cron did overnight. Idempotent; safe to re-run.
set -u
cd "$(dirname "$0")/.."
export DEMO_MODE=false
CITIES=$(.venv/bin/python -c "from core.cities import list_city_ids; print(' '.join(list_city_ids()))")
for c in $CITIES; do
  echo "===== $c ====="
  .venv/bin/python -m ml.attribution.attribute --city "$c" --write 2>&1 | tail -1 || echo "WARN attribution $c"
  .venv/bin/python -m ml.forecast.train --city "$c" --write 2>&1 | grep -c "wrote" | xargs -I{} echo "  forecasts: {} horizons written" || echo "WARN forecast $c"
  .venv/bin/python -c "
from agents.enforcement import run_enforcement
print('  enforcement:', len(run_enforcement('$c', write_to_db=True)), 'recs')" 2>/dev/null || echo "WARN enforcement $c"
done
.venv/bin/python scripts/refresh_advisories.py 2>&1 | tail -1
echo "===== ALL CITIES REFRESHED ====="
