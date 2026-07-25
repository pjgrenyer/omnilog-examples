#!/usr/bin/env bash
#
# Build .env from scripts/demo-feed.env's credentials and start the stack.
# demo-feed.env uses OMNILOG_URL/OMNILOG_API_KEY; docker-compose.yml reads
# OTEL_EXPORTER_OTLP_ENDPOINT/OTEL_EXPORTER_OTLP_HEADERS, so translate rather
# than copy directly.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

source ../../scripts/demo-feed.env
cat > .env <<EOF
OTEL_EXPORTER_OTLP_ENDPOINT=$OMNILOG_URL
OTEL_EXPORTER_OTLP_HEADERS=x-api-key=$OMNILOG_API_KEY
EOF

docker compose up --build
