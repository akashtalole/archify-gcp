// Per-service cost models. Each pricer turns a node's usage assumptions into line items using rates from the
// price book (never hard-coded prices). Quantities are per month; free grants are part of the tiered rates;
// taxes, support, committed use discounts and negotiated discounts are excluded.
//
// The price book is the Cloud Billing Catalog (see scripts/fetch-prices.mjs). SKUs are selected by service, resource
// group and description patterns; `pb.dim` throws when a pattern matches SKUs with different prices, so a wrong or
// ambiguous match becomes "needs-input", never a silently wrong number. Quantities are expressed in the SKU's own
// usage unit (h, GiBy.mo, GiBy, TiBy, count, s, GiBy.s …), which `line` records.
import { tiered, round4, PricingError, HOURS_PER_MONTH } from "./pricebook.mjs";

/** Build a line item: qty (in the rate's unit) priced through tiers. `variable` lines scale with traffic. */
export function line(label, rows, qty, { variable = true, qtyLabel } = {}) {
  const t = tiered(rows, qty);
  return { label, qty, unit: rows[0].unit, usd: round4(t.usd), rate: rows.length === 1 ? Number(rows[0].usd) : null, tiered: t.tiers.length > 1, sku: rows[0].sku, usagetype: rows[0].ut, variable, ...(qtyLabel ? { qtyLabel } : {}) };
}
const sumLines = (ls) => ls.reduce((s, l) => s + l.usd, 0);
const desc = (re) => (r) => re.test(r.d);
const GIB = 1;

/** vCPU and memory (GiB) of a predefined machine type, or null. */
export function machineShape(type) {
  const m = /^([a-z0-9]+)-(standard|highmem|highcpu|ultramem|megamem|hypermem)-(\d+)$/.exec(String(type).toLowerCase());
  if (!m) { const c = /^([a-z0-9]+)-custom-(\d+)-(\d+)$/.exec(String(type).toLowerCase()); return c ? { family: c[1], vcpu: Number(c[2]), memGb: Number(c[3]) / 1024 } : null; }
  const perCpu = { standard: m[1] === "n1" ? 3.75 : 4, highmem: m[1] === "n1" ? 6.5 : 8, highcpu: m[1] === "n1" ? 0.9 : m[1] === "e2" ? 1 : 2, ultramem: 24, megamem: 14.9, hypermem: 15 }[m[2]];
  return { family: m[1], vcpu: Number(m[3]), memGb: Number(m[3]) * perCpu };
}

