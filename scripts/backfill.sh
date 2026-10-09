#!/usr/bin/env bash
# scripts/backfill.sh — historical load, one calendar month per request so each
# Vercel invocation stays well inside its 300 s budget.
#
#   INGEST_ADMIN_SECRET=… ./scripts/backfill.sh google 1234567890 2025-04-01 2026-10-04
#   INGEST_ADMIN_SECRET=… ./scripts/backfill.sh microsoft 1234567 2025-04-01 2026-10-04
#   INGEST_ADMIN_SECRET=… ./scripts/backfill.sh meta act_1234567890 2025-04-01 2026-10-04
#
# BASE defaults to the production site. Snapshots (campaign/budget dimensions) are
# written only by the daily cron, not by backfill chunks (snapshots=false).
set -euo pipefail
PLATFORM=${1:?platform}; ACCOUNT=${2:?account_id}; FROM=${3:?from YYYY-MM-DD}; TO=${4:?to YYYY-MM-DD}
BASE=${BASE:-https://fattailads.com}
: "${INGEST_ADMIN_SECRET:?set INGEST_ADMIN_SECRET}"

# Date math via python3: GNU `date -d` doesn't exist on macOS.
month_end_of() { python3 -c 'import sys,datetime as d,calendar as c; t=d.date.fromisoformat(sys.argv[1]); print(t.replace(day=c.monthrange(t.year,t.month)[1]))' "$1"; }
next_day()     { python3 -c 'import sys,datetime as d; print(d.date.fromisoformat(sys.argv[1])+d.timedelta(days=1))' "$1"; }

start=$FROM
while [[ "$start" < "$TO" || "$start" == "$TO" ]]; do
  month_end=$(month_end_of "$start")
  end=$month_end; [[ "$end" > "$TO" ]] && end=$TO
  echo -n "$PLATFORM $ACCOUNT $start..$end  "
  curl -sS -X POST "$BASE/api/admin/ingest" \
    -H "Authorization: Bearer $INGEST_ADMIN_SECRET" -H 'content-type: application/json' \
    -d "{\"action\":\"run\",\"platform\":\"$PLATFORM\",\"account_id\":\"$ACCOUNT\",\"from\":\"$start\",\"to\":\"$end\",\"snapshots\":false,\"job\":\"backfill\"}" \
    | python3 -c 'import json,sys; j=json.load(sys.stdin); r=(j.get("results") or [{}])[0]; print(r.get("status"), "rows=",r.get("rows"), r.get("error") or "", "ms=",j.get("ms"))'
  start=$(next_day "$end")
done
