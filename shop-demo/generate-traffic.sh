#!/usr/bin/env bash
#
# Continuously checks out random quantities of random SKUs against a random
# gap between requests, with an occasional longer quiet period, so Omnilog
# has an ongoing stream of traces/metrics/logs to look at instead of a single
# burst. Runs until interrupted (Ctrl+C).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

# sku, weight (out of 100) — bad-card is the error path, so it stays rare.
SKUS=(mug-01 shirt-01 bad-card)
WEIGHTS=(45 45 10)

# Seconds between requests, and the rarer/longer quiet period.
MIN_GAP=2
MAX_GAP=15
QUIET_CHANCE=8       # out of 100, checked after every request
QUIET_MIN=30
QUIET_MAX=120

random_between() {
  local min=$1 max=$2
  echo $(( min + RANDOM % (max - min + 1) ))
}

random_sku() {
  local roll=$(( RANDOM % 100 ))
  local cumulative=0
  local i
  for i in "${!SKUS[@]}"; do
    cumulative=$(( cumulative + WEIGHTS[i] ))
    if (( roll < cumulative )); then
      echo "${SKUS[i]}"
      return
    fi
  done
  echo "${SKUS[-1]}"
}

echo "Generating traffic against $BASE_URL — Ctrl+C to stop."

while true; do
  sku=$(random_sku)
  quantity=$(random_between 1 5)

  status=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/checkout" \
    -H 'content-type: application/json' \
    -d "{\"sku\":\"$sku\",\"quantity\":$quantity}")

  echo "$(date '+%H:%M:%S') checkout sku=$sku quantity=$quantity -> $status"

  if (( RANDOM % 100 < QUIET_CHANCE )); then
    quiet=$(random_between "$QUIET_MIN" "$QUIET_MAX")
    echo "$(date '+%H:%M:%S') quiet period: sleeping ${quiet}s"
    sleep "$quiet"
  else
    sleep "$(random_between "$MIN_GAP" "$MAX_GAP")"
  fi
done
