# Cost estimate

The **Cost** tab estimates monthly cost from the **Cloud Billing Catalog API** (on-demand list prices, USD). It is deterministic code, never a model's arithmetic, and every number can be traced to a rate, a quantity and an assumption.

!!! warning "A price book is needed — and it needs your API key"
    The Cloud Billing Catalog API requires an API key. Enable the *Cloud Billing API* on a project, create an API key, then run `GOOGLE_API_KEY=… npm run prices:fetch`. Without a price book the Cost tab is **omitted** (the CLI prints why) and everything else still works.
    The pricers match SKUs by service, resource group and description patterns that were written without access to a live catalog: after the first fetch, any pricer whose pattern does not match reports `needs-input` — never a wrong number. See [Data refresh](../developer-guide/data-refresh.md).

## What the tab shows

* **Totals** per month and per year, how many components were priced, and how many were not.
* **By category** (compute, data and storage, analytics, …) and **by component**, with every line item expanded as `quantity × rate = cost` and the SKU id.
* **Assumptions** — every input is tagged **from spec** (you stated it) or **assumed** (a default). Any defaulted input makes the estimate **indicative**.
* **Sensitivity** at 1×, 3× and 10× traffic, and **what-ifs** (Cloud SQL high-availability cost, Nearline tiering) where they apply.
* **Provenance**: the effective date of each price list and the retrieval date.
* A checkbox that overlays `$/mo` on the diagram.

## Giving it real numbers

Put a `usage` object on each node. Anything you leave out falls back to a documented default and is flagged as assumed.

```json
{ "id": "api", "icon": "cloud-run", "label": "Orders API",
  "usage": { "requestsPerMonth": 20000000, "avgDurationMs": 120, "vcpu": 1, "memoryGib": 0.5 } }
```

Describe the scenario once in `meta.cost.note` so readers know the basis:

```json
"meta": { "title": "…", "cost": { "region": "us-central1", "note": "Illustrative: 3M searches/month" } }
```

### Usage keys by product

| Product | Keys (default) |
|---|---|
| Compute Engine | `machineType` (`e2-standard-4`; predefined `family-standard\|highmem\|highcpu-N` or `family-custom-vcpu-memMb`), `count` (2), `bootDiskGb` (50), `hoursPerMonth` (730) |
| Google Kubernetes Engine | `mode` (`standard`/`autopilot`), `regional` (true), `nodeMachineType` (`e2-standard-4`), `nodeCount` (3); Autopilot pod resources are not modelled |
| Cloud Run | `requestsPerMonth` (1e6), `avgDurationMs` (200), `vcpu` (1), `memoryGib` (0.5); request-based billing |
| Cloud Run functions | `invocationsPerMonth` (1e6), `avgDurationMs` (200), `memoryMb` (256), `vcpu` (0.167) |
| Cloud Storage | `storageClass` (`standard`, `nearline`, `coldline`, `archive`), `location` (`region`, `multi-region`, `dual-region`), `storageGb` (100), `classAOperationsPerMonth` (1e5), `classBOperationsPerMonth` (1e6) |
| BigQuery | `tibScannedPerMonth` (5), `activeStorageGb` (1000), `longTermStorageGb` (0); on-demand analysis |
| Pub/Sub | `tibPublishedPerMonth` (0.5) |
| Cloud SQL | `engine` (`PostgreSQL`, `MySQL`, `SQL Server`), `vcpu` (2), `memoryGb` (8), `highAvailability` (false), `storageGb` (100), `edition` |
| Cloud Logging / Monitoring / Ops | `ingestGibPerMonth` (50), `retainedGibMonths` (0) |

Two keys work on **any** node:

* `usage.monthlyUsd` — supply the monthly cost yourself (status *override*). Use it for products without a cost model (Vertex AI model tokens, Spanner, AlloyDB, Memorystore, Apigee…), and say where the number came from in `usage.note`.
* `usage.egressGbPerMonth` — adds internet network egress (Premium Tier).

## Honest statuses

| Status | Meaning |
|---|---|
| `estimated` | Priced from the price book with the stated and assumed inputs. |
| `override` | You supplied `usage.monthlyUsd`. |
| `no-charge` | The product has no direct charge (VPC networks, IAM, firewall rules…). |
| `not-billable` | A general icon (users, internet), not a Google Cloud product. |
| `not-itemized` | The catalog has no separate SKU for it. |
| `needs-input` | A required input is missing or no unambiguous SKU matched; the reason is shown. |
| `not-estimated` | No cost model for this product yet. Supply `usage.monthlyUsd` to include it. |
| `error` | The price book could not resolve an unambiguous rate; the reason is shown. |

The total only includes priced components, and the tab says how many were left out.

## What is and is not included

Included: public on-demand list prices; 730 hours per month; free tiers where the SKU lists them as a zero-price tier. **Excluded**: taxes, support, committed use discounts (resource-based and flexible), Spot/preemptible, sustained-use discounts where they would apply, negotiated discounts and credits, and network egress unless you set `egressGbPerMonth`. Treat the result as a planning number and confirm it in the [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator).

## From the command line

```bash
archify-gcp cost spec.json                       # table in the terminal
archify-gcp cost spec.json --scale 1,3,10        # sensitivity points
archify-gcp cost spec.json --region us-central1  # needs data/prices/<region>.json
archify-gcp cost spec.json --usage usage.json    # {"<nodeId>": {…usage keys…}} overrides the spec's usage
archify-gcp cost spec.json --json                # full machine-readable result
```

Turn the tab off with `render --no-cost` / `finalize --no-cost`.
