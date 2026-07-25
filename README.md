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
./start.sh
```

Each run rebuilds `.env` from `scripts/demo-feed.env`'s tenant credentials
(translating `OMNILOG_URL`/`OMNILOG_API_KEY` into the
`OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` docker-compose
reads), then builds and starts Postgres (seeded from `db/init.sql` on first
boot) and the app on `localhost:3000`. If you don't have
`scripts/demo-feed.env` set up, see the root README's "Sending logs" section
for how to get an endpoint and API key, and write `.env` yourself from
`.env.example`.

```bash
curl localhost:3000/products
./success.sh   # checkout a normal SKU — 201, happy-path spans/metrics/logs
./error.sh     # checkout the declined-card SKU — 402, chargeCard span ends ERROR
```

Traces, metrics, and logs export every 5s (metrics) or in near-real-time
(traces/logs) to the OTLP endpoint in `.env` — check Omnilog's Trace Viewer,
Metrics Explorer, and Log Search a few seconds after a request to see them,
filtered by `service:shop-demo`.

## Local-only debugging

`start.sh` overwrites `.env` on every run, so to point at an OTel Collector
instead of a deployed Omnilog stack, don't rely on `.env` surviving a restart —
either edit `scripts/demo-feed.env`'s `OMNILOG_URL`, or skip `start.sh` and run
`docker compose up --build` directly against a hand-written `.env` with
`OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` pointed at the
Collector's `otlphttp` receiver. Nothing else in the app changes, since the
endpoint, headers, and service name are all env-configured.
