// Infrastructure-as-code -> architecture spec. Reads Terraform (*.tf, google / google-beta provider) with a zero-dependency
// scanner (no full parser: resources and references) and produces the same spec the rest of the tool renders. It reports
// what it skipped so nothing is silently dropped.
import fs from "node:fs";
import path from "node:path";
import { layerItems } from "./layers.mjs";

// kind -> icon; `tf` is the Terraform resource type pattern. Order = upstream-first priority for glue edges.
const KINDS = [
  { k: "dns", icon: "cloud-dns", tf: /^google_dns_managed_zone$/ },
  { k: "armor", icon: "cloud-armor", tf: /^google_compute_security_policy$/ },
  { k: "lb", icon: "cloud-load-balancing", tf: /^google_compute_(global_)?forwarding_rule$/ },
  { k: "apigee", icon: "apigee-api-platform", tf: /^google_apigee_(organization|environment)$/ },
  { k: "apigw", icon: "cloud-api-gateway", tf: /^google_api_gateway_api$/ },
  { k: "pubsub", icon: "pubsub", tf: /^google_pubsub_topic$/ },
  { k: "eventarc", icon: "eventarc", tf: /^google_eventarc_trigger$/ },
  { k: "tasks", icon: "cloud-tasks", tf: /^google_cloud_tasks_queue$/ },
  { k: "sched", icon: "cloud-scheduler", tf: /^google_cloud_scheduler_job$/ },
  { k: "wf", icon: "workflows", tf: /^google_workflows_workflow$/ },
  { k: "storage", icon: "cloud-storage", tf: /^google_storage_bucket$/ },
  { k: "run", icon: "cloud-run", tf: /^google_cloud_run(_v2)?_(service|job)$/ },
  { k: "fn", icon: "cloud-functions", tf: /^google_cloudfunctions2?_function$/ },
  { k: "gae", icon: "app-engine", tf: /^google_app_engine_(application|standard_app_version|flexible_app_version)$/ },
  { k: "gce", icon: "compute-engine", tf: /^google_compute_(region_)?(instance|instance_group_manager)$/ },
  { k: "gke", icon: "kubernetes-engine", tf: /^google_container_cluster$/ },
  { k: "batch", icon: "batch", tf: /^google_batch_job$/ },
  { k: "vertex", icon: "vertexai", tf: /^google_vertex_ai_(endpoint|index|index_endpoint|featurestore|dataset|metadata_store)$/ },
  { k: "dlp", icon: "data-loss-prevention-api", tf: /^google_data_loss_prevention_(inspect_template|deidentify_template|job_trigger)$/ },
  { k: "sql", icon: "cloud-sql", tf: /^google_sql_database_instance$/ },
  { k: "spanner", icon: "cloud-spanner", tf: /^google_spanner_instance$/ },
  { k: "bigtable", icon: "bigtable", tf: /^google_bigtable_instance$/ },
  { k: "firestore", icon: "firestore", tf: /^google_firestore_database$/ },
  { k: "alloydb", icon: "alloydb", tf: /^google_alloydb_cluster$/ },
  { k: "redis", icon: "memorystore", tf: /^google_(redis|memcache)_instance$/ },
  { k: "bq", icon: "bigquery", tf: /^google_bigquery_dataset$/ },
  { k: "dataflow", icon: "dataflow", tf: /^google_dataflow_(flex_template_)?job$/ },
  { k: "dataproc", icon: "dataproc", tf: /^google_dataproc_cluster$/ },
  { k: "composer", icon: "cloud-composer", tf: /^google_composer_environment$/ },
  { k: "datastream", icon: "datastream", tf: /^google_datastream_stream$/ },
  { k: "dataplex", icon: "dataplex", tf: /^google_dataplex_lake$/ },
  { k: "healthcare", icon: "cloud-healthcare-api", tf: /^google_healthcare_(dataset|fhir_store|dicom_store|hl7_v2_store)$/ },
  { k: "kms", icon: "key-management-service", tf: /^google_kms_key_ring$/ },
  { k: "secret", icon: "secret-manager", tf: /^google_secret_manager_secret$/ },
  { k: "ar", icon: "artifact-registry", tf: /^google_artifact_registry_repository$/ },
  { k: "build", icon: "cloud-build", tf: /^google_cloudbuild_trigger$/ },
  { k: "deploy", icon: "cloud-deploy", tf: /^google_clouddeploy_delivery_pipeline$/ },
  { k: "nat", icon: "cloud-nat", tf: /^google_compute_router_nat$/ },
  { k: "vpn", icon: "cloud-vpn", tf: /^google_compute_(ha_)?vpn_gateway$/ },
  { k: "interconnect", icon: "cloud-interconnect", tf: /^google_compute_interconnect_attachment$/ },
  { k: "psc", icon: "private-service-connect", tf: /^google_compute_service_attachment$/ },
  { k: "logs", icon: "cloud-logging", tf: /^google_logging_(project|folder|organization)_sink$/, optional: "logs" },
  { k: "iam", icon: "identity-and-access-management", tf: /^google_service_account$/, optional: "iam" },
];
const PRIORITY = KINDS.map((x) => x.k);
// Glue resources describe wiring, not architecture: they are resolved into edges between the real services instead of being drawn.
const GLUE = /^google_(project_iam_.*|[a-z_]+_iam_(member|binding|policy)|pubsub_subscription|compute_(url_map|backend_service|region_backend_service|backend_bucket|target_(http|https)_proxy|region_target_(http|https)_proxy|health_check|region_health_check|instance_template|firewall|subnetwork|address|global_address|router|ssl_certificate|managed_ssl_certificate|network_endpoint_group|region_network_endpoint_group|instance_group)|container_node_pool|logging_.*|monitoring_.*|project_service|kms_crypto_key.*|sql_database|sql_user|bigquery_table|storage_bucket_object|service_account_(key|iam.*)|secret_manager_secret_version|dns_record_set|vpc_access_connector|service_networking_connection|cloud_scheduler_job_x)$/;
const NET = /^google_compute_network$/;
const VNET_HINT = /\b(network|subnetwork|network_interface|private_network|authorized_networks)\s*[={]|vpc_access|vpc_connector|google_compute_(sub)?network\./;

const walk = (dir, exts, acc = []) => {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (/^(\.|node_modules$|dist$|\.terraform$)/.test(d.name) && d.name !== ".") continue;
    const f = path.join(dir, d.name);
    if (d.isDirectory()) walk(f, exts, acc); else if (exts.some((e) => d.name.endsWith(e))) acc.push(f);
  }
  return acc;
};
const human = (name) => name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Body of a `{ ... }` block starting after position i (the opening brace is already consumed). Skips strings and comments. */
function block(text, i) {
  let depth = 1, inStr = null;
  const start = i;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (inStr) { if (ch === "\\") i++; else if (ch === inStr) inStr = null; }
    else if (ch === '"' || ch === "'") inStr = ch;
    else if (ch === "#" || (ch === "/" && text[i + 1] === "/")) { while (i < text.length && text[i] !== "\n") i++; }
    else if (ch === "{") depth++; else if (ch === "}") depth--;
    i++;
  }
  return { body: text.slice(start, i - 1), end: i };
}

