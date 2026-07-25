# omnilog-examples

Working, runnable example apps that send real OpenTelemetry data to
[omnilog](https://github.com/pjgrenyer/omnilog) — traces, metrics, and logs —
so you can see what a non-trivial integration looks like beyond a single
`curl` command.

Each example is a self-contained directory with its own README, `.env.example`,
and `start.sh`.

## Examples

- [`shop-demo/`](shop-demo/) — a small Express + Postgres shop app with
  HTTP → business-logic → SQL span nesting, an order counter, a checkout
  duration histogram, and trace-correlated INFO/ERROR logs.

## Running an example

Each example needs an OTLP endpoint and API key for your own omnilog tenant.
`cd` into the example directory and follow its README — in general:

```bash
cd shop-demo
./start.sh   # first run creates .env from .env.example and stops for you to fill in
./start.sh   # re-run once .env is filled in
```

## License

MIT — see [LICENSE](LICENSE).
