// Writes the three per-cloud panel specs. Each is rendered by its own archify tool (aws / azure / gcp), then compose.mjs stitches them.
import fs from "node:fs";
const n = (id, icon, label, sublabel) => ({ id, icon, label, sublabel });
const row = (id, ...children) => ({ id, kind: "stack", layout: "row", gap: 60, children });
const col = (id, ...children) => ({ id, kind: "stack", layout: "column", gap: 60, children });
const cols = (id, l, r) => ({ id, kind: "stack", layout: "row", gap: 70, children: [l, r] });
const write = (name, spec) => fs.writeFileSync(new URL(`./panels/${name}.json`, import.meta.url), JSON.stringify(spec, null, 2) + "\n");

write("azure", {
  meta: { title: "Microsoft Azure", subtitle: "Identity, Azure OpenAI, AI Search and safety", output: "examples/multi-cloud-ai-platform/panels/out/azure.html" },
  root: { kind: "azure-cloud", layout: "column", gap: 40, children: [
    { id: "az-sub", kind: "subscription", label: "AI platform subscription", layout: "column", gap: 60, children: [
      cols("az", col("azl",
        n("users", "users", "Employees and apps", "chat, API, copilots"),
        n("mon", "monitor", "Azure Monitor", "runtime metrics"),
        n("openai", "openai", "GPT models", "Azure OpenAI"),
        n("kv", "key-vaults", "Key Vault", "secrets, keys")),
        col("azr",
        n("entra", "entra-id", "Microsoft Entra ID", "single sign-on"),
        n("safety", "content-safety", "Azure AI Content Safety", "groundedness, jailbreak"),
        n("aks", "kubernetes-services", "Agent workers", "AKS, Microsoft 365 data"),
        n("search", "cognitive-search", "Vector index", "Azure AI Search"),
        n("er", "expressroute-circuits", "ExpressRoute", "private circuit"))),
    ] },
  ] },
  edges: [
    { from: "users", to: "entra", step: 1, label: "sign in" },
    { from: "aks", to: "openai", step: 5, label: "inference" },
  ],
});

write("gcp", {
  meta: { title: "Google Cloud", subtitle: "AI gateway, orchestrator, Gemini and analytics", output: "examples/multi-cloud-ai-platform/panels/out/gcp.html" },
  root: { kind: "gcp-cloud", layout: "column", gap: 40, children: [
    { id: "gcp-proj", kind: "project", label: "ai-platform-hub", layout: "column", gap: 60, children: [
      cols("gc", col("gcl",
        n("apigee", "apigee-api-platform", "Apigee AI gateway", "quotas, routing policy"),
        n("armor", "data-loss-prevention-api", "Model Armor", "prompt screening"),
        n("gke", "kubernetes-engine", "Agent orchestrator", "GKE, primary"),
        n("ic", "cloud-interconnect", "Cloud Interconnect", "private backbone")),
        col("gcr",
        n("log", "cloud-logging", "Cloud Logging", "OpenTelemetry sink"),
        n("bq", "bigquery", "BigQuery", "analytics, embeddings"),
        n("gemini", "vertexai", "Gemini", "Vertex AI"))),
    ] },
  ] },
  edges: [
    { from: "apigee", to: "armor", step: 3 },
    { from: "armor", to: "gke", step: 4, label: "safe prompt" },
    { from: "gke", to: "gemini", step: 5, label: "route" },
  ],
});

write("aws", {
  meta: { title: "Amazon Web Services", subtitle: "Bedrock models, regulated workloads and the data lake", output: "examples/multi-cloud-ai-platform/panels/out/aws.html" },
  root: { kind: "aws-cloud", layout: "column", gap: 40, children: [
    { id: "aws-region", kind: "region", label: "us-east-1", layout: "column", gap: 60, children: [
      cols("aw", col("awl",
        n("kms", "key-management-service", "KMS", "data lake keys"),
        n("s3", "simple-storage-service", "Data lake", "Amazon S3"),
        n("eks", "elastic-kubernetes-service", "Agent workers", "EKS, regulated workloads"),
        n("dc", "direct-connect", "Direct Connect", "private circuit")),
        col("awr",
        n("cw", "cloudwatch", "CloudWatch", "runtime metrics"),
        n("lf", "lake-formation", "Data governance", "Lake Formation"),
        n("bedrock", "bedrock", "Claude and Nova", "Amazon Bedrock"))),
    ] },
  ] },
  edges: [
    { from: "eks", to: "bedrock", step: 5, label: "inference" },
    { from: "s3", to: "lf", style: "dashed", label: "governed" },
  ],
});
