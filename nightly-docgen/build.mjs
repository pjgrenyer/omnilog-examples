// Bundles src/handler.mjs into a single dist/index.js for Lambda — the OTel
// SDK packages aren't part of the Lambda Node runtime so they need bundling,
// but the AWS SDK v3 is pre-installed in the runtime image, so it's left
// external rather than bundled in twice.
//
// Output format is CJS, not ESM, despite the source being ESM: several OTel
// packages are internally CJS and `require()` Node builtins (e.g.
// @opentelemetry/core's platform detection requiring "util"). esbuild's
// require-to-ESM shim can't resolve a dynamic require of a builtin in ESM
// output ("Dynamic require of 'util' is not supported") — bundling to CJS
// sidesteps the whole interop problem, and Lambda's Node runtime supports a
// CJS handler natively.
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");

// The project root's package.json says "type": "module", which Node's
// require() would otherwise inherit for dist/index.js too, refusing to treat
// a plain CJS bundle as CJS. This package.json overrides that for dist/ only.
writeFileSync("dist/package.json", JSON.stringify({ type: "commonjs" }));

await build({
  entryPoints: ["src/handler.mjs"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: "dist/index.js",
  external: ["@aws-sdk/client-s3"],
});

console.log("built dist/index.js");
