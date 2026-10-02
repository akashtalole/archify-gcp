# Cost estimation

`archify-gcp cost spec.json [--region r] [--scale 1,3,10] [--usage usage.json] [--json]` prices each node from `data/prices/<region>.json`, built from the
**Cloud Billing Catalog API** (`GOOGLE_API_KEY=… npm run prices:fetch`; the API needs your own API key). Monthly = 730 hours; on-demand list prices (USD) only.
When no price book exists the Cost tab is omitted and the review still runs.

Statuses per node: `estimated`, `override` (`usage.monthlyUsd`), `no-charge`, `not-billable`, `not-itemized`, `needs-input`, `not-estimated` (no cost model yet), `error`.
Give a node a `usage` object (for example Cloud Run `requestsPerMonth`, `avgDurationMs`, `vcpu`, `memoryGib`; Compute Engine `machineType`, `count`; BigQuery
`tibScannedPerMonth`) to replace defaults; every assumption is shown as "from spec" or "assumed". SKUs are matched by service, resource group and
description; a pattern that matches SKUs with different prices is an error, never a guess. Vertex AI model token prices are not modelled: supply `usage.monthlyUsd`.
Excludes taxes, support, committed use discounts, Spot, negotiated discounts and network egress unless `egressGbPerMonth` is set. Confirm any number in the
Google Cloud Pricing Calculator. The full usage key table is in `docs/user-guide/cost.md`.
