import { trace } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Unlike shop-demo's long-lived container, a Lambda execution environment can
// freeze or be torn down the instant the handler returns — there is no
// guarantee a batch processor's next scheduled export ever runs. Every
// processor here still batches (cheaper than exporting per-span/per-metric),
// but forceFlushAll() below is what actually guarantees delivery, and every
// invocation must call it before returning.

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "nightly-docgen",
});

const tracerProvider = new NodeTracerProvider({
  resource,
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
});
tracerProvider.register();

export const meterProvider = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      // Long enough that the periodic export never fires during a single
      // invocation — forceFlushAll() is the only export path that matters here.
      exportIntervalMillis: 60_000,
    }),
  ],
});

export const loggerProvider = new LoggerProvider({
  resource,
  // Unlike sdk-trace-base's BatchSpanProcessor (a shim accepting a bare
  // exporter positionally, see below), BatchLogRecordProcessor takes only the
  // base { exporter, ...config } object form — passing the exporter
  // positionally leaves `this._exporter` undefined inside the processor.
  // BatchLogRecordProcessorBase._flushAll() swallows that failure via
  // globalErrorHandler rather than rejecting, so forceFlush() resolves
  // successfully regardless — logs were silently never exported and nothing
  // here would have surfaced it without diag logging turned on to see it.
  processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })],
});

export const tracer = trace.getTracer("nightly-docgen");

export async function forceFlushAll() {
  await Promise.all([
    tracerProvider.forceFlush(),
    meterProvider.forceFlush(),
    loggerProvider.forceFlush(),
  ]);
}
