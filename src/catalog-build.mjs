// Builds data/catalog.json from an extracted icon directory (see scripts/fetch-icons.mjs).
// Icons live in assets/gcp-icons/products/<product_key>.svg. Names, ids and categories are derived from the file key.
import fs from "node:fs";
import path from "node:path";

/** Core-products folder name -> legacy product key (so the newer icon replaces the legacy one). */
export const CORE_TO_LEGACY = {
  "Compute Engine": "compute_engine", GKE: "google_kubernetes_engine", "Cloud Run": "cloud_run", "Cloud Storage": "cloud_storage", "Cloud SQL": "cloud_sql",
  "Cloud Spanner": "cloud_spanner", BigQuery: "bigquery", "Vertex AI": "vertexai", Looker: "looker", Apigee: "apigee_api_platform", Anthos: "anthos",
  "Security Command Center": "security_command_center", AlloyDB: "alloydb", Hyperdisk: "hyperdisk", "Distributed Cloud": "distributed_cloud", Mandiant: "mandiant",
  "Threat Intelligence": "threat_intelligence", "Security Operations": "security_operations", "AI Hypercomputer": "ai_hypercomputer",
};

const ACRONYMS = { sql: "SQL", gke: "GKE", vpc: "VPC", dns: "DNS", cdn: "CDN", iot: "IoT", ai: "AI", api: "API", apis: "APIs", ids: "IDS", hsm: "HSM", ekm: "EKM", nat: "NAT", vpn: "VPN",
  tpu: "TPU", gpu: "GPU", ssd: "SSD", nlp: "NLP", iam: "IAM", ip: "IP", os: "OS", ml: "ML", qna: "Q&A", "q&a": "Q&A", tensorflow: "TensorFlow", alloydb: "AlloyDB", bigquery: "BigQuery",
  bigtable: "Bigtable", pubsub: "Pub/Sub", vertexai: "Vertex AI", firestore: "Firestore", looker: "Looker", automl: "AutoML", powershell: "PowerShell", stackdriver: "Stackdriver", kuberun: "KubeRun" };
const NAME_OVERRIDES = { google_kubernetes_engine: "Google Kubernetes Engine", identity_and_access_management: "Identity and Access Management", "identity-aware_proxy": "Identity-Aware Proxy",
  "cloud_optimization_ai_-_fleet_routing_api": "Cloud Optimization AI - Fleet Routing API", "text-to-speech": "Text-to-Speech", "speech-to-text": "Speech-to-Text", "real-world_insights": "Real-World Insights",
  "gke_on-prem": "GKE On-Prem", cloud_ops: "Cloud Operations", key_management_service: "Cloud Key Management Service", cloud_load_balancing: "Cloud Load Balancing", secret_manager: "Secret Manager" };
