import { SeverityNumber } from "@opentelemetry/api-logs";
import { loggerProvider } from "./instrumentation.mjs";

const otelLogger = loggerProvider.getLogger("nightly-docgen");

function emit(severityText, severityNumber, message, attributes = {}) {
  // No explicit trace context here: emit() is only ever called from inside a
  // document's active span (see handler.mjs), so the SDK's context propagation
  // stamps trace_id/span_id automatically — same convention as shop-demo.
  otelLogger.emit({ severityText, severityNumber, body: message, attributes });
  console.log(`[${severityText}] ${message}`, attributes);
}

export const logInfo = (msg, attrs) => emit("INFO", SeverityNumber.INFO, msg, attrs);
export const logError = (msg, attrs) => emit("ERROR", SeverityNumber.ERROR, msg, attrs);