export const PRICERS = {
  gce: {
    label: "Compute Engine",
    run({ pb, u }) {
      const type = u("machineType", "e2-standard-4"), n = u("count", 2), hrs = u("hoursPerMonth", HOURS_PER_MONTH), disk = u("bootDiskGb", 50);
      const sh = machineShape(type);
      if (!sh) throw new PricingError(`usage.machineType "${type}" is not a predefined or custom machine type (for example e2-standard-4, n2-standard-8, c3-standard-4)`);
      const fam = sh.family.toUpperCase();
      const core = pb.dim("Compute Engine", (r) => new RegExp(`^${fam} Instance Core running in`, "i").test(r.d), `${fam} vCPU hours`);
      const ram = pb.dim("Compute Engine", (r) => new RegExp(`^${fam} Instance Ram running in`, "i").test(r.d), `${fam} memory GiB-hours`);
      const lines = [line(`${type}: vCPU-hours`, core, n * sh.vcpu * hrs, { variable: false }), line(`${type}: memory GiB-hours`, ram, n * sh.memGb * hrs, { variable: false })];
      if (disk > 0) { const pd = pb.tryDim("Compute Engine", (r) => /^Balanced PD Capacity/i.test(r.d), "Balanced persistent disk"); if (pd) lines.push(line("Boot disks (Balanced PD, GiB-month)", pd, n * disk, { variable: false })); }
      return { lines, notes: ["On-demand Linux pricing: no sustained or committed use discounts, no OS licences, no GPUs, no network egress."] };
    },
  },
  gke: {
    label: "Google Kubernetes Engine",
    run({ pb, u }) {
      const mode = u("mode", "standard"), regional = u("regional", true), hrs = u("hoursPerMonth", HOURS_PER_MONTH);
      const fee = pb.dim("Kubernetes Engine", (r) => /cluster management fee/i.test(r.d) && (regional ? !/zonal/i.test(r.d) : /zonal/i.test(r.d) || true), "GKE cluster management fee");
      const lines = [line(`GKE cluster management fee (${mode}, ${regional ? "regional" : "zonal"})`, fee, hrs, { variable: false })];
      const notes = ["Cluster fee only (the monthly free tier credit per billing account is not applied)."];
      if (mode === "standard") {
        const type = u("nodeMachineType", "e2-standard-4"), nodes = u("nodeCount", 3), sh = machineShape(type);
        if (!sh) throw new PricingError(`usage.nodeMachineType "${type}" is not a predefined or custom machine type`);
        const fam = sh.family.toUpperCase();
        const core = pb.dim("Compute Engine", (r) => new RegExp(`^${fam} Instance Core running in`, "i").test(r.d), `${fam} vCPU hours`), ram = pb.dim("Compute Engine", (r) => new RegExp(`^${fam} Instance Ram running in`, "i").test(r.d), `${fam} memory GiB-hours`);
        lines.push(line(`${nodes}× ${type} nodes: vCPU-hours`, core, nodes * sh.vcpu * hrs, { variable: false }), line(`${nodes}× ${type} nodes: memory GiB-hours`, ram, nodes * sh.memGb * hrs, { variable: false }));
        notes.push("Standard mode: node VMs priced as Compute Engine on-demand.");
      } else notes.push("Autopilot mode bills per pod vCPU, memory and storage requested; pod resources are not modelled — supply usage.monthlyUsd for them.");
      return { lines, notes };
    },
  },
  run: {
    label: "Cloud Run",
    run({ pb, u, vol }) {
      const req = vol("requestsPerMonth", 1e6), ms = u("avgDurationMs", 200), vcpu = u("vcpu", 1), mem = u("memoryGib", 0.5);
      const secs = req * (ms / 1000);
      const cpu = pb.dim("Cloud Run", (r) => /CPU/i.test(r.d) && !/GPU/i.test(r.d) && /request|Services|Allocation/i.test(r.d) && !/Idle|Min Instance|Jobs|Worker|Instance-based/i.test(r.d), "Cloud Run CPU (request-based)");
      const ram = pb.dim("Cloud Run", (r) => /Memory/i.test(r.d) && /request|Services|Allocation/i.test(r.d) && !/Idle|Min Instance|Jobs|Worker|Instance-based/i.test(r.d), "Cloud Run memory (request-based)");
      const reqs = pb.dim("Cloud Run", (r) => /^Requests/i.test(r.d) || /Request/i.test(r.d) && r.unit === "count", "Cloud Run requests");
      return { lines: [line("Requests", reqs, req), line("vCPU-seconds", cpu, secs * vcpu), line("Memory GiB-seconds", ram, secs * mem * GIB)], notes: ["Request-based billing; the free tier is included where the SKU lists it. Always-on CPU, minimum instances and GPUs are not modelled."] };
    },
  },
  functions: {
    label: "Cloud Run functions",
    run({ pb, u, vol }) {
      const req = vol("invocationsPerMonth", 1e6), ms = u("avgDurationMs", 200), mem = u("memoryMb", 256), vcpu = u("vcpu", 0.167);
      const secs = req * (ms / 1000);
      const inv = pb.dim("Cloud Functions", (r) => /Invocations/i.test(r.d), "function invocations");
      const cpu = pb.dim("Cloud Functions", (r) => /CPU/i.test(r.d) && /Time|Tier 1|second/i.test(r.d), "function vCPU-seconds"), ram = pb.dim("Cloud Functions", (r) => /Memory/i.test(r.d) && /Time|Tier 1|second/i.test(r.d), "function memory GiB-seconds");
      return { lines: [line("Invocations", inv, req), line("vCPU-seconds", cpu, secs * vcpu), line("Memory GiB-seconds", ram, secs * (mem / 1024))], notes: ["Free tier included where listed; 2nd-gen functions bill as Cloud Run."] };
    },
  },
  storage: {
    label: "Cloud Storage",
    run({ pb, u, vol }) {
      const cls = u("storageClass", "standard"), gb = vol("storageGb", 100), loc = u("location", "region"), a = vol("classAOperationsPerMonth", 1e5), b = vol("classBOperationsPerMonth", 1e6);
      const name = { standard: "Standard", nearline: "Nearline", coldline: "Coldline", archive: "Archive" }[String(cls).toLowerCase()];
      if (!name) throw new PricingError(`usage.storageClass must be standard, nearline, coldline or archive (got "${cls}")`);
      const store = pb.dim("Cloud Storage", (r) => new RegExp(`^${name} Storage ${loc === "multi-region" ? "(US|EU|ASIA) Multi-region|Multi-Region" : loc === "dual-region" ? ".*Dual-region" : "(?!.*(Multi|Dual)).*"}`, "i").test(r.d) && /GiBy\.mo/.test(r.unit), `${name} storage`);
      const opsA = pb.tryDim("Cloud Storage", (r) => new RegExp(`${name} .*Class A Operations`, "i").test(r.d), `${name} Class A operations`), opsB = pb.tryDim("Cloud Storage", (r) => new RegExp(`${name} .*Class B Operations`, "i").test(r.d), `${name} Class B operations`);
      const lines = [line(`${name} storage (GiB-month)`, store, gb)];
      if (opsA) lines.push(line("Class A operations", opsA, a / (/10/.test(opsA[0].unit) ? 1e4 : 1))); if (opsB) lines.push(line("Class B operations", opsB, b / (/10/.test(opsB[0].unit) ? 1e4 : 1)));
      return { lines, notes: ["Excludes retrieval fees, early-deletion charges, network egress and inter-region replication."] };
    },
  },
  bigquery: {
    label: "BigQuery",
    run({ pb, u, vol }) {
      const tib = vol("tibScannedPerMonth", 5), active = vol("activeStorageGb", 1000), longT = vol("longTermStorageGb", 0);
      const q = pb.dim("BigQuery", (r) => /^Analysis/i.test(r.d) && !/Editions|Slot|Standard Edition|Enterprise/i.test(r.d) && /TiBy/.test(r.unit), "BigQuery on-demand analysis");
      const st = pb.dim("BigQuery", (r) => /^Active Logical Storage/i.test(r.d) && /GiBy\.mo/.test(r.unit), "BigQuery active logical storage");
      const lines = [line("On-demand query analysis (TiB scanned)", q, tib), line("Active logical storage (GiB-month)", st, active)];
      if (longT > 0) lines.push(line("Long-term logical storage (GiB-month)", pb.dim("BigQuery", (r) => /^Long Term Logical Storage/i.test(r.d), "BigQuery long-term storage"), longT));
      return { lines, notes: ["On-demand (per TiB scanned) pricing with the monthly free tier where listed; slot reservations / editions are not modelled."] };
    },
  },
  pubsub: {
    label: "Pub/Sub",
    run({ pb, vol }) {
      const tib = vol("tibPublishedPerMonth", 0.5);
      const d = pb.dim("Pub/Sub", (r) => /Message Delivery Basic/i.test(r.d) && /TiBy/.test(r.unit), "Pub/Sub message delivery");
      return { lines: [line("Message delivery (TiB; publish plus each subscription delivery)", d, tib)], notes: ["Throughput-based pricing with the monthly free allowance; retention, seek and snapshot storage are not modelled."] };
    },
  },
  cloudsql: {
    label: "Cloud SQL",
    run({ pb, u, vol }) {
      const engine = u("engine", "PostgreSQL"), vcpu = u("vcpu", 2), mem = u("memoryGb", 8), ha = u("highAvailability", false), gb = vol("storageGb", 100), hrs = u("hoursPerMonth", HOURS_PER_MONTH), edition = u("edition", "Enterprise");
      const ed = ha ? "Regional" : "Zonal";
      const core = pb.dim("Cloud SQL", (r) => new RegExp(`^Cloud SQL for ${engine}: ${ed} - vCPU`, "i").test(r.d) || new RegExp(`^${engine}.*${ed}.*vCPU`, "i").test(r.d), `Cloud SQL ${engine} ${ed} vCPU`);
      const ram = pb.dim("Cloud SQL", (r) => new RegExp(`^Cloud SQL for ${engine}: ${ed} - RAM`, "i").test(r.d) || new RegExp(`^${engine}.*${ed}.*RAM`, "i").test(r.d), `Cloud SQL ${engine} ${ed} memory`);
      const st = pb.dim("Cloud SQL", (r) => new RegExp(`^Cloud SQL for ${engine}: ${ed} - Standard storage`, "i").test(r.d) || new RegExp(`^${engine}.*${ed}.*SSD storage`, "i").test(r.d), `Cloud SQL ${engine} ${ed} SSD storage`);
      return { lines: [line(`vCPU-hours (${ed})`, core, vcpu * hrs, { variable: false }), line("Memory GiB-hours", ram, mem * hrs, { variable: false }), line("SSD storage (GiB-month)", st, gb)], notes: [`${edition} edition list prices; ${ha ? "regional (high availability)" : "zonal"} instance; backups, network and licences excluded.`] };
    },
  },
  logging: {
    label: "Cloud Logging",
    run({ pb, vol, u }) {
      const gb = vol("ingestGibPerMonth", 50), keep = u("retainedGibMonths", 0);
      const ing = pb.dim("Cloud Logging", (r) => /Log Storage cost|Ingestion/i.test(r.d) && /GiBy$/.test(r.unit), "Cloud Logging ingestion");
      const lines = [line("Log ingestion (GiB)", ing, gb)];
      if (keep > 0) lines.push(line("Retention beyond 30 days (GiB-month)", pb.dim("Cloud Logging", (r) => /Log Storage retention|Retention/i.test(r.d), "Cloud Logging retention"), keep));
      return { lines, notes: ["First 50 GiB per project per month are free where the SKU lists it; log-based metrics and Log Analytics queries are not modelled."] };
    },
  },
};

/** Catalog service id -> pricer. */
export const SERVICE_PRICER = {
  "compute-engine": "gce", "kubernetes-engine": "gke", "cloud-run": "run", "cloud-functions": "functions", "cloud-storage": "storage", bigquery: "bigquery", pubsub: "pubsub", "cloud-sql": "cloudsql", "cloud-logging": "logging", "cloud-monitoring": "logging", "cloud-ops": "logging",
};
/** Services with no direct charge (the cost is in what they manage or use). */
export const NO_CHARGE = new Set(["identity-and-access-management", "virtual-private-cloud", "cloud-firewall-rules", "cloud-routes", "cloud-asset-inventory", "asset-inventory", "access-context-manager", "policy-analyzer", "project", "administration", "quotas", "recommendations-ai-free", "cloud-audit-logs", "connectivity-test", "cloud-network", "network-topology", "service-discovery"]);
export { sumLines };
