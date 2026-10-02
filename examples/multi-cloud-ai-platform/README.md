# Cloud-agnostic enterprise AI platform (AWS + Azure + Google Cloud)

One diagram built with all three skills together. Each cloud is a panel rendered by **its own tool** with that cloud's official icons and native group frames, then `compose.mjs` stitches the panels into one canvas and routes the cross-cloud links between them.

| Panel | Tool | Spec |
|---|---|---|
| Microsoft Azure | `archify-azure` | `panels/azure.json` |
| Google Cloud | `archify-gcp` | `panels/gcp.json` |
| Amazon Web Services | `archify-aws` | `panels/aws.json` |

| Plane | Services |
|---|---|
| Identity | Microsoft Entra ID (OIDC federation) |
| AI gateway and safety | Apigee, Model Armor, Azure AI Content Safety |
| Portable agent runtime | GKE (orchestrator), AKS and EKS (workers), same Helm charts via GitOps |
| Model plane | Gemini (Vertex AI), Azure OpenAI, Amazon Bedrock |
| Knowledge and data | Amazon S3 + Lake Formation, Azure AI Search, BigQuery (BigLake) |
| Private connectivity | ExpressRoute, Cloud Interconnect, Direct Connect |
| Security and observability | Key Vault, KMS, Cloud Logging, CloudWatch, Azure Monitor |

## Rebuild

```sh
node gen-panels.mjs     # writes panels/*.json
./render-panels.sh      # runs archify-aws, archify-azure and archify-gcp (checkouts next to this repo, or set ARCHIFY_AWS / ARCHIFY_AZURE)
node compose.mjs        # out/architecture.{svg,html,png} + receipt
```

`panels/out/*.svg` are committed so the composed diagram can be rebuilt without the other two tools.

## Limits

- The composed diagram is SVG/HTML/PNG only: no cost or Well-Architected tab and no draw.io export (each panel's tool can produce those for its own cloud).
- The `finalize` checks run per tool, not on the composite; the receipt records the hashes of the three panel specs and SVGs and `visualReview: "not-performed"`.
- Icons are product icons, so placement shows intent, not a deployed topology.
