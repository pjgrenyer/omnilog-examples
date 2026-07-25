#!/usr/bin/env bash
#
# First run: create .env from .env.example and stop so you can fill in your
# own OTLP endpoint/API key. Once .env exists, build and start the stack.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — fill in your OTLP endpoint and API key, then re-run ./start.sh"
  exit 1
fi

# .env must define OTEL_EXPORTER_OTLP_ENDPOINT/OTEL_EXPORTER_OTLP_HEADERS — those
# are the only variable names docker-compose.yml and instrumentation.mjs read.
# If they're missing (e.g. renamed to something else) docker compose silently
# substitutes empty strings and every OTLP exporter falls back to
# http://localhost:4318, so nothing reaches Omnilog and it fails silently.
set -a
source .env
set +a

if [ -z "${OTEL_EXPORTER_OTLP_ENDPOINT:-}" ] || [ -z "${OTEL_EXPORTER_OTLP_HEADERS:-}" ]; then
  echo "Error: .env must set OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS" >&2
  echo "(see .env.example for the expected format)" >&2
  exit 1
fi

if [[ "$OTEL_EXPORTER_OTLP_ENDPOINT" == *"<api-id>"* ]] || [[ "$OTEL_EXPORTER_OTLP_HEADERS" == *"<your-api-key>"* ]]; then
  echo "Error: .env still has placeholder values from .env.example — fill in your real OTLP endpoint and API key" >&2
  exit 1
fi

docker compose up --build
