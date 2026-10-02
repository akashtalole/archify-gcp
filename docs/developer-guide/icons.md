# Icon catalog

The official **Google Cloud icons** are **not committed**. `scripts/fetch-icons.mjs` downloads two packages from Google (<https://cloud.google.com/icons>):

* `google-cloud-legacy-icons.zip` — about 216 product icons, one folder per product (`<name>/<name>.svg`, 24 px, with global CSS classes);
* `core-products-icons.zip` — the current-brand colour icons (512 px) for core products (Compute Engine, GKE, Cloud Run, Cloud Storage, Cloud SQL, Spanner, BigQuery, Vertex AI, Looker, Apigee, Anthos, Security Command Center, AlloyDB, Hyperdisk, Distributed Cloud, Mandiant, Threat Intelligence, Security Operations, AI Hypercomputer).

* `category-icons.zip` — the 26 product **category** icons (Compute, Containers, Agents, Observability, Security and Identity, …), extracted to `assets/gcp-icons/categories/` and added to the catalog as `category-<name>` (category `categories`, names like "Agents (category)"). They stand in where Google has no product icon (aliases `agents`, `agent-engine`, `agent-builder`, `gemini-enterprise` → `category-agents`) and make good `custom` group icons for category-scoped boundaries. `--no-categories` skips them.

A core icon **replaces** the legacy icon of the same product (`CORE_TO_LEGACY` in `catalog-build.mjs`); products only in the core set are added. Everything is extracted to `assets/gcp-icons/products/<key>.svg` (git-ignored; override with `ARCHIFY_GCP_ICONS`), the original general icons from `data/general-icons/` are copied to `assets/gcp-icons/general/`, and `data/catalog.json` is rebuilt through `src/catalog-build.mjs`. A small zero-dependency ZIP reader (`src/zip.mjs`) does the extraction.

## Catalog (`data/catalog.json`)

```json
{ "generatedFrom": "Google Cloud icons (legacy product set + core products set)",
  "categories": […], "services": [ { "key": "cloud_run", "id": "cloud-run", "name": "Cloud Run", "category": "serverless", "file": "products/cloud_run.svg" } ],
  "groups": [ { "key": "Project", "dark": false, "file": "products/project.svg" } ],
  "general": [ { "key": "users", "id": "users", "name": "Users", "file": "general/users.svg" } ] }
```

Currently 223 products, 26 category icons, 10 general icons and 6 group icons. Ids are slugs of the file key with a leading `google_` removed (`google_kubernetes_engine` → `kubernetes-engine`); display names come from `humanName` (acronym and override tables in `catalog-build.mjs`); categories from the regex rules in `CATEGORY_RULES` (first match wins). `GROUP_ICON_KEYS` maps group kinds to icons (Project, VPC, Subnet, Firewall, Perimeter, Organization). Google has no separate icon for some products (Gemini, Agent Engine, Model Armor…): examples use the closest official icon and name the product in the label.

`data/aliases.json` maps friendly names (`gke`, `bq`, `gcs`, `kms`, `iap`, `vertex-ai`, `gemini`…) to product ids; a separate map exists for general icons.

## Icon SVG styling

Many Google SVGs colour their shapes with **global CSS classes** (`.cls-1{fill:#aecbfa}`). Inlined into one HTML page, those classes would restyle each other. `symbol()` in `render.mjs` therefore renames every class used in an icon's `<style>` to a symbol-scoped name (and rewrites the `class="…"` attributes), alongside the existing gradient-id prefixing. A test checks that no unscoped `.cls-N` remains.

## Resolution (`src/catalog.mjs`)

* `resolveIcon(ref)` accepts a product id or alias, a full key, or `gen:<id>`; it returns `{ kind: "service" | "general", entry }` or `null`.
* `searchIcons(query, limit)` ranks whole-word and word-prefix matches (so "ses" does not hit "databases"); aliases always qualify.
* `didYouMean(ref)` powers the suggestions in validation errors (Levenshtein).
* `iconFile(entry)` and `groupIconFile(key, dark)` return absolute paths.

## Adding or changing icons

1. Update the package URLs in `scripts/fetch-icons.mjs` (and `THIRD_PARTY_NOTICES.md`) for a new release, or pass local zips.
2. `npm run icons:fetch`, then `npm test`.
3. Add aliases for new popular products in `data/aliases.json`, categories in `CATEGORY_RULES` if one lands in `other`, and core-set mappings in `CORE_TO_LEGACY`.
4. Re-render examples; icons are embedded in every page.

!!! warning "Never alter icons"
    Google's terms for the icons forbid cropping, flipping, rotating, distorting or recolouring. The renderer embeds files unmodified; only gradient ids and CSS class names are prefixed to avoid collisions.
