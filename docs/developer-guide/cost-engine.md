# Cost engine

All cost arithmetic lives in `src/cost/`. The rules are adapted from the AWS billing-and-cost-management skill: **never reason about money, run code; public on-demand list rates only; 730 hours per month; never invent a price.**

| File | Role |
|---|---|
| `pricefile.mjs` | Ingests Cloud Billing Catalog SKUs into compact rate rows (`skuRows`, `forRegion`). |
| `pricebook.mjs` | `loadPriceBook(region)`; `dim()`, `tryDim()`, `tiered()`, `round4()`, `money()`, `HOURS_PER_MONTH`, `PricingError`. `ARCHIFY_GCP_PRICES_DIR` overrides the data folder (tests use it). |
| `pricers.mjs` | One pricer per product; `SERVICE_PRICER` (catalog id → pricer), `NO_CHARGE`, `machineShape` (machine type → vCPU and memory). |
| `estimate.mjs` | `estimateCost(diagram, options)`: runs pricers, totals, sensitivity, what-ifs, provenance. |

## Price book (`data/prices/<region>.json`)

```json
{ "schema_version": "archify-gcp.prices.v1", "region": "us-central1", "retrievedAt": "…",
  "services": { "Compute Engine": { "serviceId": "6F81-5844-456A", "publicationDate": "…",
    "rows": [ { "sku": "<skuId>", "d": "E2 Instance Core running in Americas", "g": "CPU", "f": "Compute", "ut": "OnDemand",
                "unit": "h", "usd": "0.021811", "b": 0, "e": null, "r": ["us-central1"] } ] } } }
```

`d` is the SKU description, `g` the resource group, `f` the resource family, `ut` the usage type, `unit` the SKU's usage unit (`h`, `GiBy.mo`, `GiBy`, `TiBy`, `count`, `s`…), `b`/`e` the tier begin/end **in that unit** (the API gives the start; ends are derived). **Free tiers are zero-price first tiers**, so `tiered()` includes them automatically. `dim(code, predicate, what)` returns the tier rows for **one** dimension and throws if the predicate matches SKUs with *different* prices (the same SKU listed for several regions is fine). A silently wrong SKU is worse than "not estimated".

## Getting the data

The Cloud Billing Catalog API (`cloudbilling.googleapis.com/v1/services` and `/v1/services/{id}/skus`) is the official source and **needs an API key** (enable the *Cloud Billing API* on a project; create a key). `scripts/fetch-prices.mjs` reads `GOOGLE_API_KEY`, pages through each service's SKUs, keeps on-demand SKUs that apply to the region (or to a multi-region / global scope) and writes the compact rows. There is no keyless public price list of comparable quality, so the repository does not commit a price book.

!!! warning "Pricer patterns are unverified until the first real fetch"
    The SKU description patterns in `pricers.mjs` were written from the structure of the catalog without a live fetch. Tests run the pricers against a **synthetic** fixture (`test/fixtures/prices/`) that proves the arithmetic and the failure modes. After the first real `prices:fetch`, run `archify-gcp cost` on the examples: a pricer whose pattern does not match reports `needs-input` ("no price for …"); fix the pattern, add the real description to a test and re-run.

## A pricer

```js
run: {
  label: "Cloud Run",
  run({ pb, u, vol }) {
    const req = vol("requestsPerMonth", 1e6), ms = u("avgDurationMs", 200), vcpu = u("vcpu", 1);
    const cpu = pb.dim("Cloud Run", (r) => /CPU/i.test(r.d) && !/Idle|Min Instance/i.test(r.d), "Cloud Run CPU");
    return { lines: [ line("vCPU-seconds", cpu, req * (ms / 1000) * vcpu) ] };
  },
}
```

* `u(key, default)` reads `node.usage[key]`, records it as **spec** or **default**, and returns it.
* `vol(key, default)` is the same for volumes that **scale with traffic** (sensitivity multiplies these; fixed capacity such as instance counts uses `u`).
* `line(label, rows, qty, opts)` prices through tiers and records `qty`, `unit`, `rate`, `sku`, `usagetype`. Quantities must be expressed in the SKU's own unit.
* Return `{ lines, notes?, notItemized? }`; throw `PricingError` for anything that cannot be priced without guessing. `estimate.mjs` turns that into `status: "error"` or `needs-input`.
* What-ifs live in `computeWhatIfs` in `estimate.mjs`: Cloud SQL high availability and Nearline tiering, each recomputed with the same pricer and the same price book.

### Adding a product

1. Add its Cloud Billing display name to `SERVICES` in `scripts/fetch-prices.mjs` and fetch: `GOOGLE_API_KEY=… node scripts/fetch-prices.mjs --services "<name>"`.
2. Write the pricer in `pricers.mjs` and map the catalog id in `SERVICE_PRICER`; add a `CATEGORY` entry and a `SERVICE_CODES` entry in `estimate.mjs`.
3. Add its usage keys to the user guide table (`docs/user-guide/cost.md`).
4. Add SKUs with the real descriptions to `test/fixtures/prices/` and a test that reads the rate **from the price book itself** (never hard-codes a price) and checks the formula.
5. Verify one number by hand against the Google Cloud Pricing Calculator.

## `estimateCost` result

```text
{ schema_version, asOf, region, currency, scale, basis,
  totals: { monthlyUsd, annualUsd, byCategory },
  coverage: { nodes, estimated, override, noCharge, notBillable, notItemized, needsInput, notEstimated, error },
  confidence: "indicative" | "usage-based", defaultedAssumptions: [ { node, key, value } ],
  nodes: [ { id, label, service, status, pricer, category, monthlyUsd, lines, assumptions, notes } ],
  sensitivity: [ { scale, monthlyUsd } ], whatIfs: [ … ], priceBook: { region, retrievedAt, publications } }
```

Totals include only `estimated` and `override` nodes. Pass `asOf: new Date(…)` in tests for reproducibility. `analyze()` catches "no price book" and returns `{ cost: null, costNote }` so the page simply omits the Cost tab.

## Gotchas

* A SKU's `usageUnit` is not always the unit people think in (`TiBy`, `GiBy.mo`, `GiBy.h`, `s`): always read it from the row.
* Several SKUs can look alike (zonal vs regional, Standard vs Enterprise editions, request-based vs instance-based billing): filter explicitly and let `dim()` fail on ambiguity.
* A `Set.add(...codes)` only adds the first argument — loop.
* The "scaled by traffic" flag must be set on the assumption entry even when the key already exists.
