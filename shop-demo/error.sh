#!/usr/bin/env bash
#
# Checkout the seeded declined-card SKU — 402, chargeCard span ends ERROR.
curl -X POST localhost:3000/checkout -H 'content-type: application/json' -d '{"sku":"bad-card","quantity":1}'
