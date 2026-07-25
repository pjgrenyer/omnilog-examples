# shop-demo

A small, realistically-instrumented Node.js shop app that emits all three
OpenTelemetry signals — traces, metrics, and logs — against a real Postgres
database, so Omnilog's Trace Viewer, Metrics Explorer, and Log Search have
non-trivial data to render: HTTP → business-logic → SQL span nesting, a
counter and a histogram, and INFO/ERROR logs correlated to each request's
trace.

It's a pure OTLP client. No Omnilog ingestion code was changed to build this —
it POSTs to the same `/v1/traces`, `/v1/metrics`, `/v1/logs` endpoints any
OTel SDK or Collector uses, documented in the root README's "Sending logs"
section.

## Endpoints

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/products` | Lists the three seeded products |
| `POST` | `/orders` | Creates an order for a `sku`/`quantity`, no checkout spans |
| `POST` | `/checkout` | Full flow: `validateCart` → `priceCart` → `chargeCard` → `createOrder`, each a child span; records `orders.created` and `checkout.duration_ms`; logs INFO/ERROR |

`POST /checkout` and `POST /orders` both take a JSON body: `{"sku": "mug-01", "quantity": 2}`.

Seeded SKUs: `mug-01`, `shirt-01`, and `bad-card` — `bad-card` is flagged
`declined` in the seed data, so checking it out always fails with `402` and
its `chargeCard` span ends in `ERROR`. Use it to generate the error path
alongside the happy path.

## Running it

```bash
cp .env.example .env
```

Fill in `.env` with a real ingest endpoint and API key — see the root
README's "Sending logs" section for how to get both
(`terraform -chdir=infra output -raw api_gateway_id` for the endpoint, a key
from `infra/seed-tenant.sh` for the header). Then:

```bash
docker compose up --build
```

This starts Postgres (seeded from `db/init.sql` on first boot) and the app on
`localhost:3000`.

```bash
curl localhost:3000/products
curl -X POST localhost:3000/checkout -H 'content-type: application/json' -d '{"sku":"mug-01","quantity":2}'
curl -X POST localhost:3000/checkout -H 'content-type: application/json' -d '{"sku":"bad-card","quantity":1}'
```

Traces, metrics, and logs export every 5s (metrics) or in near-real-time
(traces/logs) to the OTLP endpoint in `.env` — check Omnilog's Trace Viewer,
Metrics Explorer, and Log Search a few seconds after a request to see them,
filtered by `service:shop-demo`.

## Local-only debugging

To point at an OTel Collector instead of a deployed Omnilog stack, swap
`OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` in `.env` for the
Collector's `otlphttp` receiver address — nothing else in the app changes,
since the endpoint, headers, and service name are all env-configured.
