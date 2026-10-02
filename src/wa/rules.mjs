// Evidence rules: what a diagram (and the cost estimate) can say about specific Google Cloud Well-Architected recommendations.
// Every recommendation id used here (REL-3.1, SEC-1.4 …) is validated against the corpus (see test) — ids are never invented.
// Statuses: Implemented | Partially Implemented | Not Implemented | Not Applicable | Cannot Determine.
// A diagram shows architecture, not process or configuration, so most recommendations stay "Cannot Determine"; that is reported, not hidden.

export const STATUS = ["Implemented", "Partially Implemented", "Not Implemented", "Not Applicable", "Cannot Determine"];
export const OWNER = { reliability: "Platform / SRE", security: "Security engineering", "cost-optimization": "FinOps + engineering", "operational-excellence": "DevOps / SRE", "performance-optimization": "Application team", sustainability: "Platform + FinOps" };

/** Rules derived from the heuristic findings in review.mjs: legacy id -> recommendation outcomes. `ai: true` marks AI workload rules. */
export const LEGACY_RULES = [
  { legacy: "SEC-EDGE", fw: {"SEC-2.1": {}, "SEC-1.2": {}}, impact: "Moderate", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Put Cloud Armor security policies (WAF rules, rate limiting, DDoS protection) in front of every internet-facing load balancer or API entry point; start in preview mode, then enforce.", measure: "100% of public endpoints behind a Cloud Armor policy" },
  { legacy: "SEC-DB-PUBLIC", fw: {"SEC-2.1": {}, "SEC-1.2": {}}, impact: "Severe", likelihood: "Medium", effort: "Low", weeks: 1,
    rec: "Move databases and caches off the internet: private IP only (Private Service Access or Private Service Connect), no public IPs, access only from the application tier through its service account.", measure: "No stateful store reachable from the internet or directly from clients" },
  { legacy: "SEC-DB-PRIVATE", fw: {"SEC-2.1": {}}, impact: "Moderate", likelihood: "Low", effort: "Low", weeks: 1,
    rec: "Keep stateful stores on private networks.", measure: "—" },
  { legacy: "SEC-PRIVATE-ACCESS", fw: {"SEC-2.1": {}, "SEC-7.10": {}}, impact: "Moderate", likelihood: "Medium", effort: "Medium", weeks: 3,
    rec: "Reach Google APIs and managed data services through Private Google Access or Private Service Connect and put sensitive projects inside a VPC Service Controls perimeter.", measure: "Every sensitive project inside a service perimeter; no public endpoints for data services" },
  { legacy: "SEC-ENCRYPT", fw: {"SEC-1.4": {}}, impact: "Severe", likelihood: "Low", effort: "Low", weeks: 2,
    rec: "Use Cloud KMS customer-managed keys (CMEK, Cloud HSM or EKM where required) with rotation and key-access audit logging for data at rest, and enforce TLS in transit.", measure: "All regulated data stores use CMEK; keys rotate automatically" },
  { legacy: "SEC-IDENTITY", fw: {"SEC-2.2": {}}, impact: "Severe", likelihood: "Medium", effort: "Medium", weeks: 4,
    rec: "Authenticate and authorize every request: Identity-Aware Proxy or Identity Platform for users, least-privilege IAM roles and dedicated service accounts with Workload Identity for workloads.", measure: "All user and workload access authenticated; no shared or default service accounts" },
  { legacy: "SEC-DETECT", fw: {"SEC-2.3": {}, "SEC-4.1": {}}, impact: "Moderate", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Enable Security Command Center (Premium where justified), Cloud Audit Logs including Data Access for sensitive services, and Cloud IDS; route security logs to a central, access-restricted sink.", measure: "Security Command Center active at the organization level; audit logs retained and alerting" },
  { legacy: "SEC-SECRETS", fw: {"SEC-2.2": {}, "SEC-7.10": {}}, impact: "Severe", likelihood: "Medium", effort: "Low", weeks: 1,
    rec: "Use IAM database authentication and service-account identities, and keep any remaining secrets in Secret Manager with rotation.", measure: "No credentials in code, images or environment variables" },
  { legacy: "REL-ZONES", fw: {"REL-3.1": {}}, impact: "Severe", likelihood: "Medium", effort: "Medium", weeks: 4,
    rec: "Deploy across at least two zones: regional managed instance groups, regional GKE clusters, high-availability Cloud SQL / AlloyDB, and multi-region or dual-region storage and databases where the SLO requires it.", measure: "Workload survives loss of one zone in a game day" },
  { legacy: "REL-SCALE", fw: {"REL-4.1": {}, "OE-3.2": {}}, considerAs: "Not Implemented", impact: "Moderate", likelihood: "Medium", effort: "Medium", weeks: 3,
    rec: "Use regional managed instance groups with autoscaling and autohealing, or move to managed compute (Cloud Run, GKE, App Engine) so capacity follows demand and failed instances are replaced automatically.", measure: "Capacity scales with load and unhealthy instances are replaced without manual action" },
  { legacy: "REL-BACKUP", fw: {"REL-8.2": {}, "REL-8.1": {}}, impact: "Severe", likelihood: "Low", effort: "Low", weeks: 2,
    rec: "Protect data with Backup and DR Service or automated backups with point-in-time recovery, snapshots, object versioning and cross-region replicas, and test restores against your RPO/RTO.", measure: "Automated backups with a successful restore test each quarter" },
  { legacy: "REL-DECOUPLE", fw: {"REL-6.3": {}, "PERF-3.1": {}}, impact: "Moderate", likelihood: "Medium", effort: "Medium", weeks: 4,
    rec: "Decouple tiers with Pub/Sub, Cloud Tasks or Eventarc so traffic spikes and downstream failures do not cascade; add retries with exponential backoff, timeouts and load shedding.", measure: "Downstream outage does not fail upstream requests; queues absorb bursts" },
  { legacy: "OPS-OBSERVE", fw: {"OE-1.2": {}, "REL-5.1": {}, "PERF-4.2": {}}, impact: "Moderate", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Collect metrics, logs and traces with Cloud Monitoring, Cloud Logging and Cloud Trace (or Managed Service for Prometheus), define SLOs and alert on error-budget burn rate.", measure: "Dashboards and SLO alerts for every tier; mean time to detect < 5 minutes" },
  { legacy: "OPS-IAC", fw: {"OE-4.1": {}, "OE-4.3": {}}, impact: "Moderate", likelihood: "Medium", effort: "Medium", weeks: 4,
    rec: "Define infrastructure as code (Terraform / Infrastructure Manager or Config Connector) and deploy through Cloud Build and Cloud Deploy with small, reversible changes, environment promotion and automated rollback.", measure: "100% of production changes deployed from a pipeline" },
  { legacy: "PERF-EDGE", fw: {"PERF-2.1": {}}, impact: "Minor", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Serve cacheable content from Google's edge with Cloud CDN or Media CDN behind the global external Application Load Balancer to reduce latency.", measure: "p95 latency for remote users reduced against baseline" },
  { legacy: "PERF-CACHE", fw: {"PERF-3.6": {}, "PERF-2.1": {}}, impact: "Minor", likelihood: "Medium", effort: "Medium", weeks: 3,
    rec: "Add caching (Memorystore, Cloud CDN) or read replicas for read-heavy access.", measure: "Cache hit ratio above target; database read load reduced" },
  { legacy: "COST-VISIBILITY", fw: {"COST-2.1": {}, "COST-2.6": {}, "COST-2.7": {}}, impact: "Minor", likelihood: "High", effort: "Low", weeks: 1,
    rec: "Apply a consistent label scheme, export billing data to BigQuery and set Cloud Billing budgets with alert thresholds so spend maps to this workload and its owner.", measure: "Budget alerts active; 100% of resources labelled" },
  { legacy: "SUS-REGION", fw: {"SUS-1.1": {}, "SUS-1.2": {}}, impact: "Minor", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Compare candidate regions by carbon-free energy percentage and grid carbon intensity (Google Cloud region picker) and use the Carbon Footprint report to track emissions.", measure: "Region choice documented with CFE% and latency; emissions reported monthly" },
  { legacy: "SUS-MANAGED", fw: {"SUS-3.1": {}, "SUS-3.5": {}}, impact: "Minor", likelihood: "Medium", effort: "Medium", weeks: 4,
    rec: "Prefer managed and serverless services with automatic scaling, schedule batch and non-urgent work for low-carbon periods and right-size what remains.", measure: "Idle capacity below target; batch work scheduled for low-carbon windows" },
  // ---- AI workloads (Vertex AI, agents, generative AI)
  { legacy: "AI-SAFETY", ai: true, fw: {"SEC-5.5": {}, "SEC-5.2": {}}, impact: "Severe", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Apply Model Armor or Vertex AI safety filters to prompts and responses, screen for prompt injection, and use Sensitive Data Protection to find and mask PII before it reaches the model.", measure: "Safety controls enforced on 100% of model calls; interventions logged" },
  { legacy: "AI-OBSERVE", ai: true, fw: {"OE-1.2": {}, "PERF-4.2": {}}, impact: "Moderate", likelihood: "Medium", effort: "Low", weeks: 2,
    rec: "Enable Vertex AI request-response logging to BigQuery, monitor latency, errors and token usage in Cloud Monitoring, and keep an audit trail of model and agent calls.", measure: "Logging on for all model endpoints; dashboards for latency, tokens and safety events" },
  { legacy: "AI-ENDPOINT", ai: true, fw: {"SEC-2.1": {}, "SEC-5.4": {}}, impact: "Severe", likelihood: "Medium", effort: "Medium", weeks: 3,
    rec: "Front models with an authenticated, throttled gateway (Apigee, API Gateway or an app tier on Cloud Run) instead of exposing them to clients; validate and sanitize inputs.", measure: "No client reaches a model endpoint except through the gateway" },
  { legacy: "AI-PRIVATE", ai: true, fw: {"SEC-2.1": {}, "SEC-5.2": {}}, impact: "Moderate", likelihood: "Low", effort: "Low", weeks: 2,
    rec: "Use Private Service Connect for Google APIs and a VPC Service Controls perimeter around Vertex AI and its data so prompts, responses and training data stay private.", measure: "Model API traffic from VPC compute uses Private Service Connect inside a perimeter" },
  { legacy: "AI-RETRIEVAL", ai: true, fw: {"PERF-3.6": {}, "SEC-5.8": {}}, okAs: "Cannot Determine", impact: "Minor", likelihood: "Medium", effort: "Medium", weeks: 4,
    rec: "Ground responses in enterprise data (RAG with Vertex AI Search, Vector Search or AlloyDB vector support), track data lineage and measure retrieval relevance and latency.", measure: "Retrieval quality measured on a labelled set" },
  { legacy: "AI-RESILIENCE", ai: true, fw: {"REL-3.1": {}, "REL-6.1": {}, "REL-6.3": {}}, impact: "Moderate", likelihood: "Low", effort: "Medium", weeks: 4,
    rec: "Plan for quota and 429 errors (retries with exponential backoff, Provisioned Throughput, dynamic shared quota, the global endpoint, a second region or a fallback model).", measure: "Inference continues within SLO when the primary endpoint is throttled" },
  { legacy: "AI-COST", ai: true, fw: {"COST-3.2": {}, "COST-3.4": {}}, impact: "Minor", likelihood: "High", effort: "Low", weeks: 2,
    rec: "Select the smallest model that meets quality targets; use context caching and batch prediction where possible; track cost per request.", measure: "Cost per request tracked and below target" },
  { legacy: "AI-AGENCY", ai: true, fw: {"SEC-5.9": {}, "SEC-2.2": {}}, impact: "Severe", likelihood: "Medium", effort: "Medium", weeks: 3,
    rec: "Give agents dedicated least-privilege service accounts and scoped tools, enforce policy at the tool boundary and add human approval for high-impact actions.", measure: "Every tool call authorized; high-impact actions require approval" },
];

const money = (x) => "$" + Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Procedural rules. Each returns {title, fw: {id: {status, evidence, …}}, nodes} or null when it does not apply. */
export const PROCEDURAL_RULES = [
  { id: "SEGMENTATION", pillar: "security", evaluate(ctx) {
      const perim = ctx.groups.filter((g) => g.kind === "perimeter"), vpcs = ctx.groups.filter((g) => g.kind === "vpc"), subnets = ctx.groups.filter((g) => g.kind === "subnet"), projects = ctx.groups.filter((g) => g.kind === "project"), fwr = ctx.groups.filter((g) => g.kind === "firewall"), fw = ctx.of("cloud-firewall-rules", "cloud-armor", "cloud-ids");
      if (!perim.length && !fwr.length && subnets.length < 2 && projects.length < 2 && !fw.length) return null;
      const parts = [projects.length > 1 && `${projects.length} projects`, perim.length && `${perim.length} VPC Service Controls perimeter${perim.length === 1 ? "" : "s"}`, subnets.length && `${subnets.length} subnet${subnets.length === 1 ? "" : "s"}`, fwr.length && `${fwr.length} firewall-rule group${fwr.length === 1 ? "" : "s"}`, fw.length && fw.map((n) => n.label.trim()).join(", ")].filter(Boolean);
      return { title: "Intentional network segmentation", fw: { "SEC-2.1": { status: "Partially Implemented", evidence: `Diagram shows ${parts.join(", ")}; whether the segments follow trust boundaries is not observable.` } }, nodes: fw.map((n) => n.id) };
    } },
  { id: "GOVERNANCE", pillar: "security", evaluate(ctx) {
      const orgs = ctx.groups.filter((g) => ["organization", "folder"].includes(g.kind)), n = ctx.of("access-context-manager", "asset-inventory", "cloud-asset-inventory", "policy-analyzer");
      if (!orgs.length && !n.length) return null;
      const ev = `${[...orgs.map((g) => g.kind === "folder" ? "folders" : "an organization"), ...n.map((x) => x.label.trim())].join(", ")} drawn for resource hierarchy and governance.`;
      return { title: "Resource hierarchy and preventive controls", fw: { "SEC-3.1": { status: "Partially Implemented", evidence: ev }, "SEC-7.4": { status: "Partially Implemented", evidence: ev } }, nodes: n.map((x) => x.id) };
    } },
  { id: "DATACLASS", pillar: "security", evaluate(ctx) {
      const n = ctx.of("data-loss-prevention-api", "data-catalog", "dataplex").concat(ctx.labelHas(/sensitive data protection|dlp|data classification|policy tags/i));
      if (!n.length) return null;
      const ids = [...new Set(n.map((x) => x.id))];
      return { title: "Data classification", fw: { "SEC-7.9": { status: "Partially Implemented", evidence: `${[...new Set(n.map((x) => x.label.trim()))].join(", ")} drawn for classification; coverage of labels and policy tags is not observable.` } }, nodes: ids };
    } },
  { id: "TRACING", pillar: "operational-excellence", evaluate(ctx) {
      const t = ctx.of("trace").concat(ctx.labelHas(/open ?telemetry|otel|tracing|cloud trace|traces/i));
      if (!t.length) return null;
      const nodes = [...new Set(t.map((n) => n.id))];
      const ev = `Application tracing/telemetry is drawn (${nodes.join(", ")}).`;
      return { title: "Distributed tracing", fw: { "OE-1.2": { status: "Implemented", evidence: ev }, "REL-5.2": { status: "Partially Implemented", evidence: ev } }, nodes };
    } },
  { id: "HYBRID", pillar: "reliability", evaluate(ctx) {
      const link = ctx.of("cloud-interconnect", "partner-interconnect", "cloud-vpn", "network-connectivity-center"), onprem = ctx.groups.filter((g) => g.kind === "on-premises").length || ctx.labelHas(/on.?prem|data cent|hospital|ehr|mainframe/i).length;
      if (!link.length && !onprem) return { title: "Hybrid connectivity", fw: { "REL-3.1": { status: "Not Applicable", evidence: "No on-premises or private-link connectivity is drawn." } } };
      if (!link.length) return { title: "Hybrid connectivity", fw: { "REL-3.1": { status: "Cannot Determine", evidence: "On-premises systems are drawn but no private connection is shown." } } };
      const redundant = link.length >= 2;
      return { title: "Hybrid connectivity redundancy", fw: { "REL-3.1": { status: redundant ? "Implemented" : "Partially Implemented", evidence: redundant ? `${link.length} connectivity components drawn.` : "A single connectivity component is drawn; redundant attachments (a second Interconnect or an HA VPN backup in another zone) are not shown.", ...(redundant ? {} : { impact: "Severe", likelihood: "Low", effort: "Medium", weeks: 6, rec: "Use redundant Interconnect attachments in separate edge availability domains (or HA VPN as backup) to meet Google's 99.99% topology.", measure: "Connectivity survives loss of one attachment" }) } }, nodes: link.map((n) => n.id) };
    } },
  { id: "AGENT-GOVERNANCE", pillar: "security", evaluate(ctx) {
      if (!ctx.isAI) return null;
      const gw = ctx.of("apigee-api-platform", "cloud-api-gateway").concat(ctx.labelHas(/ai gateway|mcp/i)), eva = ctx.labelHas(/evaluation|gen ai evaluation/i);
      const fw = {};
      if (gw.length) fw["SEC-5.4"] = { status: "Partially Implemented", evidence: `${[...new Set(gw.map((n) => n.label.trim()))].join(", ")} mediates access to model and tool APIs; per-API authorization is not observable in a diagram.` };
      if (eva.length) fw["PERF-4.2"] = { status: "Partially Implemented", evidence: "Evaluation of model or agent quality is drawn; ground-truth dataset ownership is not shown." };
      return Object.keys(fw).length ? { title: "Governed model and tool access, with evaluation", fw, nodes: [...gw, ...eva].map((n) => n.id) } : null;
    } },
  { id: "HUMAN-REVIEW", pillar: "security", evaluate(ctx) {
      const h = ctx.labelHas(/human review|reviewer|approval|human.in.the.loop/i);
      if (!ctx.isAI || !h.length) return null;
      const ids = [...new Set(h.map((n) => n.id))];
      return { title: "Human oversight of model outputs", fw: { "SEC-5.9": { status: "Partially Implemented", evidence: `Human approval is drawn for flagged outputs/actions (${ids.join(", ")}); combine with deterministic policy for high-impact actions.` } }, nodes: ids };
    } },
  { id: "COST-MODEL", pillar: "cost-optimization", evaluate(ctx) {
      const c = ctx.cost;
      if (!c) return null;
      const priced = c.coverage.estimated + c.coverage.override, total = c.coverage.nodes - c.coverage.notBillable - c.coverage.noCharge;
      const ev = `A design-time cost model was generated from the Cloud Billing Catalog: ${priced} of ${total} billable components priced, ${money(c.totals.monthlyUsd)}/month on-demand (${c.confidence}; volumes ${c.defaultedAssumptions.length ? "partly assumed" : "supplied"}).`;
      const out = { title: "Design-time cost model", fw: { "COST-2.5": { status: priced >= total ? "Implemented" : "Partially Implemented", evidence: ev } } };
      const egress = c.nodes.some((n) => n.assumptions?.some((a) => a.key === "egressGbPerMonth"));
      out.fw["COST-2.2"] = egress ? { status: "Partially Implemented", evidence: "Network egress is modelled for at least one component." } : { status: "Cannot Determine", evidence: "Network egress is excluded from the estimate because no node sets egressGbPerMonth; model it before launch." };
      const compute = (c.totals.byCategory.Compute || 0) + c.nodes.filter((n) => ["cloudsql", "spanner", "gce", "memorystore", "gke"].includes(n.pricer)).reduce((s, n) => s + n.monthlyUsd, 0);
      if (compute > 0 && compute / (c.totals.monthlyUsd || 1) >= 0.15) out.fw["COST-2.4"] = { status: "Cannot Determine", evidence: `Compute and database capacity is ${money(compute)}/month at on-demand rates (${Math.round(100 * compute / c.totals.monthlyUsd)}% of the estimate); whether committed use discounts or flex CUDs apply is not shown. Review the Active Assist cost recommendations after 30+ days of steady usage.` };
      return out;
    } },
  { id: "COST-AI-CONCENTRATION", pillar: "cost-optimization", evaluate(ctx) {
      const c = ctx.cost;
      if (!c || !ctx.isAI) return null;
      const model = c.nodes.filter((n) => n.pricer === "vertex" && n.status === "estimated");
      if (!model.length) return null;
      const share = model.reduce((s, n) => s + n.monthlyUsd, 0) / (c.totals.monthlyUsd || 1);
      const ev = `${model.map((n) => n.model || n.label).join(", ")} accounts for ${Math.round(share * 100)}% of the estimated monthly cost (${money(model.reduce((s, n) => s + n.monthlyUsd, 0))}); model right-sizing should be validated against quality targets.`;
      return { title: "Model inference dominates cost", fw: { "COST-3.2": { status: share >= 0.5 ? "Partially Implemented" : "Implemented", evidence: ev, ...(share >= 0.5 ? { impact: "Moderate", likelihood: "High", effort: "Low", weeks: 2, rec: "Validate that the chosen model is the smallest that meets quality targets; use context caching, batch prediction and token budgets.", measure: "Cost per request tracked; model choice reviewed quarterly" } : {}) } }, nodes: model.map((n) => n.id) };
    } },
];
