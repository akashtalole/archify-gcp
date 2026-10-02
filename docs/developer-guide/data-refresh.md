# Data refresh

Committed snapshots feed the tool. All have scripts; none is fetched at runtime (except explicit `--refresh`).

| Data | Command | Source | Notes |
|---|---|---|---|
| **Icons** | `npm run icons:fetch` | Google Cloud icon packages (legacy product set + core products set) | Not committed. Update the URLs for a new release. |
| **Prices** | `GOOGLE_API_KEY=… npm run prices:fetch` | Cloud Billing Catalog API | `data/prices/<region>.json`, on-demand only, filtered per service. **Not committed yet** (needs your key). |
| **Well-Architected corpus** | `npm run wa:corpus` or `archify-gcp wa corpus --refresh` | Google Cloud Well-Architected Framework pillar pages | `data/wa/framework.json`; validation gate before saving |
| **Schemas** | `npm run schemas` | the code's own enums | no network; a test fails when stale |

## Prices

```bash
GOOGLE_API_KEY=… node scripts/fetch-prices.mjs                          # us-central1, all configured services
GOOGLE_API_KEY=… node scripts/fetch-prices.mjs --services "Compute Engine,Cloud Run"
GOOGLE_API_KEY=… node scripts/fetch-prices.mjs --region europe-west1    # new region
```

The source is `https://cloudbilling.googleapis.com/v1/services/{id}/skus` (list services first, then page through each service's SKUs). The `SERVICES` list in the script names the Cloud Billing services the pricers use. Only on-demand SKUs that apply to the region, or to a multi-region / global scope, are kept. After the first refresh:

1. `node bin/archify-gcp.mjs cost examples/three-tier.json` — any `needs-input: no price for …` means a pricer pattern needs adjusting to the real SKU description (see [Cost engine](cost-engine.md)).
2. `npm test` — cost tests use the synthetic fixture, so they keep passing; add real descriptions to the fixture for the SKUs you fix.
3. Re-render the examples and compare the totals; large jumps deserve a look at the line items.
4. Commit the data file together with regenerated examples.

## Icons

`scripts/fetch-icons.mjs` downloads `google-cloud-legacy-icons.zip` and `core-products-icons.zip` from `services.google.com/fh/files/misc/`. If the links move, pass local zips: `node scripts/fetch-icons.mjs legacy.zip core.zip`, or set `ARCHIFY_GCP_ICON_URL` / `ARCHIFY_GCP_CORE_ICON_URL`. Check the catalog count and run the tests.

## Well-Architected corpus

```bash
archify-gcp wa corpus --refresh                       # re-reads the six pillar pages
```

Each pillar has a printable page (`/architecture/framework/<pillar>/printable`): principles are H1 headings, recommendations H3 headings under a "Recommendations" H2. The site sometimes serves a machine-translated variant (`lang="fr-x-mtfrom-en"`), so the fetch sends `?hl=en` and `Accept-Language`, verifies the English page title and retries. A refresh fails (and saves nothing) if `validateCorpus` reports errors. If the page layout changes, fix `parsePillar` generally, not by patching data. Because ids derive from page order, a refresh can shift ids: run the tests — the rule-id test reports any evidence rule whose id disappeared or now points at a different recommendation title (check `rules.mjs` against the new titles).

## Release checklist

1. `npm run icons:fetch && npm test`
2. Refresh data if needed (above), re-render examples (`npm run examples`), look at the PNGs.
3. Update `package.json` version and `THIRD_PARTY_NOTICES.md` (icon release, new sources).
4. Merge to `main`; the docs workflow publishes the site.
