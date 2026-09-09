# omnilog-examples

Working, runnable example apps that send real OpenTelemetry data to
[omnilog](https://github.com/pjgrenyer/omnilog) — traces, metrics, and logs —
so you can see what a non-trivial integration looks like beyond a single
`curl` command.

Each example is a self-contained directory with its own README and
`.env.example`. Most run entirely locally (`start.sh`, docker-compose); one
(`nightly-docgen`) deploys its own AWS infrastructure and runs there instead
— see its README for the different (Terraform + `deploy.sh`) flow.

## Examples

- [`shop-demo/`](shop-demo/) — a small Express + Postgres shop app with
  HTTP → business-logic → SQL span nesting, an order counter, a checkout
  duration histogram, and trace-correlated INFO/ERROR logs. Runs locally.
- [`nightly-docgen/`](nightly-docgen/) — a scheduled AWS Lambda simulating
  an overnight batch job generating a few thousand documents, with
  per-document trace/log/metric correlation, a random injected failure
  rate, and a target-vs-actual metric pair meant for dashboard widgets.
  Deploys its own AWS infrastructure (Terraform).

## Running an example

Each example needs an OTLP endpoint and API key for your own omnilog tenant.
`cd` into the example directory and follow its README. For a local example:

```bash
cd shop-demo
./start.sh   # first run creates .env from .env.example and stops for you to fill in
./start.sh   # re-run once .env is filled in
```

For `nightly-docgen`, which deploys to AWS rather than running locally, see
its own README for the Terraform + `deploy.sh` flow.

## License

MIT — see [LICENSE](LICENSE).
