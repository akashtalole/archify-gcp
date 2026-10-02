# Architecture diagrams

A diagram is one JSON file. **Nodes and groups live in a tree** (nesting follows the Google Cloud resource hierarchy: organization, folder, project, region, VPC network…); **connections live in a flat `edges` list**. Layout and routing are automatic.

```json
{
  "meta": { "title": "Required", "subtitle": "optional one-liner" },
  "root": { "layout": "row", "gap": 80, "children": [ /* nodes and groups */ ] },
  "edges": [ { "from": "a", "to": "b", "step": 1, "label": "HTTPS" } ]
}
```

Editor completion: `archify-gcp schema architecture` → `schemas/architecture.schema.json`.

## `meta`

| Field | Meaning |
|---|---|
| `title` (required), `subtitle` | Shown above the diagram and in the page header. |
| `theme` | `light` (default, the deck's light-background style) or `dark`. |
| `lens` | `["framework", "generative-ai"]` (the second adds AI-workload findings). The AI-workload checks are switched on automatically when Vertex AI is drawn. |
| `review` | `false` removes the Well-Architected tab. |
| `guardrails` | `true` declares that guardrails exist outside the drawing (silences the "no guardrails drawn" finding). |
| `boundary` | Dataflow only: `false` removes the Google Cloud boundary. |
| `output` | Output `.html` path (default: next to the spec). |
| `cost` | `{ "region": "us-central1", "note": "Illustrative: 2M searches/month" }` — pricing region and a note shown as *Usage basis*. Use `--no-cost` to omit the Cost tab. See [Cost estimate](cost.md). |
| `workload` | `{ "name", "criticality": "critical|high|standard|low", "description" }` — context for the [review](well-architected.md). |

## Nodes

```json
{ "id": "api", "icon": "cloud-run", "label": "Orders API", "sublabel": "Cloud Run", "usage": { "requestsPerMonth": 3000000 } }
```

* **`id`** — letters, digits, `-`, `_`; unique across nodes *and* groups.
* **`icon`** — a product id or alias (`gke`, `bq`, `cloud-run`) or a general icon `gen:<id>` / bare alias (`users`, `mobile`, `internet`). Find ids with:

    ```bash
    archify-gcp icons search "load balancer"
    archify-gcp icons info gke
    ```

    An unknown icon fails validation and suggests close matches ("did you mean …").
* **`label`** — the official product name, at most two lines (wrapped at 18 characters; a warning appears beyond two lines). Use the full name once and short forms (`GKE`) after that. **`sublabel`** is a muted third line (role, size, AZ).
* **`usage`** — monthly usage for the [cost estimate](cost.md). Optional.

## Groups

```json
{ "id": "vpc", "kind": "vpc", "label": "VPC network", "layout": "row", "children": [ … ] }
```

| `kind` | Style (Google Cloud Architecture Center conventions) |
|---|---|
| `gcp-cloud` | dark-grey border around the whole estate |
| `organization` | grey, Organization icon |
| `folder` | light grey, dashed |
| `project` | blue, Project icon |
| `region` | blue, dotted |
| `zone` | light blue, dashed |
| `vpc` | green, VPC network icon |
| `subnet` | blue, tinted fill, Subnet icon |
| `perimeter` | red, dashed, VPC Service Controls icon |
| `firewall` | dark red, Firewall icon |
| `on-premises` | grey |
| `generic`, `generic-dashed` | grey (give it a `label`) |
| `custom` + `"icon": "<product>"` | group showing the product icon |
| `stack` | **invisible** layout container; cannot be an edge endpoint |

`label` defaults to the kind's name (`""` hides it). `color` overrides the border colour — use sparingly; keep the defaults where you can. Edges may end on a group (for example a region): the line meets its border.

Typical nesting: `gcp-cloud › organization › folder › project › region › vpc › zone › nodes`; use `zone` groups when you want to show placement. Put a regional or multi-regional product (Cloud Load Balancing, Cloud Storage, BigQuery, Spanner) beside the zone columns rather than inside one zone.

## Layout

| Field | Values |
|---|---|
| `layout` | `row` (default), `column`, `grid` (+ `columns`) |
| `gap` | pixels between children (default 72; keep ≥ 56 so labelled edges have room) |
| `align` | `center` (default), `start`, `end` |
| `{ "spacer": 60 }` | extra space between children |

Rows align children by **icon centre line**, so connected icons in one row get straight arrows; a column centres on its middle child. Think "main flow left → right in one row; branches above and below in columns".

!!! tip "When the router complains"
    A warning such as *edge a → b: no clean route found (it crosses another node)* means the layout puts something in the way. Reorder `children`, change a `layout`, widen `gap`, or move a node next to its main neighbour, then re-run. Typical fixes:

    * put the two ends of a busy edge in the same row or column;
    * move a group-level service (like a monitoring node) to the end of a row;
    * give a long edge its own band with a `stack` row.

## Edges

```json
{ "from": "gw", "to": "run", "step": 3, "label": "invoke", "desc": "Longer text for the Flow list", "style": "dashed", "arrow": "end" }
```

| Field | Meaning |
|---|---|
| `from`, `to` | node or group ids |
| `step` | 1–99. Draws a black numbered callout and lists the edge under **Flow**. Parallel flows may share a number. Hover the number in the page to see its description. |
| `label` | protocol or action |
| `desc` | longer description used in the Flow list and the callout popup (otherwise "From → To (label)") |
| `style` | `solid`, or `dashed` for async / control / replication / observability |
| `arrow` | `end` (default), `both`, `none` |

Routing is orthogonal, avoids other nodes and group headers, and prefers straight lines. Dashed + labelled edges read best when they are few; if everything is dashed nothing is.

## A complete small example

```json
{
  "meta": { "title": "Serverless API", "cost": { "note": "Illustrative: 3M requests/month" } },
  "root": { "layout": "row", "gap": 80, "children": [
    { "id": "client", "icon": "mobile", "label": "Mobile app" },
    { "id": "cloud", "kind": "gcp-cloud", "layout": "row", "gap": 80, "children": [
      { "id": "gw", "icon": "cloud-api-gateway", "label": "API Gateway" },
      { "id": "run", "icon": "cloud-run", "label": "Orders API", "sublabel": "Cloud Run", "usage": { "requestsPerMonth": 3000000, "avgDurationMs": 120, "memoryGib": 0.5 } },
      { "id": "fs", "icon": "firestore", "label": "Firestore" }
    ] }
  ] },
  "edges": [
    { "from": "client", "to": "gw", "step": 1, "label": "HTTPS" },
    { "from": "gw", "to": "run", "step": 2 },
    { "from": "run", "to": "fs", "step": 3, "label": "read/write" }
  ]
}
```

## Style guidance applied for you

Icons are embedded unmodified (64 px; group icons 32 px), labels are 12 px Arial, borders 1.25 px, arrows 2 px with open heads, numbered callouts black with white bold numbers. The guidelines applied are in the repository's `references/gcp-diagram-guidelines.md`.

!!! info "Authoring rules worth keeping"
    * Show at least two zones (or regional / multi-regional tiers) when the design claims high availability.
    * Do not draw controls just to please the review. Either the architecture has the control (add it with its connection) or say it is out of scope.
    * Name the safety node "Model Armor" (or "… safety filters") so the review recognises it; show the vector store or knowledge source and where prompts and responses are logged.
