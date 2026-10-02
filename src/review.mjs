// Heuristic Google Cloud Well-Architected review of a diagram spec. It reads WHICH services and groups are drawn and how they
// connect; it cannot see configuration, so every result is advisory ("consider"/"gap" to confirm), never a verdict.
// Rules map to the six framework pillars and, for Vertex AI / generative AI workloads, to the framework's AI and ML perspective.
// The Well-Architected engine (src/wa/) turns these findings into recommendation outcomes.
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./catalog.mjs";

const WA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "well-architected.json"), "utf8"));
export const PILLAR_INFO = WA.framework.pillars;
export const AI_GUIDANCE = WA["ai-workloads"];

const STATEFUL = ["cloud-sql", "cloud-spanner", "bigtable", "firestore", "datastore", "memorystore", "alloydb", "bigquery"];
const DATA = [...STATEFUL, "cloud-storage", "persistent-disk", "filestore", "hyperdisk", "dataproc-metastore"];
const EDGE = ["cloud-load-balancing", "cloud-cdn", "apigee-api-platform", "cloud-api-gateway", "cloud-endpoints", "cloud-run"];
const OBS = ["cloud-monitoring", "cloud-logging", "cloud-ops", "trace", "error-reporting", "profiler", "stackdriver"];
const COMPUTE = ["compute-engine", "kubernetes-engine", "cloud-run", "cloud-functions", "app-engine", "batch", "vmware-engine", "anthos"];
const MODEL = ["vertexai", "category-agents", "ai-platform", "ai-platform-unified", "automl", "ai-hypercomputer", "dialogflow", "dialogflow-cx", "agent-assist"];
const USERS = ["users", "user", "mobile", "browser", "internet"];

