// Generates architecture.json (kept as a script so the three-cloud node list stays readable).
import fs from "node:fs";
const n = (id, icon, label, sublabel) => ({ id, icon, label, sublabel });
const g = (id, label, children, o = {}) => ({ id, kind: o.kind || "generic", label, layout: o.layout || "column", gap: o.gap || 50, color: o.color, children });
const spec = {
  meta: {
    title: "Cloud-agnostic enterprise AI platform across AWS, Azure and Google Cloud",
    subtitle: "One AI gateway and portable Kubernetes agent runtime route requests to the best model on any cloud; knowledge, guardrails, identity and observability are shared across all three",
    output: "examples/multi-cloud-ai-platform/out/architecture.html",
    lens: ["framework", "generative-ai"],
  },
  root: {
    layout: "column", gap: 70,
    children: [
      {
        id: "main", kind: "stack", layout: "row", gap: 80,
        children: [
          { id: "clients", kind: "stack", layout: "column", gap: 70, children: [
            n("users", "users", "Employees and apps", "chat, API, copilots"),
            n("entra", "gen:azure-entra-id", "Microsoft Entra ID", "single sign-on, OIDC"),
          ] },
          g("edge", "AI gateway and safety (Google Cloud)", [
            n("apigee", "apigee-api-platform", "Apigee AI gateway", "quotas, routing policy"),
            n("armor", "data-loss-prevention-api", "Model Armor", "prompt and response screening"),
            n("safety", "gen:azure-content-safety", "Azure AI Content Safety", "groundedness, jailbreak"),
          ], { color: "#4285F4" }),
          g("runtime", "Portable agent runtime (same Helm charts, GitOps)", [
            n("gke", "kubernetes-engine", "Agent orchestrator", "GKE, primary"),
            n("aks", "gen:azure-aks", "Agent workers", "AKS, Microsoft 365 data"),
            n("eks", "gen:aws-eks", "Agent workers", "EKS, regulated workloads"),
          ], { kind: "generic-dashed" }),
          g("models", "Model plane (routed by cost, latency, residency)", [
            n("gemini", "vertexai", "Gemini", "Vertex AI"),
            n("aoai", "gen:azure-openai", "GPT models", "Azure OpenAI"),
            n("bedrock", "gen:aws-bedrock", "Claude and Nova", "Amazon Bedrock"),
          ]),
          g("know", "Shared knowledge and data", [
            n("s3", "gen:aws-s3", "Data lake", "Amazon S3"),
            n("lf", "gen:aws-lake-formation", "Data governance", "Lake Formation"),
            n("search", "gen:azure-ai-search", "Vector index", "Azure AI Search"),
            n("bq", "bigquery", "Analytics and embeddings", "BigQuery"),
          ]),
        ],
      },
      {
        id: "base", kind: "stack", layout: "row", gap: 80,
        children: [
          g("net", "Private connectivity", [
            n("ic", "cloud-interconnect", "Cloud Interconnect", "Google Cloud"),
            n("dc", "gen:aws-direct-connect", "Direct Connect", "AWS"),
            n("er", "gen:azure-expressroute", "ExpressRoute", "Azure"),
          ], { layout: "row", gap: 60 }),
          g("ops", "Security and observability", [
            n("kv", "gen:azure-key-vault", "Key Vault", "secrets, keys"),
            n("log", "cloud-logging", "Cloud Logging", "OpenTelemetry sink"),
            n("cw", "gen:aws-cloudwatch", "CloudWatch", "AWS runtime metrics"),
            n("mon", "gen:azure-monitor", "Azure Monitor", "Azure runtime metrics"),
          ], { layout: "row", gap: 60 }),
        ],
      },
    ],
  },
  edges: [
    { from: "users", to: "apigee", step: 1, label: "chat / API" },
    { from: "entra", to: "apigee", style: "dashed", label: "OIDC" },
    { from: "apigee", to: "armor", step: 2 },
    { from: "armor", to: "gke", step: 3, label: "safe prompt" },
    { from: "gke", to: "gemini", step: 4, label: "route" },
    { from: "aks", to: "aoai", step: 4 },
    { from: "eks", to: "bedrock", step: 4 },
    { from: "gke", to: "search", step: 5, label: "retrieve" },
    { from: "s3", to: "search", step: 6, label: "index" },
    { from: "s3", to: "bq", style: "dashed", label: "BigLake" },
    { from: "gke", to: "aks", style: "dashed" },
    { from: "gke", to: "eks", style: "dashed" },
    { from: "safety", to: "armor", style: "dashed", label: "ensemble" },
    { from: "ic", to: "dc", style: "dashed", label: "private backbone" },
    { from: "dc", to: "er", style: "dashed" },
  ],
};
fs.writeFileSync(new URL("./architecture.json", import.meta.url), JSON.stringify(spec, null, 2) + "\n");
