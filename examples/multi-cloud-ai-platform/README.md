# Cloud-agnostic enterprise AI platform (AWS + Azure + Google Cloud)

One diagram that uses all three archify skills' icon sets together: Google Cloud icons come from the GCP catalog, and the AWS and Azure icons are vendored as general icons (`gen:aws-*`, `gen:azure-*`, see `data/general-icons/`).

| Plane | Services |
|---|---|
| Identity | Microsoft Entra ID (OIDC federation) |
| AI gateway and safety | Apigee, Model Armor, Azure AI Content Safety |
| Portable agent runtime | GKE (orchestrator), AKS and EKS (workers), same Helm charts via GitOps |
| Model plane | Gemini (Vertex AI), Azure OpenAI, Amazon Bedrock |
| Knowledge and data | Amazon S3 + Lake Formation, Azure AI Search, BigQuery (BigLake) |
| Private connectivity | Cloud Interconnect, Direct Connect, ExpressRoute |
| Security and observability | Key Vault, Cloud Logging, CloudWatch, Azure Monitor |

`gen.mjs` writes `architecture.json`; `out/` holds the html, svg, png, drawio and finalize receipt. Regenerate with `node examples/multi-cloud-ai-platform/gen.mjs && npm run examples`.

Notes: no cost tab (a multi-cloud price book is out of scope); the Well-Architected advisory uses the Google Cloud framework only; icons are product icons, so placement shows intent, not a deployed topology.
