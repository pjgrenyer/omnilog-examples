import { meterProvider } from "./instrumentation.mjs";

const meter = meterProvider.getMeter("nightly-docgen");

// Tagged only by `outcome` (success|failure) — deliberately not by run_id.
// run_id is useful as a log/span attribute for grepping one night's data, but
// tagging a metric with it would grow a new distinct tag value every night;
// the dashboard's own time-range picker is what selects "last night", not a
// metric tag.
export const documentsGenerated = meter.createCounter("documents.generated", {
  description: "Documents the nightly batch attempted, by outcome",
});

// Recorded once per tick with the run's constant target. A gauge, not a
// counter: reporting the same value every tick must read as a flat line, not
// accumulate into a ramp — that's what stat=max on the dashboard widget reads
// as "what should have been created" rather than a growing total.
export const documentsTarget = meter.createGauge("documents.target", {
  description: "Configured document count the run should produce",
});
