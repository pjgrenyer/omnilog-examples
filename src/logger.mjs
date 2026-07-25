import { SeverityNumber } from "@opentelemetry/api-logs";
import { loggerProvider } from "./instrumentation.mjs";

const otelLogger = loggerProvider.getLogger("shop-demo");

function emit(severityText, severityNumber, message, attributes = {}) {
  // No explicit trace context here: the SDK's active-span context propagation
  // stamps trace_id/span_id automatically when emit() runs inside a request's
  // span (which it always does — server.mjs only calls this from request
  // handlers, themselves inside the Express auto-instrumentation's span).
  otelLogger.emit({ severityText, severityNumber, body: message, attributes });
  console.log(`[${severityText}] ${message}`, attributes);
}

export const logInfo = (msg, attrs) => emit("INFO", SeverityNumber.INFO, msg, attrs);
export const logError = (msg, attrs) => emit("ERROR", SeverityNumber.ERROR, msg, attrs);
