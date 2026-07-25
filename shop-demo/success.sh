#!/usr/bin/env bash
#
# Checkout a normal SKU — 201, happy-path spans/metrics/logs.
curl -X POST localhost:3000/checkout -H 'content-type: application/json' -d '{"sku":"mug-01","quantity":2}'
