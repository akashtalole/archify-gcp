# Mermaid and infrastructure as code

Both importers produce an ordinary spec that you can edit and render with `finalize`. They **report what they could not map** instead of guessing silently.

## Mermaid → spec

```bash
archify-gcp import mermaid flow.mmd -o spec.json --title "Orders" [--number] [--render]
cat flow.mmd | archify-gcp import mermaid - -o spec.json
```

* **`flowchart` / `graph`**: node shapes, `A --> B --> C` chains, `A & B`, labelled (`-->|x|`, `-- x -->`) and dashed edges, nested `subgraph`s. Subgraph titles that name Google Cloud boundaries (Google Cloud, Organization, Folder, Project, Region, Zone, VPC, Subnet, VPC Service Controls perimeter, Firewall, on-prem/data center) become those group kinds; others become generic groups. Nodes are layered left → right (`LR`) or top → down (`TD`) from the edges.
* **`sequenceDiagram`**: participants and actors (`as` aliases), `->>` sync, `-->>` return, `-)` async, self messages, `Note over`, and `loop`/`alt`/`opt`/`par … else/and … end`.
* **Icons** are guessed conservatively: exact service name or alias → Google Cloud keyword table → strict catalog search → a generic icon. The command lists everything that was not an *exact* match; review those. Mermaid colours and `classDef` styling are ignored; `stateDiagram` is not supported.
* `--number` numbers the edges as steps; `--render` renders immediately.

## Terraform → spec

```bash
archify-gcp import iac ./infra -o spec.json [--include logs,iam] [--title "…"] [--render]
```

* Reads Terraform `google_*` resources (`*.tf`; `google_beta_*` too). The scanner is **zero-dependency and not a full parser**: no modules, `for_each`/`count` expansion or variables.
* A resource that **references** another becomes an edge ("uses"). **Glue** resources (Pub/Sub subscriptions, IAM members and bindings, URL maps and backend services, target proxies, health checks, node pools, log sinks, API enablement…) are not drawn; they are resolved into edges between the real products — for example a Pub/Sub subscription becomes `topic → function` "subscribes".
* Resources with network wiring (`network`, `subnetwork`, `vpc_access`, `private_network`…) are grouped inside a VPC network.
* Service accounts, log sinks and unknown types are skipped and counted; `--include logs,iam` also shows log sinks and service accounts.

!!! tip "Treat the result as a draft"
    A reference shows dependency, not necessarily runtime traffic. Add `step` numbers, labels and `usage` after importing, then run `finalize`.

Examples: `examples/mermaid/` and `examples/iac/` (a Terraform stack with its generated spec and page).