const CATEGORY_NAMES = { category_devops: "DevOps", category_ai_machine_learning: "AI and Machine Learning", category_hybrid_multicloud: "Hybrid and Multicloud", category_maps_geospatial: "Maps and Geospatial", category_web_mobile: "Web and Mobile", category_security_identity: "Security and Identity", category_web3: "Web3", category_agents: "Agents", category_business_intelligence: "Business Intelligence", category_collaboration: "Collaboration", category_compute: "Compute", category_containers: "Containers", category_data_analytics: "Data Analytics", category_databases: "Databases", category_developer_tools: "Developer Tools", category_integration_services: "Integration Services", category_management_tools: "Management Tools", category_marketplace: "Marketplace", category_media_services: "Media Services", category_migration: "Migration", category_mixed_reality: "Mixed Reality", category_networking: "Networking", category_observability: "Observability", category_operations: "Operations", category_serverless_computing: "Serverless Computing", category_storage: "Storage" };
const humanName = (key) => NAME_OVERRIDES[key] || key.split(/[_]+/).map((w) => ACRONYMS[w] || (w.length ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
const slug = (key) => key.toLowerCase().replace(/^google_/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Category rules, first match wins (product key regex). */
const CATEGORY_RULES = [
  ["compute", /^(compute_engine|cloud_gpu|cloud_tpu|bare_metal_solutions|vmware_engine|batch|os_|migrate_for_compute|local_ssd|persistent_disk|hyperdisk|container_optimized_os|gce_systems|cloud_shell|tensorflow_enterprise)/],
  ["containers", /^(google_kubernetes_engine|gke_|anthos|kuberun|container_registry|artifact_registry|cloud_run_for_anthos|migrate_for_anthos)/],
  ["serverless", /^(cloud_run|cloud_functions|app_engine|cloud_tasks|cloud_scheduler|workflows|eventarc)/],
  ["storage", /^(cloud_storage|filestore|transfer|data_transfer|storage_|cloud_storage)/],
  ["databases", /^(cloud_sql|cloud_spanner|bigtable|firestore|datastore|memorystore|alloydb|database_migration|datastream)/],
  ["networking", /^(virtual_private|cloud_(vpn|nat|dns|cdn|router|routes|interconnect|armor|load_balancing|firewall|network|external_ip|ids|domains|media_edge|endpoints|api_gateway|apis)(?:_|$)|network_|private_|partner_|traffic_director|standard_network|premium_network|service_discovery|connectivity_test|cloud_apis|certificate_manager)/],
  ["security", /^(security|identity|key_|cloud_(hsm|ekm|key)(?:_|$)|secret_manager|binary_authorization|access_context|policy_analyzer|beyondcorp|data_loss|web_risk|web_security|phishing|risk_manager|cloud_security|certificate_authority|assured_workloads|workload_identity|permissions|mandiant|threat_intelligence|cloud_audit|iap|workload)/],
  ["ai-ml", /^(vertexai|ai_|automl|cloud_(vision|translation|natural|inference|jobs)|dialogflow|speech|text-to|video|visual_inspection|document_ai|contact_center|agent_assist|recommendations|media_translation|healthcare_nlp|data_labeling|retail_api|cloud_optimization|advanced_agent|quantum)/],
  ["analytics", /^(bigquery|dataproc|dataflow|dataprep|dataplex|data_|datalab|datashare|analytics_hub|cloud_composer|cloud_data_fusion|looker|pubsub|stream_suite|genomics|dataproc_metastore|datapol|datalab)/],
  ["integration", /^(pubsub|apigee|api_|connectors|cloud_endpoints|developer_portal|producer_portal|api_monetization)/],
  ["devops", /^(cloud_(build|deploy|code|source)|tools_for|deployment_manager|configuration_management|cloud_test_lab)/],
  ["operations", /^(cloud_(ops|monitoring|logging|trace|asset)|error_reporting|trace|debugger|profiler|stackdriver|performance_dashboard|network_intelligence|asset_inventory|os_)/],
  ["healthcare", /^(cloud_healthcare|healthcare|genomics)/],
  ["management", /^(project|billing|quotas|administration|my_cloud|home|launcher|catalog|support|recommender|release_notes|onboarding|free_trial|google_cloud_marketplace|financial_services|marketplace|user_preferences|early_access|advanced_solutions|partner_portal|cloud_generic|fleet_engine|game_servers|google_maps|iot_|real-world|retail)/],
];
const categoryOf = (key) => (CATEGORY_RULES.find(([, re]) => re.test(key)) || ["other"])[0];

/** Group icons by archify-gcp group kind (see src/groups.mjs): product key. */
export const GROUP_ICON_KEYS = { Project: "project", VPC: "virtual_private_cloud", Subnet: "cloud_network", Firewall: "cloud_firewall_rules", Perimeter: "access_context_manager", Organization: "administration" };

const walk = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)])) : []);

export function buildCatalog(iconsDir, release = "Google Cloud icons") {
  const rel = (f) => path.relative(iconsDir, f).split(path.sep).join("/");
  const services = [], byKey = new Map(), general = [];
  for (const f of walk(iconsDir).filter((f) => f.endsWith(".svg")).sort()) {
    const key = path.basename(f, ".svg");
    if (rel(f).startsWith("general/")) { general.push({ key, id: key, name: key.split("-").map((w) => (w === "aws" ? "AWS" : w[0].toUpperCase() + w.slice(1))).join(" "), file: rel(f) }); continue; }
    const isCat = rel(f).startsWith("categories/");
    const entry = isCat ? { key, id: key.replace(/_/g, "-"), name: `${CATEGORY_NAMES[key] || key.replace(/^category_/, "").replace(/_/g, " ")} (category)`, category: "categories", file: rel(f) } : { key, id: slug(key), name: humanName(key), category: categoryOf(key), file: rel(f) };
    byKey.set(key, entry);
    services.push(entry);
  }
  const ids = new Set();
  for (const s of services) { if (ids.has(s.id)) s.id = s.key.toLowerCase().replace(/[^a-z0-9]+/g, "-"); ids.add(s.id); }
  services.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const groups = Object.entries(GROUP_ICON_KEYS).flatMap(([gk, sk]) => (byKey.get(sk) ? [{ key: gk, dark: false, file: byKey.get(sk).file }] : []));
  const categories = Object.fromEntries([...new Set(services.map((s) => s.category))].sort().map((c) => [c, "#4285F4"]));
  return { generatedFrom: release, categories, services, resources: [], groups, general };
}
