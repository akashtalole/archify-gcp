// Conservative label -> Google Cloud icon mapping for imported diagrams. Never silently invents: every result
// carries a confidence (exact | keyword | fallback) so the importer can report what needs a human look.
import { resolveIcon, searchIcons } from "./catalog.mjs";

// [pattern, icon id]; first match wins, so list specific before generic.
const KEYWORDS = [
  [/\b(vertex ai|vertexai|gemini|palm|genai|gen ?ai|llm|foundation model|gpt|openai|embeddings?|model garden)\b/, "vertexai"],
  [/\b(agent builder|agent engine|adk|conversational agent|dialogflow)\b/, "dialogflow-cx"],
  [/\b(agents?|agent runtime|agent platform)\b/, "vertexai"],
  [/\b(model armor|content safety|guardrails?|content filter)\b/, "data-loss-prevention-api"],
  [/\b(api gateway|apigee|api management|apim|rest api|http api)\b/, "apigee-api-platform"],
  [/\b(load balancer|load balancing|lb|alb|nlb|elb|front door)\b/, "cloud-load-balancing"],
  [/\b(cloud cdn|cdn|edge cache)\b/, "cloud-cdn"],
  [/\b(cloud armor|waf|web application firewall|ddos|shield)\b/, "cloud-armor"],
  [/\b(firewall)\b/, "cloud-firewall-rules"],
  [/\b(dns|route ?53)\b/, "cloud-dns"],
  [/\b(nat gateway|cloud nat|nat)\b/, "cloud-nat"],
  [/\b(vpn|vpn gateway)\b/, "cloud-vpn"], [/\b(interconnect|direct connect|expressroute)\b/, "cloud-interconnect"],
  [/\b(private service connect|private endpoint|private link|privatelink)\b/, "private-service-connect"],
  [/\b(vpc service controls|vpc sc|service perimeter)\b/, "access-context-manager"],
  [/\b(vpc|virtual private cloud|virtual network|vnet)\b/, "virtual-private-cloud"],
  [/\b(kubernetes|gke|aks|eks|k8s)\b/, "kubernetes-engine"],
  [/\b(cloud run|container apps|fargate|app runner)\b/, "cloud-run"],
  [/\b(functions?|lambda|cloud functions)\b/, "cloud-functions"],
  [/\b(app engine|app service|elastic beanstalk)\b/, "app-engine"],
  [/\b(compute engine|gce|virtual machines?|vm|ec2|instances?)\b/, "compute-engine"],
  [/\b(batch)\b/, "batch"],
  [/\b(bigquery|data warehouse|warehouse|redshift|synapse)\b/, "bigquery"],
  [/\b(dataflow|stream processing|beam)\b/, "dataflow"], [/\b(dataproc|spark|hadoop|emr)\b/, "dataproc"],
  [/\b(composer|airflow|orchestrat\w+)\b/, "cloud-composer"],
  [/\b(dataplex|data catalog|governance)\b/, "dataplex"],
  [/\b(looker|bi dashboards?|power bi|quicksight)\b/, "looker"],
  [/\b(pub ?sub|pubsub|messaging|event bus|kafka|kinesis|event hubs?|service bus|sns|sqs)\b/, "pubsub"],
  [/\b(eventarc|event grid|eventbridge)\b/, "eventarc"],
  [/\b(cloud tasks|task queue)\b/, "cloud-tasks"], [/\b(scheduler|cron)\b/, "cloud-scheduler"],
  [/\b(workflows?|step functions|logic apps)\b/, "workflows"],
  [/\b(spanner)\b/, "cloud-spanner"], [/\b(alloydb)\b/, "alloydb"],
  [/\b(cloud sql|postgres\w*|mysql|sql server|rds|aurora|sql database)\b/, "cloud-sql"],
  [/\b(bigtable|cassandra|wide.column)\b/, "bigtable"],
  [/\b(firestore|datastore|cosmos db|dynamodb|document database|nosql)\b/, "firestore"],
  [/\b(memorystore|redis|memcached|elasticache|cache)\b/, "memorystore"],
  [/\b(cloud storage|gcs|bucket|blob storage|s3|object storage|data lake)\b/, "cloud-storage"],
  [/\b(filestore|nfs|file share|efs)\b/, "filestore"], [/\b(persistent disk|block storage|ebs|disk)\b/, "persistent-disk"],
  [/\b(secret manager|secrets?|key vault|secrets manager)\b/, "secret-manager"],
  [/\b(kms|key management|cloud hsm|hsm)\b/, "key-management-service"],
  [/\b(iam|identity and access|rbac|entra|active directory|cognito)\b/, "identity-and-access-management"],
  [/\b(identity platform|firebase auth|auth0|sso|oidc|saml)\b/, "identity-platform"],
  [/\b(identity.aware proxy|iap|beyondcorp|zero trust)\b/, "identity-aware-proxy"],
  [/\b(security command center|scc|defender|guardduty|security hub)\b/, "security-command-center"],
  [/\b(chronicle|secops|siem|sentinel)\b/, "security-operations"],
  [/\b(sensitive data protection|dlp|data loss prevention|macie|pii)\b/, "data-loss-prevention-api"],
  [/\b(audit logs?|cloudtrail|activity log)\b/, "cloud-audit-logs"],
  [/\b(monitoring|metrics|cloudwatch|azure monitor|prometheus|grafana)\b/, "cloud-monitoring"],
  [/\b(logging|logs?|log analytics)\b/, "cloud-logging"], [/\b(trace|tracing|x-ray|application insights|apm)\b/, "trace"],
  [/\b(cloud build|ci ?\/? ?cd|pipeline|codebuild|github actions|devops)\b/, "cloud-build"], [/\b(cloud deploy|release pipeline|codedeploy)\b/, "cloud-deploy"],
  [/\b(artifact registry|container registry|ecr|acr)\b/, "artifact-registry"],
  [/\b(terraform|deployment manager|infrastructure manager|config connector|iac|infrastructure as code)\b/, "cloud-deployment-manager"],
  [/\b(billing|cost management|budgets?)\b/, "billing"],
  [/\b(vision|ocr|image analysis|rekognition)\b/, "cloud-vision-api"], [/\b(speech to text|transcri\w+|transcribe)\b/, "speech-to-text"], [/\b(text to speech|tts|polly)\b/, "text-to-speech"],
  [/\b(translate|translation)\b/, "cloud-translation-api"], [/\b(natural language|nlp|comprehend)\b/, "cloud-natural-language-api"],
  [/\b(document ai|document intelligence|textract|form recognizer)\b/, "document-ai"],
  [/\b(healthcare api|fhir|hl7v2|dicom|healthlake)\b/, "cloud-healthcare-api"],
  [/\b(iot|device|sensor)\b/, "iot-core"],
  [/\b(data fusion|etl|data integration|data factory|glue)\b/, "cloud-data-fusion"], [/\b(datastream|cdc|change data capture|dms|database migration)\b/, "datastream"],
  [/\b(vector search|vector db|vector database|rag index|search index|elasticsearch|opensearch)\b/, "vertexai"],
];
const GENERAL = [
  [/\b(users?|clients?|customers?|patients?|clinicians?|staff|operators?|employees?|developers?|admins?|actors?|people)\b/, "users"],
  [/\b(browser|web app|website|frontend)\b/, "browser"],
  [/\b(mobile|ios|android|phone)\b/, "mobile"],
  [/\b(internet|public web|external)\b/, "internet"],
  [/\b(on.?prem\w*|data ?cent(er|re)|legacy|mainframe|ehr|pacs|hl7|erp|crm)\b/, "server-farm"],
  [/\b(saas|third.party|partner|external service)\b/, "saas"],
  [/\b(document|pdf|report|file)\b/, "file"],
];

