#!/usr/bin/env bash
#
# Checkout the shirt SKU — 201, happy-path spans/metrics/logs.
curl -X POST localhost:3000/checkout -H 'content-type: application/json' -d '{"sku":"shirt-01","quantity":3}'
