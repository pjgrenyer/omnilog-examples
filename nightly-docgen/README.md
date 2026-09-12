# nightly-docgen

A scheduled AWS Lambda that simulates an overnight batch job generating a
few thousand documents, emitting correlated OpenTelemetry traces, metrics,
and logs to Omnilog — HTTP → business-logic → SQL span nesting was
shop-demo's shape; this one's is a document generation loop with no
incoming request to hang a span on, EventBridge-scheduled rather than
request-driven, and the first example that deploys its own AWS
infrastructure rather than only talking to a deployed Omnilog tenant.

It's a pure OTLP client, same as shop-demo. No Omnilog ingestion code was
changed to build this.

## How it works

One EventBridge rule fires the Lambda every `TICK_MINUTES` (default 5),
**all day, every day**. The handler itself checks the current UTC hour
against `WINDOW_START_HOUR`/`WINDOW_END_HOUR` and no-ops outside that
window — the schedule doesn't encode the window; the handler does. This is
deliberately stateless: each in-window tick computes
`docs_per_tick = ceil(TOTAL_DOCS / (window_minutes / TICK_MINUTES))` from
env vars alone, no DynamoDB job-state table, no cross-invocation
coordination.

At the beginning of each in-window tick, the Lambda lists the `documents/`
prefix and deletes objects belonging to earlier run IDs. The current run's
prefix is preserved, so the first tick clears the previous night's documents
and later ticks can safely repeat the cleanup without deleting documents
already generated that night. This also makes cleanup retry automatically if
an invocation is interrupted.

Each document gets its own trace, spans started manually (no HTTP
auto-instrumentation to lean on):

```
generate_document (root span, attrs: run_id, doc.index)
 ├─ build_content     (compose synthetic doc fields)
 └─ upload_to_s3      (real S3 PutObject, or a simulated failure)
```

INFO/ERROR logs emitted from inside these handlers pick up `trace_id`/
`span_id` automatically via the active-span context, same convention as
shop-demo's `logger.mjs`. `run_id` (the UTC calendar date the window
started) is a log/span attribute for grepping one night's data, deliberately
**not** a metric tag — the dashboard's own time-range picker selects the
night; tagging a metric with it would grow a new distinct value every run.

A random draw against `FAILURE_RATE` (default 0.05) happens right before
each document's S3 write: on failure, the upload throws a synthetic error,
the span ends `ERROR`, an ERROR log is emitted, and nothing is written. On
success, a small JSON blob (`{id, generated_at, run_id}`) actually lands at
`s3://<bucket>/documents/<run_id>/<uuid>.json`.

Two metrics:

- `documents.generated` — counter, tagged `outcome: success|failure`,
  incremented once per document.
- `documents.target` — a gauge, recorded once per tick with the constant
  `TOTAL_DOCS` value, so it reads as a flat reference line rather than
  accumulating.

A Lambda invocation is much shorter-lived than shop-demo's container, and
can freeze the instant the handler returns — so unlike shop-demo's periodic
5s export, every invocation here explicitly `forceFlush()`s the trace,
metric, and log providers before returning.

## Deploying the infrastructure

This example ships its own Terraform — separate state from the core
`omnilog-infra` stack, deployed independently, same AWS account/credentials.

```bash
cd infra
cp sample.secrets.env secrets.env   # fill in AWS creds + your Omnilog OTLP endpoint/key
source secrets.env
terraform init
terraform plan   # review before applying — creates real, billable AWS resources
terraform apply
```

This creates an S3 bucket (documents from the current run, with a 7-day
expiry as a fallback), an IAM role, the
Lambda (from a bootstrap placeholder — see below), and the EventBridge
schedule. Note the two outputs (`function_name`, `documents_bucket`) —
you'll want `function_name` for on-demand testing below.

## Deploying the code

Terraform creates the Lambda function but deliberately leaves its code
alone after the first apply (`lifecycle { ignore_changes = [...] }`) — the
real code is owned by `deploy.sh`, decoupled from `terraform apply`, the
same split `omnilog-query`'s Lambda uses in the core stack.

```bash
source infra/secrets.env   # if not already sourced
./deploy.sh
```

This bundles `src/handler.mjs` (esbuild, OTel SDK packages included since
they're not part of the Lambda Node runtime — only the AWS SDK v3 is) and
pushes it with `aws lambda update-function-code`.

## Testing on demand

The EventBridge rule fires all day, but the handler no-ops outside the
window — `event.force` skips that check, for testing without waiting on
either the schedule or the window:

```bash
aws lambda invoke --function-name omnilog-nightly-docgen \
  --payload '{"force":true}' --cli-binary-format raw-in-base64-out \
  /tmp/docgen-invoke.json
cat /tmp/docgen-invoke.json
```

Check `aws logs tail /aws/lambda/omnilog-nightly-docgen --since 5m` for
`[INFO] document generated` / `[ERROR] document generation failed` lines —
the latter are expected at roughly `FAILURE_RATE`, not a sign of anything
broken. Then check Omnilog, filtered to `service:nightly-docgen`: Trace
Viewer for `generate_document` root spans, Log Search for the correlated
entries, Metrics Explorer for `documents.generated`/`documents.target`.

## Configuration

All via the Lambda's environment, set through Terraform variables
(`infra/variables.tf`) — override with `TF_VAR_<name>` or by editing
`infra/secrets.env`/passing `-var`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `total_docs` | 3000 | Documents the run should produce over the whole window |
| `tick_minutes` | 5 | EventBridge schedule granularity |
| `window_start_hour` / `window_end_hour` | 1 / 5 | UTC hours the window opens/closes (may cross midnight) |
| `failure_rate` | 0.05 | Fraction of documents whose S3 upload is randomly, deliberately failed |

## Dashboard widgets

The dashboard has no widget-adding UI yet, and `POST`/`PUT
/api/dashboards` needs a signed-in browser session — no clean way to
create these programmatically right now. Once the UI supports pinning a
widget, these are the two to add (each also needs a client-generated `id`,
omitted here since that's assigned at pin time, not something to type by
hand):

**Success vs failure over the night** — one metric widget, split by
outcome:

```json
{
  "kind": "metric",
  "title": "Documents generated (success vs failure)",
  "service": "nightly-docgen",
  "metric_name": "documents.generated",
  "unit": "",
  "stat": "sum",
  "group_by": "outcome"
}
```

**Target for the run** — a near-flat reference line:

```json
{
  "kind": "metric",
  "title": "Documents target",
  "service": "nightly-docgen",
  "metric_name": "documents.target",
  "unit": "",
  "stat": "max"
}
```

## Local development

Runs one tick locally against a real S3 bucket and OTLP endpoint, no
Lambda involved:

```bash
cp .env.example .env   # fill in OTLP endpoint/key and a bucket you can write to
npm install
npm run invoke-local   # forces the run regardless of wall-clock time
```

Set `LOCAL_FORCE=false` to instead exercise the real window check against
the current time.

## Cleanup

```bash
cd infra
source secrets.env
terraform destroy
```

Previous runs' documents are deleted when a new run begins, and the S3 bucket
also has a 7-day expiry on its objects as a fallback. The bucket,
Lambda, and schedule keep running (and the schedule keeps invoking, all
day, every day, whether or not it's in-window) until destroyed.