export function guessIcon(label, hint = "") {
  const text = `${label || ""} ${hint}`.toLowerCase().replace(/[_]+/g, " ");
  const compact = text.replace(/[^a-z0-9 :]+/g, " ").replace(/\s+/g, " ").trim();
  // 1. exact service id / alias / full name (e.g. "Cloud Spanner", "Secret Manager", "Cloud Run")
  const exact = resolveIcon(compact) || resolveIcon(compact.replace(/ /g, "-"));
  if (exact) return { icon: refOf(exact), confidence: "exact", matched: exact.entry.name };
  // 2. any single word or adjacent pair that is an exact service id/alias
  const words = compact.split(" ").filter(Boolean);
  for (let n = 2; n >= 1; n--) for (let i = 0; i + n <= words.length; i++) {
    const g = words.slice(i, i + n).join(" ");
    if (g.length < 3) continue;
    const hit = resolveIcon("svc:" + g.replace(/ /g, "-"));
    if (hit) return { icon: refOf(hit), confidence: "exact", matched: hit.entry.name };
  }
  // 3. Google Cloud keyword table (also understands common AWS/Azure names)
  for (const [re, id] of KEYWORDS) if (re.test(compact)) { const hit = resolveIcon("svc:" + id); if (hit) return { icon: refOf(hit), confidence: "keyword", matched: hit.entry.name }; }
  for (const [re, id] of GENERAL) if (re.test(compact)) { const hit = resolveIcon(id); if (hit) return { icon: refOf(hit), confidence: "keyword", matched: hit.entry.name }; }
  // 4. strict catalog search (every token must match)
  const s = searchIcons(compact, 1)[0];
  if (s && s.kind === "service" && words.length <= 3) return { icon: s.id, confidence: "search", matched: s.name };
  return { icon: "gen:cloud", confidence: "fallback", matched: null };
}
const refOf = (r) => (r.kind === "service" ? r.entry.id : r.kind === "resource" ? "res:" + r.entry.id : "gen:" + r.entry.id);
