#!/usr/bin/env bash
#
# Build and deploy nightly-docgen's Lambda code. Infrastructure (the
# function, IAM role, S3 bucket, EventBridge schedule) is managed separately
# by infra/ (Terraform), which creates the function from a bootstrap zip and
# ignores code changes — so this script owns the actual code via
# `aws lambda update-function-code`, decoupled from `terraform apply`.
#
# Unlike omnilog-query's deploy.sh, this bundles node_modules in: the OTel SDK
# packages aren't part of the Lambda Node runtime (only the AWS SDK v3 is),
# so build.mjs (esbuild) has to bundle them in.
#
# Prerequisites:
#   - infra/ has been applied (the function must already exist)
#   - `source infra/secrets.env` (AWS credentials + region)
#   - Node.js + npm, aws CLI, and zip installed
#
# Usage:
#   ./deploy.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

PROJECT="${PROJECT:-omnilog-nightly-docgen}"
FN="$PROJECT"
ZIP=".build/docgen.zip"

echo ">> installing deps..."
npm ci

echo ">> building bundle (esbuild, dist/index.js)..."
npm run build

echo ">> zipping..."
rm -rf .build
mkdir -p .build
( cd dist && zip -qr "../$ZIP" . )

echo ">> updating function $FN ..."
aws lambda update-function-code \
  --function-name "$FN" \
  --zip-file "fileb://$ZIP" >/dev/null
aws lambda wait function-updated --function-name "$FN"
echo ">> nightly-docgen deployed."
