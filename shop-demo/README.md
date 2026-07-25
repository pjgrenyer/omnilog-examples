# shop-demo

A small, realistically-instrumented Node.js shop app that emits all three
OpenTelemetry signals — traces, metrics, and logs — against a real Postgres
database, so Omnilog's Trace Viewer, Metrics Explorer, and Log Search have
non-trivial data to render: HTTP → business-logic → SQL span nesting, a
counter and a histogram, and INFO/ERROR logs correlated to each request's
trace.

It's a pure OTLP client. No Omnilog ingestion code was changed to build this —
it POSTs to the same `/v1/traces`, `/v1/metrics`, `/v1/logs` endpoints any
OTel SDK or Collector uses.

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

On first run, this creates `.env` from `.env.example` and stops — fill in
the OTLP endpoint and API key Omnilog issued you for your tenant, then
re-run `./start.sh`. It then builds and starts Postgres (seeded from
`db/init.sql` on first boot) and the app on `localhost:3000`.

```bash
curl localhost:3000/products
./checkout-mug.sh       # checkout mug-01 — 201, happy-path spans/metrics/logs
./checkout-shirt.sh     # checkout shirt-01 — 201, happy-path spans/metrics/logs
./checkout-bad-card.sh  # checkout bad-card — 402, chargeCard span ends ERROR
```

Traces, metrics, and logs export every 5s (metrics) or in near-real-time
(traces/logs) to the OTLP endpoint in `.env` — check Omnilog's Trace Viewer,
Metrics Explorer, and Log Search a few seconds after a request to see them,
filtered by `service:shop-demo`.

## Local-only debugging

To point at an OTel Collector instead of a deployed Omnilog stack, edit
`.env`'s `OTEL_EXPORTER_OTLP_ENDPOINT`/`OTEL_EXPORTER_OTLP_HEADERS` to the
Collector's `otlphttp` receiver, then run `docker compose up --build`
directly. Nothing else in the app changes, since the endpoint, headers, and
service name are all env-configured.
