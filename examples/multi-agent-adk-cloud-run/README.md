# Multi-agent system: Google ADK agents on Cloud Run

An order-operations assistant built with the [Agent Development Kit (ADK)](https://google.github.io/adk-docs/) and deployed to Cloud Run.

| File | Type | What it shows |
|---|---|---|
| `architecture.json` | architecture | Coordinator service (root agent + local sub-agents), remote Inventory and Shipping agent services, Model Armor, Gemini on Vertex AI, MCP Toolbox for Databases, AlloyDB, Secret Manager, Cloud Trace/Logging |
| `order-question.sequence.json` | sequence | One question end to end: screening, delegation, parallel A2A calls, MCP tool calls, SQL |
| `agent-delivery.dataflow.json` | dataflow | Develop → build → deploy (`adk deploy cloud_run`) → run → observe |

Rendered outputs (html, svg, png, drawio, finalize receipt) are in `out/`. Regenerate with `npm run examples`.

## Design

- The **root agent** (`LlmAgent`) runs in the Coordinator service with two in-process sub-agents (planner, writer).
- **Inventory** and **Shipping** agents are separate Cloud Run services, called over the A2A protocol (`RemoteA2aAgent`, agent card, Google ID token). They scale and deploy independently.
- Agents reach the database only through **MCP Toolbox for Databases**, so SQL stays in one reviewed place.
- Prompts and responses are screened by **Model Armor**; all agents call Gemini on Vertex AI.

## Limits

- Cost covers the Cloud Run, AlloyDB and similar resources that have a price book; Gemini token spend is a flat `monthlyUsd` estimate.
- The icon set has no Gemini, Model Armor, or Agent Engine icons, so stand-ins are used (`vertexai`, `data-loss-prevention-api`, `category-agents`).