// ---------------- Terraform
function terraformResources(text, file) {
  const out = [], re = /(^|\n)\s*resource\s+"(google(?:_beta)?_[a-z0-9_]+)"\s+"([^"]+)"\s*\{/g;
  let m;
  while ((m = re.exec(text))) {
    const { body } = block(text, m.index + m[0].length);
    const type = m[2].replace(/^google_beta_/, "google_");
    out.push({ type, name: m[3], body, file, id: `${m[2]}.${m[3]}` });
  }
  return out;
}
const tfRefs = (r, byId) => [...new Set([...r.body.matchAll(/\b(google(?:_beta)?_[a-z0-9_]+)\.([A-Za-z0-9_-]+)/g)].map((x) => `${x[1]}.${x[2]}`))].filter((id) => id !== r.id && byId.has(id));

export function importIac(root, { include = [], title } = {}) {
  const target = path.resolve(root);
  const stat = fs.statSync(target);
  const files = stat.isDirectory() ? walk(target, [".tf"]) : [target];
  const report = { source: target, files: [], formats: [], resources: 0, nodes: 0, skipped: {}, glue: 0, warnings: [] };
  const all = [];
  for (const f of files) {
    let text; try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
    const rs = f.endsWith(".tf") ? terraformResources(text, f).map((r) => ({ ...r, fmt: "tf" })) : [], fmt = "terraform";
    if (rs.length) { all.push(...rs); report.files.push(path.relative(process.cwd(), f)); if (!report.formats.includes(fmt)) report.formats.push(fmt); }
  }
  if (!all.length) throw new Error(`no Terraform (google provider) resources found in ${root}`);
  report.resources = all.length;
  const byId = new Map(all.map((r) => [r.id, r]));
  const isTf = (r) => r.fmt === "tf";
  const classify = (r) => {
    const ty = r.type;
    if (NET.test(ty)) return { role: "vnet" };
    if (GLUE.test(ty)) return { role: "glue" };
    const kind = KINDS.find((k) => k.tf.test(ty));
    if (kind) return kind.optional && !include.includes(kind.optional) ? { role: "skip", why: kind.optional } : { role: "node", kind };
    return { role: "skip", why: ty };
  };
  const nodes = new Map(), glue = [], vnets = [], used = new Set();
  const nodeId = (s) => { let id = s.replace(/[^\w-]+/g, "_"); if (!/^[A-Za-z]/.test(id)) id = "r" + id; return id; };
  const uniq = (r) => { let id = nodeId(r.name); if (used.has(id)) id = nodeId(r.type.replace(/^google_/, "") + "_" + r.name); used.add(id); return id; };
  for (const r of all) {
    const c = classify(r); r.cls = c;
    if (c.role === "node") nodes.set(r.id, { r, kind: c.kind, id: uniq(r), label: human(r.name.replace(/^\[.*\]$/, c.kind.k)), sublabel: r.type.replace(/^google_/, "").replace(/_/g, " "), vnet: VNET_HINT.test(r.body) });
    else if (c.role === "glue") glue.push(r);
    else if (c.role === "vnet") vnets.push(r);
    else report.skipped[c.why] = (report.skipped[c.why] || 0) + 1;
  }
  report.glue = glue.length;
  const refsOf = (r) => tfRefs(r, byId);
  const edges = [], seen = new Set();
  const addEdge = (a, b, label, dashed) => { if (!a || !b || a === b || !nodes.has(a) || !nodes.has(b)) return; const k = a + ">" + b; if (seen.has(k)) return; seen.add(k); edges.push({ from: nodes.get(a).id, to: nodes.get(b).id, ...(label ? { label } : {}), ...(dashed ? { style: "dashed" } : {}) }); };
  const pr = (id) => { const n = nodes.get(id); return n ? PRIORITY.indexOf(n.kind.k) : 999; };
  // direct references: A uses B
  for (const n of nodes.values()) for (const ref of refsOf(n.r)) if (nodes.has(ref)) addEdge(n.r.id, ref);
  // glue resources connect the most "upstream" referenced node to the others (event subscriptions, diagnostic settings, role assignments...)
  const resolveGlue = (g, depth = 0) => [...new Set(refsOf(g).flatMap((id) => (nodes.has(id) ? [id] : byId.get(id)?.cls.role === "glue" && depth < 2 ? resolveGlue(byId.get(id), depth + 1) : [])))];
  for (const g of glue) {
    const refs = resolveGlue(g).sort((a, b) => pr(a) - pr(b));
    if (refs.length >= 2) for (const t of refs.slice(1)) addEdge(refs[0], t, glueLabel(g));
  }
  // ---- build items (VPC-attached nodes go inside a VPC network group, everything inside Google Cloud)
  const mk = (n) => ({ id: n.id, icon: n.kind.icon, label: n.label, sublabel: n.sublabel });
  const inVnet = [], outside = [];
  for (const n of nodes.values()) (n.vnet && vnets.length ? inVnet : outside).push(n);
  const items = outside.map(mk);
  if (inVnet.length) items.push({ id: "vpc", kind: "vpc", label: "VPC network", children: inVnet.map(mk) });
  if (nodes.size > 40) report.warnings.push(`${nodes.size} resources become nodes — consider narrowing the path or splitting the diagram (readable range is ~6-20).`);
  const layered = layerItems(items, edges, "LR");
  const cloud = { id: "cloud", kind: "gcp-cloud", layout: "row", gap: 64, children: layered };
  const spec = {
    meta: { title: title || `${path.basename(target)} — architecture from ${report.formats.join(" + ")}`, subtitle: `${nodes.size} resources, ${edges.length} relationships inferred from references; verify against the deployed system`, output: "iac-diagram.html" },
    root: { layout: "row", gap: 70, children: [cloud] },
    edges,
  };
  report.nodes = nodes.size;
  report.edges = edges.length;
  if (!edges.length) report.warnings.push("no relationships could be inferred from references");
  return { type: "architecture", spec, report };
  function glueLabel(g) {
    if (/pubsub_subscription/i.test(g.type)) return "subscribes";
    if (/logging_/i.test(g.type)) return "logs to";
    if (/_iam_|iam_member|iam_binding/i.test(g.type)) return "authorizes";
    return undefined;
  }
}
