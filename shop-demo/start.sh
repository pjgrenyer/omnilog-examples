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

docker compose up --build
