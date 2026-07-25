import { meterProvider } from "./instrumentation.mjs";

const meter = meterProvider.getMeter("shop-demo");

export const ordersCreated = meter.createCounter("orders.created", {
  description: "Orders successfully completed",
});

export const checkoutDuration = meter.createHistogram("checkout.duration_ms", {
  description: "End-to-end /checkout handler duration",
  unit: "ms",
});
