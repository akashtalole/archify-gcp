# draw.io exporter

`src/drawio/` produces an uncompressed `.drawio` (mxfile) in which every icon, group and connector stays editable. The reference for styles is the draw.io style reference (<https://www.drawio.com/docs/reference/diagram-generation/style-reference/>).

draw.io's own Google Cloud library (`gcp2`) is **not** a set of referenced stencils or library paths: each of its icons is a base64 SVG embedded in an image cell (`shape=image;image=data:image/svg+xml,…`). The exporter does exactly the same with the official icons, unmodified, so no icon table or mapping is needed and the file renders identically in draw.io, the draw.io VS Code extension and viewers.

| File | Role |
|---|---|
| `export.mjs` | `toDrawio(diagram)`; architecture/dataflow and sequence builders; the `Doc` cell writer |
| `validate.mjs` | `validateDrawio(xml)` structural checks |

## Document structure (`export.mjs`)

* **Parents.** Each group becomes a container cell (`id="g-<id>"`); nodes are children with **relative** coordinates. `stack` groups are layout-only and are skipped; a node's parent is its nearest drawn ancestor.
* **Group styles** are plain **container** cells styled from `groups.mjs` (border colour, dash, tinted fill) with the official group icon (Project, VPC, Subnet, …) as a small image cell in the corner.
* **Icons** are image cells with `points=[…]` for connection constraints, `aspect=fixed`, label below. Labels are the pre-wrapped lines joined with `<br>`; sublabels are small grey `<font>` text.
* **Edges** parent to the lowest common ancestor of their endpoints; waypoints are converted to that parent's coordinates. `exitX/exitY/exitDx/exitDy` (and `entry*`) reproduce the router's port exactly: the fraction is clamped to [0,1] and the remainder goes into the dx/dy offset, with `exitPerimeter=0`. `labelOffset()` converts the label's anchor point into draw.io's relative position along the edge (−1…1).
* **Callouts** are `<object label="N" tooltip="N. description">` wrapping an ellipse cell.
* **Sequence** diagrams use floating edges (`sourcePoint`/`targetPoint`) for lifelines and messages, `umlFrame` for fragments, `note` for notes; an async message gets `startArrow=oval`.
* Output is deterministic: ids derive from spec ids (`n-`, `g-`, `e-`, `b-`…), and the diagram id from a hash of title and size.

## Validation

`validateDrawio(xml)` checks it is an `<mxfile>`; ids are unique; every `parent`, `source`, `target` resolves (`<object>` wrappers included); every embedded `image=data:image/svg+xml,…` decodes to an SVG; tags balance. `export`, `render --drawio` and `finalize` all refuse to write an invalid file.

## Testing against draw.io itself

The tests check structure. To **see** the result, load the file in draw.io's viewer:

```html
<div class="mxgraph" data-mxgraph='{"xml": "…escaped file…", "nav": false}'></div>
<script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
```

Compare against the PNG; icons, containers and routing should look the same.

## Adding something

* **A new group kind**: add it to `GROUP_KINDS` (`groups.mjs`) and, if it has a corner icon, to `GROUP_ICON_KEYS` (`catalog-build.mjs`).
* **Another format** (for example Excalidraw): read the same `diagram` object; see how `export.mjs` uses `model.nodes[*].iconRect`, `model.routes[*].pts`, `badgePos` and `labelPos`.
