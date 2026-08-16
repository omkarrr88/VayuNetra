#!/usr/bin/env bash
# Judging-morning pre-warm + smoke check. Run ~15 min before the demo:
#
#   SUPABASE_ANON_KEY=... ./scripts/prewarm_demo.sh
#   (or just `make prewarm` — it reads .env)
#
# What it does:
#  1. Wakes Render (free tier cold-starts ~30-60s) and Supabase.
#  2. Hits every endpoint the demo touches, TWICE (second pass = warm timings).
#  3. Prints PASS/FAIL per endpoint + latency, and a final GO / NO-GO verdict.
set -u

API="${API_BASE:-https://vayunetra-c8i8.onrender.com}"
APP="${APP_BASE:-https://vayunetra-aqi.vercel.app}"

if [ -z "${SUPABASE_ANON_KEY:-}" ] && [ -f .env ]; then
  SUPABASE_ANON_KEY=$(grep -E "^SUPABASE_ANON_KEY=" .env | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
AUTH="Authorization: Bearer ${SUPABASE_ANON_KEY:-}"

ENDPOINTS=(
  "/health"
  "/cities"
  "/aqi/current?city=delhi"
  "/attribution?city=delhi"
  "/forecast?city=delhi&horizon=24"
  "/enforcement?city=delhi&limit=8"
  "/advisory?city=delhi&lang=en"
  "/comparison"
  "/coverage?city=delhi"
  "/alerts/compound?city=delhi"
  "/latency?city=delhi"
  "/traces?city=delhi&limit=1"
  "/roi?city=delhi"
  "/clean-zones?city=delhi&top=4"
  "/plume?city=delhi"
  "/static-layers?city=delhi"
)

fail=0

echo "== pass 1: wake everything (cold — timings will be slow, that's the point) =="
for e in "${ENDPOINTS[@]}"; do
  curl -s -m 90 -H "$AUTH" -o /dev/null "$API$e"
done
echo "   done — Render + Supabase are awake."

echo
echo "== pass 2: warm verification =="
for e in "${ENDPOINTS[@]}"; do
  out=$(curl -s -m 30 -H "$AUTH" -w "|%{http_code}|%{time_total}" "$API$e")
  code="${out##*|*(  )}"; code=$(echo "$out" | awk -F'|' '{print $(NF-1)}')
  t=$(echo "$out" | awk -F'|' '{print $NF}')
  body=$(echo "$out" | awk -F'|' 'NF{NF-=2};1' OFS='|')
  okflag="FAIL"
  if [ "$code" = "200" ] && echo "$body" | grep -q '"success":true'; then okflag="PASS"; fi
  [ "$okflag" = "FAIL" ] && fail=$((fail+1))
  printf "   %-4s %-40s %ss\n" "$okflag" "$e" "$t"
done

echo
echo "== inbound IVR (TwiML, no auth — what Twilio's webhook sees) =="
ivr=$(curl -s -m 30 -w "|%{http_code}" "$API/ivr/inbound")
if [[ "$ivr" == *"<Gather"* && "$ivr" == *"|200" ]]; then
  echo "   PASS /ivr/inbound (TwiML city menu)"
else
  echo "   FAIL /ivr/inbound"; fail=$((fail+1))
fi

echo
echo "== worklist + dossier + satellite patch (the demo money-shot) =="
recid=$(curl -s -m 30 -H "$AUTH" "$API/enforcement?city=delhi&limit=1" | python3 -c "import json,sys;d=json.load(sys.stdin).get('data') or [];print(d[0]['id'] if d else '')" 2>/dev/null)
if [ -n "$recid" ]; then
  d=$(curl -s -m 60 -H "$AUTH" "$API/enforcement/$recid/dossier")
  cites=$(echo "$d" | python3 -c "import json,sys;x=json.load(sys.stdin).get('data') or {};print(len(x.get('citations') or []))" 2>/dev/null || echo 0)
  patch=$(echo "$d" | python3 -c "import json,sys;x=json.load(sys.stdin).get('data') or {};print('yes' if x.get('satellite_patch') else 'no')" 2>/dev/null || echo no)
  pdf=$(curl -s -m 60 -H "$AUTH" -o /dev/null -w "%{http_code}" "$API/enforcement/$recid/notice.pdf")
  echo "   worklist rec: #$recid | citations: $cites | satellite patch: $patch | notice.pdf: HTTP $pdf"
  { [ "$cites" -gt 0 ] && [ "$patch" = "yes" ] && [ "$pdf" = "200" ]; } || fail=$((fail+1))
else
  echo "   FAIL: worklist EMPTY — run: python -c \"from agents.enforcement import run_enforcement; [run_enforcement(c, write_to_db=True) for c in __import__('core.cities', fromlist=['list_city_ids']).list_city_ids()]\""
  fail=$((fail+1))
fi

echo
echo "== frontend =="
appcode=$(curl -s -m 30 -o /dev/null -w "%{http_code}" "$APP/")
echo "   $APP -> HTTP $appcode"
[ "$appcode" = "200" ] || fail=$((fail+1))

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ GO — everything is warm and serving. Demo away."
else
  echo "❌ NO-GO — $fail check(s) failed above. Fix before judging."
  exit 1
fi
