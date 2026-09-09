// Runs one tick locally against a real S3 bucket and the OTLP endpoint in
// .env — no Lambda involved. Forces the run regardless of the current
// wall-clock hour, the same way `aws lambda invoke --payload '{"force":true}'`
// does against the deployed function; set LOCAL_FORCE=false to instead
// exercise the real window check against the current time.
import { handler } from "./handler.mjs";

const force = process.env.LOCAL_FORCE !== "false";
const result = await handler({ force }, { awsRequestId: "local" });
console.log(result);
