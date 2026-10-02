# Google Cloud diagram guidelines applied by archify-gcp

Distilled from Google's icon terms and the conventions of the Google Cloud Architecture Center diagrams. Google does not publish a
group-style deck, so group styling here is a documented house style (thin coloured boundary, corner icon where Google provides one,
label to its right). The renderer enforces what it can; the rest is for whoever authors the spec.

| Guidance | What archify-gcp does |
|---|---|
| Use the icons unmodified: no cropping, flipping, rotating, distorting or recolouring | Product icons embedded unmodified at 64px; group icons at 32px; Google's CSS classes are scoped per icon so icons never restyle each other |
| Use the product name next to the icon | Labels carry the official product name (full name once, short form afterwards) |
| Boundaries: Google Cloud, organization, folder, project, region, zone, VPC network, subnet, VPC Service Controls perimeter, firewall rules, on-premises | `kind` presets in `src/groups.mjs` (Project, VPC, Subnet, Firewall and Perimeter use official icons) |
| Custom group for a product: product icon + border | `kind: "custom"` with `icon` |
| Labels: ≤ 2 lines, never break mid-word | 12px Arial, auto-wrap at word boundaries, warning past 2 lines |
| Arrows: straight lines and right angles; open arrowhead | Orthogonal router, open chevron arrowhead, 2px lines |
| Numbered callouts for the primary flow | `step` badges (black circle, white bold number) |
| Light background for web and documents; dark for presentations | `theme: light|dark` (and a toggle in the HTML page) |

Group colours (house style, from Google's palette): Google Cloud `#3C4043`, organization `#5F6368`, folder `#9AA0A6`, project and region
`#4285F4`, zone `#669DF6`, VPC network `#34A853`, subnet `#1A73E8`, VPC Service Controls perimeter `#EA4335`, firewall `#D93025`, on-premises grey.
Run `archify-gcp icons categories` and `archify-gcp icons groups` for the catalog's categories and group kinds.

Typical nesting: `gcp-cloud › organization › folder › project › region › vpc › zone › nodes`. Global and regional managed services (Cloud Storage,
BigQuery, Pub/Sub, Cloud KMS, Cloud Logging, Cloud Load Balancing) sit beside the VPC rather than inside a zone; draw a VPC Service Controls
`perimeter` around the projects whose data must not leave.