export function reviewSpec(spec, model) {
  const nodes = Object.values(model.nodes).map((n) => ({ id: n.id, svc: n.icon.kind === "service" ? n.icon.entry.id : null, kind: n.icon.kind, gen: n.icon.kind === "general" ? n.icon.entry.id : null, label: `${n.item.label || n.id} ${n.item.sublabel || ""}`, parent: n.parent }));
  const groups = model.groups;
  const byId = (id) => nodes.find((n) => n.id === id);
  const ofSvc = (...ids) => nodes.filter((n) => n.svc && ids.includes(n.svc));
  const has = (...ids) => ofSvc(...ids).length > 0;
  const labelHas = (re) => nodes.filter((n) => re.test(n.label) || re.test(n.id));
  const ancestors = (id) => { const out = []; let g = groups.find((x) => x.id === (byId(id)?.parent ?? id)); while (g) { out.push(g); g = groups.find((x) => x.id === g.parent); } return out; };
  const zoneCount = groups.filter((g) => g.kind === "zone").length;
  const isAI = (spec.meta.lens || []).includes("generative-ai") || has(...MODEL.filter((m) => !["dialogflow", "dialogflow-cx", "agent-assist"].includes(m)));
  const perimeter = groups.some((g) => g.kind === "perimeter");
  const findings = [];
  const add = (pillar, id, status, title, detail, nodesIds = [], lens = "framework") => findings.push({ pillar, id, status, title, detail, nodes: nodesIds.map((n) => n.id || n), lens });

  // ---- Security, privacy, and compliance
  const entry = ofSvc(...EDGE).filter((n) => n.svc !== "cloud-run" || (spec.edges || []).some((e) => e.to === n.id && USERS.includes(byId(e.from)?.gen)));
  if (entry.length) {
    const waf = has("cloud-armor") || labelHas(/cloud armor|\bwaf\b|web application firewall|ddos/i).length;
    add("security", "SEC-EDGE", waf ? "ok" : "gap", waf ? "Edge protection present" : "Internet-facing entry has no Cloud Armor / DDoS protection shown",
      "Protect public entry points (Cloud Load Balancing, Apigee, API Gateway) with Cloud Armor security policies (WAF rules, rate limiting, DDoS protection) and restrict backends to the load balancer.", waf ? ofSvc("cloud-armor") : entry);
  }
  const dbDirect = (spec.edges || []).filter((e) => { const a = byId(e.from), b = byId(e.to); return a && b && USERS.includes(a.gen) && STATEFUL.includes(b.svc); });
  if (dbDirect.length) add("security", "SEC-DB-PUBLIC", "gap", "Data store reached directly from clients", "Keep databases off the internet: use private IP (Private Service Access / Private Service Connect), no public IPs, and let only the application tier connect.", dbDirect.map((e) => e.to));
  else if (nodes.some((n) => STATEFUL.includes(n.svc))) add("security", "SEC-DB-PRIVATE", "ok", "Data stores are not reached directly from clients", "Least-privilege network placement for stateful services.", []);
  const paas = ofSvc(...DATA, "secret-manager", "key-management-service");
  if (paas.length) {
    const priv = has("private-service-connect", "private-connectivity", "access-context-manager") || perimeter || labelHas(/private service connect|private google access|private ip|vpc service controls|vpc-sc/i).length;
    add("security", "SEC-PRIVATE-ACCESS", priv ? "ok" : "consider", priv ? "Private access / service perimeter shown" : "No private access or VPC Service Controls shown for managed data services",
      "Reach Google APIs and managed data services privately (Private Google Access, Private Service Connect) and wrap sensitive projects in a VPC Service Controls perimeter to prevent exfiltration.", ofSvc("private-service-connect", "access-context-manager"));
  }
  if (ofSvc(...DATA).length) {
    const kms = has("key-management-service", "cloud-hsm", "cloud-ekm") || labelHas(/cmek|customer.managed (encryption )?key|cloud kms|\bkms\b/i).length;
    add("security", "SEC-ENCRYPT", kms ? "ok" : "consider", kms ? "Key management shown" : "No Cloud KMS shown for data at rest",
      "Data is encrypted by default; use Cloud KMS customer-managed keys (CMEK, or Cloud HSM / EKM) where you need rotation, access policy or audit control, and enforce TLS in transit.", ofSvc("key-management-service", "cloud-hsm", "cloud-ekm"));
  }
  if (entry.length || nodes.some((n) => USERS.includes(n.gen))) {
    const authn = has("identity-and-access-management", "identity-platform", "identity-aware-proxy", "beyondcorp", "workload-identity-pool") || labelHas(/\biam\b|identity platform|firebase auth|oidc|saml|sso|iap|service account|workload identity/i).length;
    add("security", "SEC-IDENTITY", authn ? "ok" : "consider", authn ? "Identity service shown" : "No identity / authentication service shown",
      "Authenticate and authorize every request: Identity-Aware Proxy or Identity Platform for users, IAM with least privilege and dedicated service accounts (Workload Identity) for workloads.", ofSvc("identity-and-access-management", "identity-platform", "identity-aware-proxy"));
  }
  if (nodes.length >= 4) {
    const detect = has("security-command-center", "cloud-audit-logs", "cloud-ids", "security-operations", "security-health-advisor") || labelHas(/security command center|\bscc\b|chronicle|secops|audit logs?|cloud ids/i).length;
    add("security", "SEC-DETECT", detect ? "ok" : "consider", detect ? "Threat detection / posture services shown" : "No threat detection or posture management shown",
      "Enable Security Command Center for posture and threat detection, Cloud Audit Logs (Data Access where needed) and Cloud IDS, and route security logs to a central, access-restricted sink.", ofSvc("security-command-center", "cloud-audit-logs", "cloud-ids"));
  }
  if (ofSvc("cloud-sql", "alloydb", "cloud-spanner", "firestore", "bigtable").length) {
    const sec = has("secret-manager", "key-management-service", "workload-identity-pool", "identity-and-access-management") || labelHas(/secret manager|iam database auth|workload identity|service account/i).length;
    add("security", "SEC-SECRETS", sec ? "ok" : "consider", sec ? "Secrets / passwordless access shown" : "No Secret Manager or IAM database authentication shown",
      "Store secrets in Secret Manager or, better, use IAM database authentication and service-account identities so no credentials are embedded.", ofSvc("secret-manager", "key-management-service"));
  }

  // ---- Reliability
  const stateful = nodes.filter((n) => [...STATEFUL, "compute-engine"].includes(n.svc));
  if (stateful.length) {
    const hasLoc = zoneCount || groups.some((g) => g.kind === "region") || ofSvc("compute-engine").length;
    if (hasLoc) {
      const multi = zoneCount >= 2 || labelHas(/multi-?zone|multi-?region|regional (mig|cluster|ha)|high availability|\bha\b|zonal redundan|dual-?region|failover replica/i).length > 0;
      add("reliability", "REL-ZONES", multi ? "ok" : "gap", multi ? "Workload spans multiple zones" : "Workload is drawn in a single (or no) zone",
        "Deploy across at least two zones (regional managed instance groups, regional GKE clusters, Cloud SQL / AlloyDB high availability) and use multi-region or dual-region storage and databases where the SLO needs it.", multi ? [] : stateful);
    }
  }
  if (ofSvc("compute-engine").length) {
    const scale = labelHas(/managed instance group|\bmig\b|autoscal|instance template/i).length > 0;
    add("reliability", "REL-SCALE", scale ? "ok" : "consider", scale ? "Managed instance groups / autoscale shown" : "Compute Engine VMs without a managed instance group or autoscale",
      "Run VMs in regional managed instance groups with autoscaling and autohealing (or use Cloud Run, GKE or App Engine) so capacity follows demand and failed instances are replaced.", ofSvc("compute-engine"));
  }
  if (ofSvc("cloud-sql", "alloydb", "cloud-spanner", "firestore", "bigtable", "cloud-storage", "persistent-disk", "compute-engine", "filestore").length) {
    const bk = labelHas(/backup|replica|snapshot|point.in.time|pitr|restore|dr\b|disaster|object versioning|dual-?region/i).length;
    add("reliability", "REL-BACKUP", bk ? "ok" : "consider", bk ? "Backup / recovery shown" : "No backup or recovery capability shown",
      "Define RPO/RTO and protect data with Backup and DR Service, automated backups and point-in-time recovery, snapshots, object versioning and cross-region replicas, and test restores.", []);
  }
  if (entry.length && ofSvc(...COMPUTE).length >= 2) {
    const async = has("pubsub", "cloud-tasks", "eventarc", "workflows", "cloud-scheduler") || labelHas(/queue|topic|pub\/?sub|eventarc|cloud tasks/i).length;
    add("reliability", "REL-DECOUPLE", async ? "ok" : "consider", async ? "Asynchronous decoupling shown" : "No queue / event service shown between tiers",
      "Decouple components with Pub/Sub, Cloud Tasks or Eventarc so spikes and downstream failures do not cascade; add retries with exponential backoff, timeouts and load shedding.", ofSvc("pubsub", "cloud-tasks", "eventarc"));
  }

  // ---- Operational excellence
  if (nodes.length >= 3) {
    const obs = has(...OBS) || labelHas(/observab|monitor|logging|prometheus|grafana|cloud trace|operations suite/i).length;
    add("operational-excellence", "OPS-OBSERVE", obs ? "ok" : "gap", obs ? "Observability shown" : "No monitoring / observability shown",
      "Collect metrics, logs and traces with Cloud Monitoring, Cloud Logging, Cloud Trace and Managed Service for Prometheus, define SLOs and alert on burn rate.", ofSvc(...OBS));
    const iac = has("cloud-build", "cloud-deploy", "cloud-deployment-manager", "configuration-management", "anthos-config-management") || labelHas(/terraform|config connector|infrastructure manager|cloud build|ci\/?cd|pipeline|github actions|gitops/i).length;
    add("operational-excellence", "OPS-IAC", iac ? "ok" : "consider", iac ? "IaC / delivery pipeline shown" : "No infrastructure-as-code or CI/CD shown",
      "Define infrastructure as code (Terraform / Infrastructure Manager or Config Connector) and deploy through Cloud Build and Cloud Deploy with small, reversible changes and automated rollback.", ofSvc("cloud-build", "cloud-deploy"));
  }

  // ---- Performance optimization
  if (entry.length && nodes.some((n) => USERS.includes(n.gen))) {
    const cdn = has("cloud-cdn") || labelHas(/\bcdn\b|media cdn/i).length;
    add("performance-optimization", "PERF-EDGE", cdn ? "ok" : "consider", cdn ? "Edge delivery shown" : "No CDN / global edge shown for end users",
      "Serve cacheable content from Google's edge with Cloud CDN or Media CDN behind the global external Application Load Balancer to cut latency.", ofSvc("cloud-cdn"));
  }
  if (ofSvc("cloud-sql", "alloydb").length) {
    const cache = has("memorystore", "cloud-cdn") || labelHas(/cache|redis|memcached|read replica/i).length;
    add("performance-optimization", "PERF-CACHE", cache ? "ok" : "consider", cache ? "Caching shown" : "Relational database with no cache / read scaling shown",
      "Add caching (Memorystore, Cloud CDN) or read replicas for read-heavy access, and choose the data store that fits the access pattern.", ofSvc("memorystore"));
  }

  // ---- Cost optimization
  if (nodes.length >= 3) {
    const fin = has("billing") || labelHas(/budget|billing|finops|cost/i).length;
    add("cost-optimization", "COST-VISIBILITY", fin ? "ok" : "consider", fin ? "Cost visibility shown" : "No cost visibility shown",
      "Label resources consistently, export billing data to BigQuery and set Cloud Billing budgets and alerts so spend maps to workloads and owners.", ofSvc("billing"));
  }

  // ---- Sustainability
  if (nodes.length >= 3) {
    const managed = has("cloud-run", "cloud-functions", "app-engine", "kubernetes-engine", "bigquery", "pubsub", "dataflow") ;
    const carbon = labelHas(/carbon|cfe|low.carbon|sustainab|lowest.carbon/i).length;
    add("sustainability", "SUS-REGION", carbon ? "ok" : "consider", carbon ? "Carbon-aware placement mentioned" : "Region choice is not tied to carbon intensity",
      "Choose regions using Google's carbon-free energy (CFE%) data and grid carbon intensity when latency and data residency allow; use the Carbon Footprint report to track emissions.", []);
    add("sustainability", "SUS-MANAGED", managed ? "ok" : "consider", managed ? "Managed / serverless services shown" : "No managed or serverless services shown",
      "Prefer managed and serverless services with automatic scaling, schedule batch work for low-carbon periods and right-size resources.", ofSvc("cloud-run", "cloud-functions", "app-engine", "kubernetes-engine"));
  }

  // ---- AI workloads (Vertex AI, agents, generative AI)
  if (isAI) {
    const L = "generative-ai";
    const mods = ofSvc(...MODEL);
    const guard = labelHas(/model armor|guardrail|safety (filter|setting|attribute)|content (safety|filter)|prompt (injection|shield)|responsible ai|sensitive data protection|dlp/i).length || has("data-loss-prevention-api") || spec.meta.guardrails === true;
    add("security", "AI-SAFETY", guard ? "ok" : "gap", guard ? "Model safety controls shown" : "No safety controls around model input/output",
      "Apply Model Armor or Vertex AI safety filters to prompts and responses, screen for prompt injection and use Sensitive Data Protection to find and mask PII before it reaches the model.", mods, L);
    const log = has(...OBS, "cloud-audit-logs", "bigquery", "cloud-storage") || labelHas(/diagnostic|trace|observab|audit|request.response logging/i).length;
    add("operational-excellence", "AI-OBSERVE", log ? "ok" : "gap", log ? "Model telemetry destination shown" : "No model logging / observability shown",
      "Log model requests and responses (Vertex AI request-response logging to BigQuery), monitor latency, errors and token usage in Cloud Monitoring, and keep an audit trail of model and agent calls.", mods, L);
    const direct = (spec.edges || []).filter((e) => { const a = byId(e.from), b = byId(e.to); return a && b && USERS.includes(a.gen) && MODEL.includes(b.svc); });
    if (direct.length) add("security", "AI-ENDPOINT", "gap", "Clients call the model directly", "Front models with an authenticated, throttled gateway (Apigee, API Gateway or an app tier on Cloud Run) rather than exposing them to clients; validate inputs.", direct.map((e) => e.to), L);
    const inVpc = nodes.some((n) => COMPUTE.includes(n.svc) && ancestors(n.id).some((g) => g.kind === "vpc"));
    if (inVpc) {
      const pl = has("private-service-connect", "access-context-manager") || perimeter || labelHas(/private service connect|private google access|vpc service controls|vpc-sc/i).length;
      add("security", "AI-PRIVATE", pl ? "ok" : "consider", pl ? "Private model connectivity shown" : "VPC compute calls model APIs without Private Service Connect / VPC-SC shown",
        "Keep prompts and responses off the public internet: use Private Service Connect for Google APIs and a VPC Service Controls perimeter around Vertex AI and its data.", mods, L);
    }
    const retrieval = has("alloydb", "cloud-sql", "cloud-spanner", "bigquery", "firestore", "bigtable") || labelHas(/vector|knowledge base|rag|retriev|grounding|vertex ai search/i).length;
    add("performance-optimization", "AI-RETRIEVAL", retrieval ? "ok" : "consider", retrieval ? "Retrieval / grounding data shown" : "No retrieval / grounding data source shown",
      "Ground responses in enterprise data (RAG with Vertex AI Search, Vector Search or a vector-enabled database such as AlloyDB) and measure retrieval quality; version prompts, models and data sources.", ofSvc("alloydb", "bigquery", "cloud-spanner"), L);
    const regions = groups.filter((g) => g.kind === "region").length;
    add("reliability", "AI-RESILIENCE", regions >= 2 || labelHas(/multi-?region|global endpoint|provisioned throughput|dynamic shared quota|fallback/i).length ? "ok" : "consider", regions >= 2 ? "Multiple regions shown" : "Single-region model inference",
      "Plan for quota and 429 errors (retries with backoff, Provisioned Throughput, the global endpoint, a second region or a fallback model).", mods, L);
    add("cost-optimization", "AI-COST", labelHas(/cache|batch|router|flash|smaller model|context caching/i).length ? "ok" : "consider", "Model cost controls",
      "Choose the smallest model that meets quality targets, use context caching and batch prediction where possible, and track tokens and cost per request.", mods, L);
    if (labelHas(/\bagent\b/i).length) add("security", "AI-AGENCY", labelHas(/human|approval|least.privilege|service account/i).length ? "ok" : "consider", "Agents and excessive agency",
      "Give agents dedicated least-privilege service accounts and scoped tools, validate tool inputs and outputs, and require human approval for high-impact actions.", ofSvc("vertexai"), L);
  }

  const order = Object.keys(PILLAR_INFO);
  findings.sort((a, b) => order.indexOf(a.pillar) - order.indexOf(b.pillar) || (a.status === "ok") - (b.status === "ok"));
  const summary = Object.fromEntries(order.map((p) => [p, { gap: 0, consider: 0, ok: 0 }]));
  for (const f of findings) summary[f.pillar][f.status]++;
  return { findings, summary, genAI: isAI };
}
