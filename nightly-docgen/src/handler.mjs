import { randomUUID } from "node:crypto";
import { SpanStatusCode } from "@opentelemetry/api";
import { forceFlushAll, tracer } from "./instrumentation.mjs";
import { logError, logInfo } from "./logger.mjs";
import { documentsGenerated, documentsTarget } from "./metrics.mjs";
import { docsPerTick, isWithinWindow, runIdFor, windowMinutes } from "./schedule.mjs";
import { deletePreviousDocuments, putDocument } from "./s3.mjs";

function env(name, fallback) {
  const raw = process.env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

function config() {
  return {
    bucket: env("DOCUMENTS_BUCKET"),
    totalDocs: Number(env("TOTAL_DOCS", "3000")),
    tickMinutes: Number(env("TICK_MINUTES", "5")),
    windowStartHour: Number(env("WINDOW_START_HOUR", "1")),
    windowEndHour: Number(env("WINDOW_END_HOUR", "5")),
    failureRate: Number(env("FAILURE_RATE", "0.05")),
  };
}

/**
 * One document: a root span with two children (build, upload), correlated
 * INFO/ERROR logs, and a `documents.generated{outcome}` increment. Spans are
 * started manually rather than via HTTP auto-instrumentation — a scheduled
 * tick has no incoming request to hang a span on, unlike shop-demo.
 */
async function generateDocument(index, { bucket, runId, failureRate }) {
  await tracer.startActiveSpan(
    "generate_document",
    { attributes: { run_id: runId, "doc.index": index } },
    async (span) => {
      try {
        const doc = await tracer.startActiveSpan("build_content", async (buildSpan) => {
          try {
            logInfo("building document", { run_id: runId, doc_index: index });
            return { id: randomUUID(), generated_at: new Date().toISOString(), run_id: runId };
          } finally {
            buildSpan.end();
          }
        });

        await tracer.startActiveSpan("upload_to_s3", async (uploadSpan) => {
          try {
            // The injected failure point: drawn right before the write, so a
            // "failure" always means the upload specifically failed, not
            // some earlier step — mirrors shop-demo's bad-card checkout path.
            if (Math.random() < failureRate) {
              throw new Error("simulated S3 throttling");
            }
            await putDocument(bucket, `documents/${runId}/${doc.id}.json`, doc);
          } catch (err) {
            uploadSpan.recordException(err);
            uploadSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            throw err;
          } finally {
            uploadSpan.end();
          }
        });

        documentsGenerated.add(1, { outcome: "success" });
        logInfo("document generated", { run_id: runId, doc_index: index, doc_id: doc.id });
      } catch (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        documentsGenerated.add(1, { outcome: "failure" });
        logError("document generation failed", {
          run_id: runId,
          doc_index: index,
          error: err.message,
        });
      } finally {
        span.end();
      }
    },
  );
}

// The EventBridge rule invokes this with an empty payload every tick, all
// day — `event.force` only ever comes from a human running
// `aws lambda invoke --payload '{"force":true}'` to test on demand without
// waiting for the schedule or the window, which is also what
// invoke-local.mjs uses locally.
export async function handler(event = {}, context = {}) {
  const cfg = config();
  const now = new Date();
  const forced = event.force === true;

  if (!forced && !isWithinWindow(now, cfg.windowStartHour, cfg.windowEndHour)) {
    console.log(
      `outside window (${cfg.windowStartHour}:00-${cfg.windowEndHour}:00 UTC), current hour ${now.getUTCHours()} — no-op`,
    );
    return { generated: 0, inWindow: false };
  }

  if (!cfg.bucket) {
    throw new Error("DOCUMENTS_BUCKET must be set");
  }

  const runId = runIdFor(now, cfg.windowStartHour, cfg.windowEndHour);
  const mins = windowMinutes(cfg.windowStartHour, cfg.windowEndHour);
  const count = docsPerTick(cfg.totalDocs, mins, cfg.tickMinutes);

  // Wrapped in try/finally rather than a flush at the tail end: an unexpected
  // throw here (a bug, not a per-document failure — those are already caught
  // inside generateDocument) must not also lose whatever telemetry the
  // batch processors are already holding from this invocation.
  try {
    const deleted = await deletePreviousDocuments(cfg.bucket, runId);
    if (deleted > 0) {
      logInfo("deleted documents from previous runs", { run_id: runId, deleted });
    }

    // No run_id tag here either — same cardinality reasoning as
    // documents.generated; the dashboard's time-range picker selects the night.
    documentsTarget.record(cfg.totalDocs);

    console.log(
      `run ${runId}: generating ${count} documents this tick (request ${context.awsRequestId ?? "local"})`,
    );
    for (let i = 0; i < count; i += 1) {
      await generateDocument(i, { bucket: cfg.bucket, runId, failureRate: cfg.failureRate });
    }
    return { generated: count, inWindow: true, runId };
  } finally {
    await forceFlushAll();
  }
}
