# Well-Architected guidance in archify-gcp

Source: the [Google Cloud Well-Architected Framework](https://cloud.google.com/architecture/framework) — six pillars (Operational excellence `OE`, Security, privacy,
and compliance `SEC`, Reliability `REL`, Cost optimization `COST`, Performance optimization `PERF`, Sustainability `SUS`), 37 core principles and 174 recommendations
read from the pillar pages. Google does not number them, so archify-gcp derives ids from page order (`REL-3` = third principle of Reliability, `REL-3.1` = its first
recommendation). The framework's AI and ML perspective maps onto the same pillars, so AI findings are flagged `lens: "generative-ai"` but cite ordinary recommendations.

## What the review is — and isn't
`archify-gcp review` / the page panel inspects **which products, boundaries and connections are drawn**. It cannot see configuration (CMEK flags, HA toggles, IAM bindings).
Results are `ok` (evidence of the practice is drawn), `consider` (not drawn — confirm or add), `gap` (strong signal of a gap). Treat it as a prompt for a real review
(Google Cloud Architecture Framework assessment, Active Assist, Security Command Center), never as a score.

## Heuristic rule ids by pillar
| Pillar | Rule ids |
|---|---|
| Operational excellence | `OPS-OBSERVE`, `OPS-IAC`, `AI-OBSERVE` |
| Security, privacy, and compliance | `SEC-EDGE`, `SEC-DB-PUBLIC`/`SEC-DB-PRIVATE`, `SEC-PRIVATE-ACCESS`, `SEC-ENCRYPT`, `SEC-IDENTITY`, `SEC-DETECT`, `SEC-SECRETS`, `AI-SAFETY`, `AI-ENDPOINT`, `AI-PRIVATE`, `AI-AGENCY` |
| Reliability | `REL-ZONES`, `REL-SCALE`, `REL-BACKUP`, `REL-DECOUPLE`, `AI-RESILIENCE` |
| Performance optimization | `PERF-EDGE`, `PERF-CACHE`, `AI-RETRIEVAL` |
| Cost optimization | `COST-VISIBILITY`, `AI-COST` |
| Sustainability | `SUS-REGION`, `SUS-MANAGED` |

## Making a diagram "review-friendly"
Draw what a reviewer would ask about: Cloud Armor and a global load balancer at the edge, Identity Platform / IAP / IAM, Cloud KMS, two zones (or regional/multi-region
tiers), managed instance groups or serverless compute, backups, Pub/Sub between tiers, Cloud Monitoring and Logging, Security Command Center, a VPC Service Controls perimeter
and, for AI workloads, a node labelled *Model Armor* (or safety filters), the retrieval store, request-response logging and an API layer (Apigee or API Gateway) in front of
the model. If a practice is deliberately out of scope, say so in `meta.subtitle` rather than adding decorative icons.

## Review report (Well-Architected tab)
`archify-gcp wa review spec.json [--mode full|quick|pillar|score] [--pillars security,reliability] [--filter critical|critical-high|all] [--criticality low|standard|high|critical]`
Every recommendation in the frozen corpus (`data/wa/framework.json`, 174) gets one of five statuses. Only recommendations the diagram can evidence are judged; the
rest are `Cannot Determine` with a hint about the evidence needed. The HTML tab follows the review skill's template: classification banner, coverage audit, executive
summary, scorecards, per-principle table, full recommendation ledger (filterable), findings by risk, trade-offs, Eisenhower matrix, SMART remediation plan and next steps.
