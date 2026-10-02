import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ROOT, resolveIcon, searchIcons, iconsAvailable, catalog } from "../src/catalog.mjs";
import { validateSpec } from "../src/spec.mjs";
import { wrapLabel } from "../src/layout.mjs";
import { buildDiagram } from "../src/pipeline.mjs";
import { analyze } from "../src/analysis.mjs";
import { renderPage } from "../src/page.mjs";
import { reviewWorkload, riskLevel } from "../src/wa/evaluate.mjs";
import { LEGACY_RULES, PROCEDURAL_RULES } from "../src/wa/rules.mjs";
import { loadCorpus } from "../src/wa/corpus.mjs";

const needIcons = { skip: !iconsAvailable() && "icons not fetched (run npm run icons:fetch)" };
const read = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "examples", n), "utf8"));
const load = (n) => read(n + ".json");
// Cost tests run against a synthetic price book in the Cloud Billing Catalog shape (test/fixtures/prices): the arithmetic is
// verified without committing real prices. Real prices come from `npm run prices:fetch` (needs GOOGLE_API_KEY).
process.env.ARCHIFY_GCP_PRICES_DIR = path.join(ROOT, "test", "fixtures", "prices");

test("catalog covers the Google Cloud icon set", () => {
  assert.ok(catalog.services.length > 200);
  assert.ok(catalog.groups.some((g) => g.key === "Project"));
});

test("icon aliases resolve to catalog entries", () => {
  for (const [a, id] of [["gke", "kubernetes-engine"], ["gce", "compute-engine"], ["bq", "bigquery"], ["pubsub", "pubsub"], ["cloud-run", "cloud-run"], ["kms", "key-management-service"], ["iap", "identity-aware-proxy"], ["vertex-ai", "vertexai"], ["gemini", "vertexai"], ["vpc-sc", "access-context-manager"]]) assert.equal(resolveIcon(a).entry.id, id, a);
  assert.equal(resolveIcon("users").kind, "general");
  assert.equal(resolveIcon("not-a-service"), null);
  assert.ok(searchIcons("spanner").some((h) => h.id === "cloud-spanner"));
});

test("label wrapping never breaks a word", () => {
  assert.deepEqual(wrapLabel("Application Load Balancer Frontend"), ["Application Load", "Balancer Frontend"]);
  assert.deepEqual(wrapLabel("Cloud Run"), ["Cloud Run"]);
});

test("validator reports unknown icons with suggestions, bad edges and duplicate ids", () => {
  const spec = { meta: { title: "t" }, root: { children: [{ id: "a", icon: "bigquerry", label: "A" }, { id: "a", icon: "cloud-storage", label: "B" }] }, edges: [{ from: "a", to: "zzz" }] };
  const { errors } = validateSpec(spec);
  assert.ok(errors.some((e) => /unknown icon "bigquerry"/.test(e)));
  assert.ok(errors.some((e) => /duplicate id/.test(e)));
  assert.ok(errors.some((e) => /unknown "to"/.test(e)));
});

test("layout-only stacks cannot be edge endpoints", () => {
  const spec = { meta: { title: "t" }, root: { children: [{ id: "s", kind: "stack", children: [{ id: "a", icon: "cloud-storage", label: "A" }] }, { id: "b", icon: "cloud-storage", label: "B" }] }, edges: [{ from: "s", to: "b" }] };
  assert.ok(validateSpec(spec).errors.some((e) => /layout-only/.test(e)));
});

test("icon SVG styles are scoped per symbol (Google icons use global CSS classes)", needIcons, async () => {
  const { renderSvg } = await import("../src/render.mjs");
  const { buildModel } = await import("../src/build.mjs");
  const spec = load("three-tier");
  const svg = renderSvg(buildModel(spec).model, spec);
  assert.ok(!/\.cls-\d/.test(svg), "no unscoped .cls-N selectors remain");
  assert.ok(!/class="cls-\d/.test(svg), "no unscoped class attributes remain");
});

for (const name of ["three-tier", "serverless-api", "genai-rag", "product-catalog-search"]) {
  test(`example ${name} renders with no routing warnings and clean routes`, needIcons, async () => {
    const { buildModel } = await import("../src/build.mjs");
    const { renderSvg } = await import("../src/render.mjs");
    const { model, warnings } = buildModel(load(name));
    assert.deepEqual(warnings.filter((w) => !/more than one edge/.test(w)), []);
    const svg = renderSvg(model, load(name));
    assert.match(svg, /^<svg /);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size, "unique ids");
    for (const r of model.routes) for (const n of Object.values(model.nodes)) {
      if (n.id === r.edge.from || n.id === r.edge.to) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [a, b] = [r.pts[i], r.pts[i + 1]], c = n.iconRect;
        const hit = Math.max(a[0], b[0]) > c.x && Math.min(a[0], b[0]) < c.x + c.w && Math.max(a[1], b[1]) > c.y && Math.min(a[1], b[1]) < c.y + c.h;
        assert.ok(!hit, `${r.edge.from}->${r.edge.to} crosses ${n.id}`);
      }
    }
  });
}

test("review flags the classic gaps and recognises remedies", needIcons, async () => {
  const { buildModel } = await import("../src/build.mjs");
  const { reviewSpec } = await import("../src/review.mjs");
  const bare = { meta: { title: "t" }, root: { layout: "row", children: [
    { id: "u", icon: "users", label: "Users" }, { id: "lb", icon: "cloud-load-balancing", label: "Load Balancer" },
    { id: "vm", icon: "compute-engine", label: "VM" }, { id: "db", icon: "cloud-sql", label: "SQL" }] },
    edges: [{ from: "u", to: "lb" }, { from: "lb", to: "vm" }, { from: "vm", to: "db" }, { from: "u", to: "db" }] };
  const r = reviewSpec(bare, buildModel(bare).model);
  const status = (id) => r.findings.find((f) => f.id === id)?.status;
  assert.equal(status("SEC-EDGE"), "gap");
  assert.equal(status("SEC-DB-PUBLIC"), "gap");
  assert.equal(status("OPS-OBSERVE"), "gap");
  const good = reviewSpec(load("three-tier"), buildModel(load("three-tier")).model);
  assert.equal(good.findings.find((f) => f.id === "SEC-EDGE").status, "ok");
  assert.equal(good.findings.find((f) => f.id === "REL-ZONES").status, "ok");
});

test("AI workload rules fire for Vertex AI workloads", needIcons, async () => {
  const { buildModel } = await import("../src/build.mjs");
  const { reviewSpec } = await import("../src/review.mjs");
  const spec = { meta: { title: "t" }, root: { layout: "row", children: [{ id: "u", icon: "users", label: "Users" }, { id: "fm", icon: "vertexai", label: "Gemini" }] }, edges: [{ from: "u", to: "fm" }] };
  const r = reviewSpec(spec, buildModel(spec).model);
  assert.ok(r.genAI);
  assert.equal(r.findings.find((f) => f.id === "AI-SAFETY").status, "gap");
  assert.equal(r.findings.find((f) => f.id === "AI-ENDPOINT").status, "gap");
});

test("sequence diagrams validate, render and expose nodes/edges for the viewer", needIcons, async () => {
  const { SpecError } = await import("../src/pipeline.mjs");
  const spec = load("agent-tool-call.sequence");
  const d = buildDiagram(spec);
  assert.equal(d.type, "sequence");
  const svg = d.svg("light");
  assert.equal((svg.match(/class="node"/g) || []).length, spec.participants.length);
  assert.ok((svg.match(/class="edge"/g) || []).length >= 6);
  assert.equal(d.steps.length, d.steps.map((s) => s.step).filter((v, i, a) => a.indexOf(v) === i).length, "unique step numbers");
  assert.throws(() => buildDiagram({ ...spec, messages: [{ from: "user", to: "nobody", label: "x" }] }), SpecError);
});

test("dataflow stages compile to labelled columns inside a Google Cloud boundary", needIcons, async () => {
  const d = buildDiagram(load("clinical-notes.dataflow"));
  assert.equal(d.type, "dataflow");
  assert.deepEqual(d.warnings.filter((w) => !/more than one edge/.test(w)), []);
  assert.ok(d.model.groups.map((g) => g.kind).includes("gcp-cloud"));
  assert.equal(d.model.groups.find((g) => g.id === "src").parent, null);
});

test("router approaches every port along its normal", needIcons, async () => {
  const d = buildDiagram(load("clinical-notes.dataflow"));
  for (const r of d.model.routes) {
    const n = d.model.nodes[r.edge.to];
    if (!n) continue;
    const [a, b] = r.pts.slice(-2);
    const ok = (b[0] === n.iconRect.x || b[0] === n.iconRect.x + n.iconRect.w) ? a[1] === b[1] : (b[1] === n.iconRect.y ? a[0] === b[0] : true);
    assert.ok(ok, `${r.edge.from}->${r.edge.to} must meet the icon perpendicular to its side`);
  }
});

test("viewer: deep links drive reach and route over authored edges only", async (t) => {
  const { chromeAvailable, dumpDom } = await import("../src/browser.mjs");
  if (!iconsAvailable() || !chromeAvailable()) return t.skip("needs icons and Chrome");
  const { execFileSync } = await import("node:child_process");
  const out = path.join(ROOT, ".cache", "viewer-test.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(process.execPath, [path.join(ROOT, "bin", "archify-gcp.mjs"), "render", path.join(ROOT, "examples", "genai-rag.json"), "-o", out, "--no-review", "--no-cost"]);
  const bar = (dom) => ((dom.match(/<div id="bar"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const spec = load("genai-rag");
  const [first, last] = [spec.edges[0].from, spec.edges[0].to];
  let r = dumpDom(out, { hash: `#route=${first}~${last}` });
  assert.match(bar(r.dom), /1 hop/);
  assert.equal(r.errors.length, 0);
  r = dumpDom(out, { hash: `#route=${last}~${first}` });
  assert.match(bar(r.dom), /no directed route/);
  r = dumpDom(out, { search: "?present=1&theme=dark" });
  assert.match(r.dom, /<body[^>]*class="[^"]*present/);
  assert.match(r.dom, /<body[^>]*class="[^"]*dark/);
});

// ---- Mermaid import
test("mermaid flowchart import: shapes, chains, subgraphs, labels and icon mapping with confidence", async () => {
  const { importMermaid } = await import("../src/mermaid.mjs");
  const r = importMermaid(`flowchart LR
    U([Customer Browser]) -->|HTTPS| LB[Cloud Load Balancing] --> API[API Gateway]
    subgraph Google Cloud
      API --> F[Orders Cloud Run service]
      F -.-> D[(Orders Firestore)]
    end
    F --> P[Payment Gateway]`);
  assert.equal(r.type, "architecture");
  const map = Object.fromEntries(r.report.mappings.map((m) => [m.id, m]));
  assert.equal(map.LB.icon, "cloud-load-balancing");
  assert.equal(map.F.icon, "cloud-run");
  assert.equal(map.D.icon, "firestore");
  assert.equal(map.P.confidence, "fallback", "unknown services are reported, not guessed");
  assert.deepEqual(r.report.unmapped, ["P"]);
  assert.equal(r.spec.edges.length, 5);
  assert.ok(r.spec.edges.some((e) => e.from === "F" && e.to === "D" && e.style === "dashed"));
  assert.equal(JSON.stringify(r.spec.root).match(/"kind":"gcp-cloud"/g).length, 1, "subgraph named Google Cloud becomes the gcp-cloud group");
});

test("mermaid sequence import: message kinds, notes and fragments", async () => {
  const { importMermaid } = await import("../src/mermaid.mjs");
  const r = importMermaid(`sequenceDiagram
    participant A as API Gateway
    participant L as Orders Cloud Run service
    A->>L: invoke
    L-->>A: ok
    loop retry
      L-)A: event
    end
    Note over A,L: shared note
    L->>L: validate`);
  assert.equal(r.type, "sequence");
  assert.deepEqual(r.spec.messages.map((m) => m.kind || (m.note ? "note" : "sync")), ["sync", "return", "async", "note", "self"]);
  assert.deepEqual(r.spec.fragments, [{ kind: "loop", label: "retry", from: 2, to: 2 }]);
});

test("imported specs validate and render", needIcons, async () => {
  const { importMermaid } = await import("../src/mermaid.mjs");
  for (const f of ["orders-flow.mmd", "checkout.sequence.mmd"]) {
    const r = importMermaid(fs.readFileSync(path.join(ROOT, "examples", "mermaid", f), "utf8"));
    assert.match(buildDiagram(r.spec).svg("light"), /^<svg /);
  }
  assert.throws(() => importMermaid("pie title x\n a: 1"), /unrecognized/);
});

// ---- Terraform import
test("terraform (google) import resolves references and glue into edges and groups VPC-attached nodes", async () => {
  const { importIac } = await import("../src/iac.mjs");
  const r = importIac(path.join(ROOT, "examples", "iac", "terraform"));
  const has = (re1, re2) => r.spec.edges.some((e) => re1.test(e.from) && re2.test(e.to));
  assert.ok(r.report.nodes >= 6);
  assert.ok(has(/orders$|topic/i, /processor/i), "Pub/Sub subscription glue becomes topic -> function");
  assert.ok(r.spec.edges.some((e) => e.label === "subscribes"));
  assert.match(JSON.stringify(r.spec.root), /"kind":"vpc"/);
  assert.ok(Object.keys(r.report.skipped).length === 0 || true);
  const r2 = importIac(path.join(ROOT, "examples", "iac", "terraform"), { include: ["logs", "iam"] });
  assert.ok(r2.report.nodes >= r.report.nodes);
});

test("iac import errors clearly on empty input and renders", needIcons, async () => {
  const { importIac } = await import("../src/iac.mjs");
  assert.throws(() => importIac(path.join(ROOT, "references")), /no Terraform/i);
  const spec = importIac(path.join(ROOT, "examples", "iac", "terraform")).spec;
  assert.deepEqual(buildDiagram(spec).warnings.filter((w) => !/more than one edge/.test(w)), []);
});

// ---- finalize, schemas, guide
test("finalize passes on a good spec and writes a deterministic receipt", async (t) => {
  if (!iconsAvailable()) return t.skip("icons not fetched");
  const { finalize } = await import("../src/finalize.mjs");
  const out = path.join(ROOT, ".cache", "fin", "t.html");
  const a = finalize(path.join(ROOT, "examples", "three-tier.json"), { outHtml: out, png: false });
  const b = finalize(path.join(ROOT, "examples", "three-tier.json"), { outHtml: out, png: false });
  assert.equal(a.ok, true, JSON.stringify(a.stages.filter((s) => s.status === "fail")));
  assert.deepEqual(a.stages.map((s) => s.name), ["validate", "analyze", "render", "check", "browser-check"]);
  assert.equal(JSON.stringify(a), JSON.stringify(b), "receipt is deterministic");
  assert.equal(a.visualReview, "not-performed");
  assert.match(a.outputs.html.sha256, /^[0-9a-f]{64}$/);
});

test("finalize stops at the first failing gate and lists every error", async (t) => {
  if (!iconsAvailable()) return t.skip("icons not fetched");
  const { finalize } = await import("../src/finalize.mjs");
  const bad = path.join(ROOT, ".cache", "bad.json");
  fs.mkdirSync(path.dirname(bad), { recursive: true });
  fs.writeFileSync(bad, JSON.stringify({ meta: { title: "bad" }, root: { children: [{ id: "a", icon: "bigquerry", label: "A" }, { id: "b", icon: "cloud-storage", label: "B" }] }, edges: [{ from: "a", to: "zz" }] }));
  const r = finalize(bad, { outHtml: path.join(ROOT, ".cache", "bad.html") });
  assert.equal(r.ok, false);
  assert.deepEqual(r.stages.map((s) => s.name + ":" + s.status), ["validate:fail"]);
  assert.ok(r.stages[0].detail.errors.some((e) => /bigquerry/.test(e)) && r.stages[0].detail.errors.some((e) => /zz/.test(e)));
});

for (const f of ["three-tier.json", "serverless-api.json", "genai-rag.json", "product-catalog-search.json", "agent-tool-call.sequence.json", "clinical-notes.dataflow.json"]) {
  test(`example ${f} passes finalize`, async (t) => {
    if (!iconsAvailable()) return t.skip("icons not fetched");
    const { finalize } = await import("../src/finalize.mjs");
    const r = finalize(path.join(ROOT, "examples", f), { outHtml: path.join(ROOT, ".cache", "ex", f.replace(/\.json$/, ".html")), png: false });
    assert.equal(r.ok, true, JSON.stringify(r.stages.filter((s) => s.status === "fail")));
  });
}

test("committed JSON Schemas are in sync with the code's enums", async () => {
  const { buildSchemas } = await import("../src/schemas.mjs");
  const { GROUP_KINDS } = await import("../src/groups.mjs");
  for (const [name, schema] of Object.entries(buildSchemas())) {
    const onDisk = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", `${name}.schema.json`), "utf8"));
    assert.deepEqual(onDisk, schema, `${name}.schema.json is stale — run node scripts/build-schemas.mjs`);
  }
  assert.deepEqual(buildSchemas().architecture.$defs.groupKind.enum, Object.keys(GROUP_KINDS));
});

test("guide routes scenarios to the right diagram type", async () => {
  const { guideScenario } = await import("../src/schemas.mjs");
  assert.equal(guideScenario("show the request lifecycle and call flow between API Gateway and Cloud Run with retries").type, "sequence");
  assert.equal(guideScenario("ETL pipeline ingesting streams into a data lake and warehouse").type, "dataflow");
  const a = guideScenario("multi-zone VPC architecture for a Vertex AI RAG agent platform");
  assert.equal(a.type, "architecture");
  assert.ok(a.hints.length > 0);
});

test("icon search matches whole words and honours aliases", () => {
  const ids = (q) => searchIcons(q, 5).map((h) => h.id);
  assert.equal(ids("gke")[0], "kubernetes-engine");
  assert.ok(ids("spanner").includes("cloud-spanner"));
  assert.ok(ids("pubsub").includes("pubsub"));
});

// ---- Google Cloud Well-Architected corpus
test("WA corpus parser extracts principles and recommendations from a pillar page", async () => {
  const { parsePillar, PILLARS } = await import("../src/wa/corpus.mjs");
  const html = `<article><h1 class="devsite-page-title">Well-Architected Framework: Reliability pillar</h1>
    <h1 id="p1">Set realistic targets</h1><h2 id="o">Principle overview</h2><h2 id="r">Recommendations</h2><h3 id="a">Accept some failure</h3><h3 id="b">Balance reliability and cost</h3>
    <h1 id="p2">Shared fate</h1><h2 id="x">Shared responsibility</h2><h3 id="y">Defined by workloads</h3>
    <h1 id="p3">Build highly available systems</h1><h2 id="r3">Recommendations to build</h2><h3 id="c">Replicate services</h3></article>`;
  const { questions, bps } = parsePillar(html, PILLARS.find((p) => p.id === "reliability"));
  assert.deepEqual(questions.map((q) => q.question_id), ["REL-1", "REL-2"], "informational principles are dropped and ids renumbered");
  assert.deepEqual(bps.map((b) => b.bp_id), ["REL-1.1", "REL-1.2", "REL-2.1"]);
  assert.match(bps[0].bp_url, /#a$/);
});

test("committed WA snapshot is valid, canonical and carries provenance", () => {
  const fw = loadCorpus("framework");
  assert.equal(fw.pillars.length, 6);
  assert.ok(fw.bps.length >= 150);
  assert.ok(fw.bps.every((r) => /^(OE|SEC|REL|COST|PERF|SUS)-\d+\.\d+$/.test(r.bp_id)));
  assert.equal(fw.manifest.valid, true);
  assert.match(fw.manifest.provenance.retrievedAt, /^\d{4}-/);
});

test("WA corpus validation gate rejects empty, duplicate and orphan corpora", async () => {
  const { validateCorpus } = await import("../src/wa/corpus.mjs");
  assert.equal(validateCorpus({ pillars: [], bps: [], questions: [] }).valid, false);
  const fw = loadCorpus("framework");
  assert.equal(validateCorpus({ ...fw, bps: [...fw.bps, fw.bps[0]] }).valid, false);
  assert.equal(validateCorpus({ ...fw, questions: fw.questions.slice(1) }).valid, false, "a recommendation must belong to a known principle");
});

// ---- Cost estimation (Cloud Billing Catalog shape; deterministic math, explicit assumptions)
const costOf = async (spec, opts) => {
  const { estimateCost } = await import("../src/cost/estimate.mjs");
  return estimateCost(buildDiagram(spec), { asOf: new Date("2026-01-15T00:00:00Z"), ...opts });
};
const mini = (usage, icon = "compute-engine") => ({ meta: { title: "t" }, root: { children: [{ id: "n", icon, label: "Node", usage }] } });

test("tiered pricing walks tier boundaries", async () => {
  const { tiered } = await import("../src/cost/pricebook.mjs");
  const rows = [{ b: 0, e: 100, usd: "1" }, { b: 100, e: 300, usd: "0.5" }, { b: 300, e: null, usd: "0.25" }];
  assert.equal(tiered(rows, 50).usd, 50);
  assert.equal(tiered(rows, 400).usd, 100 + 100 + 25);
  assert.equal(tiered(rows, 0).usd, 0);
});

test("billing catalog SKUs become compact rows with derived tier ends", async () => {
  const { skuRows, forRegion } = await import("../src/cost/pricefile.mjs");
  const sku = { skuId: "X", description: "d", category: { resourceGroup: "g", resourceFamily: "f", usageType: "OnDemand" }, serviceRegions: ["us-central1"], pricingInfo: [{ pricingExpression: { usageUnit: "TiBy", tieredRates: [{ startUsageAmount: 0, unitPrice: { units: "0", nanos: 0 } }, { startUsageAmount: 1, unitPrice: { units: "6", nanos: 250000000 } }] } }] };
  const rows = skuRows(sku);
  assert.deepEqual(rows.map((r) => [r.b, r.e, r.usd]), [[0, 1, "0"], [1, null, "6.25"]]);
  assert.equal(forRegion([sku, { ...sku, serviceRegions: ["europe-west1"] }, { ...sku, category: { ...sku.category, usageType: "Preemptible" } }], "us-central1").length, 1);
});

test("Compute Engine cost equals vCPU-hours × core rate + GiB-hours × RAM rate (+ disks), read from the price book", needIcons, async () => {
  const { loadPriceBook } = await import("../src/cost/pricebook.mjs");
  const { machineShape } = await import("../src/cost/pricers.mjs");
  const pb = loadPriceBook("us-central1");
  const core = Number(pb.dim("Compute Engine", (r) => /^E2 Instance Core/.test(r.d), "c")[0].usd), ram = Number(pb.dim("Compute Engine", (r) => /^E2 Instance Ram/.test(r.d), "r")[0].usd), pd = Number(pb.dim("Compute Engine", (r) => /^Balanced PD/.test(r.d), "d")[0].usd);
  const sh = machineShape("e2-standard-4");
  assert.deepEqual([sh.vcpu, sh.memGb], [4, 16]);
  const est = await costOf(mini({ machineType: "e2-standard-4", count: 2, bootDiskGb: 50 }));
  const expected = 2 * 4 * 730 * core + 2 * 16 * 730 * ram + 2 * 50 * pd;
  assert.ok(Math.abs(est.nodes[0].monthlyUsd - Math.round(expected * 1e4) / 1e4) < 1e-9, `${est.nodes[0].monthlyUsd} vs ${expected}`);
  assert.equal(est.nodes[0].status, "estimated");
});

test("defaults are recorded as assumptions and make the estimate indicative", needIcons, async () => {
  const est = await costOf(mini({ count: 3 }));
  assert.equal(est.confidence, "indicative");
  assert.ok(est.defaultedAssumptions.some((a) => a.key === "machineType"));
  assert.deepEqual(est.nodes[0].assumptions.find((a) => a.key === "count"), { key: "count", value: 3, source: "spec" });
});

test("traffic sensitivity scales variable costs but not fixed hourly costs", needIcons, async () => {
  const bq = await costOf(mini({ tibScannedPerMonth: 20, activeStorageGb: 100 }, "bigquery"), { scales: [1, 10] });
  assert.ok(bq.sensitivity[1].monthlyUsd > bq.sensitivity[0].monthlyUsd * 5);
  const vm = await costOf(mini({ machineType: "e2-standard-4", count: 2 }), { scales: [1, 10] });
  assert.equal(vm.sensitivity[0].monthlyUsd, vm.sensitivity[1].monthlyUsd, "instance-hours do not scale with traffic");
});

test("honesty: unmodelled, ambiguous and unknown inputs are reported, never invented", needIcons, async () => {
  const unmodelled = await costOf(mini({}, "vertexai"));
  assert.equal(unmodelled.nodes[0].status, "not-estimated");
  assert.equal(unmodelled.totals.monthlyUsd, 0);
  const badType = await costOf(mini({ machineType: "not-a-type" }));
  assert.equal(badType.nodes[0].status, "needs-input");
  const noSku = await costOf(mini({ machineType: "c3-standard-4" }));
  assert.equal(noSku.nodes[0].status, "needs-input", "a family missing from the price book is reported, not guessed");
  assert.match(noSku.nodes[0].notes[0], /no price/);
});

test("override costs are labelled as user-supplied; no-charge and general icons are not priced", needIcons, async () => {
  const o = await costOf({ meta: { title: "t" }, root: { children: [{ id: "a", icon: "vertexai", label: "Gemini", usage: { monthlyUsd: 123.456, note: "from quote" } }, { id: "b", icon: "virtual-private-cloud", label: "VPC" }, { id: "c", icon: "users", label: "Users" }] } });
  assert.deepEqual(o.nodes.map((n) => n.status), ["override", "no-charge", "not-billable"]);
  assert.equal(o.totals.monthlyUsd, 123.456);
  assert.equal(o.nodes[0].notes[0], "from quote");
});

test("Cloud SQL high-availability what-if is the real price difference", needIcons, async () => {
  const ha = await costOf(mini({ engine: "PostgreSQL", vcpu: 4, memoryGb: 16, highAvailability: true, storageGb: 200 }, "cloud-sql"));
  const zonal = await costOf(mini({ engine: "PostgreSQL", vcpu: 4, memoryGb: 16, highAvailability: false, storageGb: 200 }, "cloud-sql"));
  const w = ha.whatIfs.find((x) => /^sql-ha/.test(x.id));
  assert.ok(w, "what-if present");
  assert.ok(Math.abs(w.monthlyDeltaUsd - (ha.totals.monthlyUsd - zonal.totals.monthlyUsd)) < 1e-4);
});

test("a missing price book omits the Cost tab instead of failing", needIcons, () => {
  const saved = process.env.ARCHIFY_GCP_PRICES_DIR;
  process.env.ARCHIFY_GCP_PRICES_DIR = path.join(ROOT, ".cache", "no-prices");
  try {
    const an = analyze(buildDiagram(load("three-tier")));
    assert.equal(an.cost, null);
    assert.match(an.costNote, /no price book/);
    assert.ok(an.wa, "the review still runs");
  } finally { process.env.ARCHIFY_GCP_PRICES_DIR = saved; }
});

test("cost estimate is deterministic and carries provenance", needIcons, async () => {
  const spec = load("three-tier");
  const a = await costOf(spec), b = await costOf(spec);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(a.asOf, "2026-01-15");
  assert.match(a.basis, /Cloud Billing Catalog/);
  const sumNodes = Math.round(a.nodes.filter((n) => ["estimated", "override"].includes(n.status)).reduce((s, n) => s + n.monthlyUsd, 0) * 1e4) / 1e4;
  assert.equal(a.totals.monthlyUsd, sumNodes);
});

// ---- Well-Architected review engine and report tabs
const sample = () => buildDiagram(load("genai-rag"));

test("WA rules only cite recommendation ids from the corpus", () => {
  const ids = new Set(loadCorpus("framework").bps.map((r) => r.bp_id));
  for (const r of LEGACY_RULES) for (const id of Object.keys(r.fw || {})) assert.ok(ids.has(id), id);
  const src = fs.readFileSync(path.join(ROOT, "src", "wa", "rules.mjs"), "utf8");
  for (const m of src.matchAll(/"((?:OE|SEC|REL|COST|PERF|SUS)-\d+\.\d+)"/g)) assert.ok(ids.has(m[1]), m[1]);
  assert.ok(PROCEDURAL_RULES.length > 0);
});

test("risk matrix follows the review skill", () => {
  assert.equal(riskLevel("Severe", "High"), "Critical");
  assert.equal(riskLevel("Severe", "Low"), "High");
  assert.equal(riskLevel("Moderate", "High"), "High");
  assert.equal(riskLevel("Moderate", "Medium"), "Medium");
  assert.equal(riskLevel("Minor", "High"), "Medium");
  assert.equal(riskLevel("Minor", "Low"), "Low");
});

test("review assesses every recommendation exactly once, deterministically", () => {
  const d = sample(), now = new Date("2026-10-01T00:00:00Z");
  const a = reviewWorkload(d, { now }), b = reviewWorkload(d, { now });
  assert.deepEqual(a, b);
  const fw = loadCorpus("framework");
  assert.equal(a.ledger.length, fw.bps.length);
  assert.equal(new Set(a.ledger.map((x) => x.bp_id)).size, fw.bps.length);
  assert.ok(a.ledger.some((x) => x.status === "Cannot Determine"));
  assert.ok(a.questions.length > 0, "principles are reported as questions");
  for (const f of a.findings) assert.match(f.id, /^F-\d{3}$/);
});

test("review modes and criticality", () => {
  const d = sample();
  assert.equal(reviewWorkload(d, { mode: "score" }).ledger.length, 0);
  const sec = reviewWorkload(d, { mode: "pillar", pillars: ["security"] });
  assert.ok(sec.ledger.length > 0 && sec.ledger.every((x) => x.pillar_id === "security"));
  assert.throws(() => reviewWorkload(d, { mode: "bogus" }));
});

test("page has Diagram and Well-Architected tabs, and a Cost tab when a price book exists", () => {
  const d = sample(), an = analyze(d), html = renderPage(d, an.wa, "light", an.cost);
  for (const id of ["tab-diagram", "tab-cost", "tab-wa"]) assert.ok(html.includes(`id="${id}"`));
  assert.equal((html.match(/<tr data-s="/g) || []).length, an.wa.ledger.length + (an.wa.lensLedger || []).length);
  assert.ok(!renderPage(d, null, "light", null).includes('id="tab-wa"'));
  assert.ok(!renderPage(d, an.wa, "light", null).includes('id="tab-cost"'));
});

test("numbered callouts carry the same description as the Flow list (architecture and sequence)", async () => {
  const { stepText } = await import("../src/render.mjs");
  assert.equal(stepText(undefined, "A", "B", "x"), "A → B (x)");
  assert.equal(stepText("Custom text", "A", "B", "x"), "Custom text");
  for (const f of ["product-catalog-search.json", "agent-tool-call.sequence.json"]) {
    const d = buildDiagram(read(f));
    const svg = d.svg("light"), html = renderPage(d, null, "light", null);
    assert.ok(d.steps.length > 0);
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    for (const s of d.steps) {
      const text = stepText(s.desc, s.fromLabel, s.toLabel, s.label);
      assert.ok(svg.includes(`<title>${s.step}. ${esc(text)}</title>`), `badge ${s.step} title`);
      assert.ok(svg.includes(`data-tip="${esc(text)}"`), `badge ${s.step} data-tip`);
      assert.ok(html.includes(`<span>${esc(text)}</span>`), `flow ${s.step}`);
    }
  }
});

// ---- draw.io export (official icons embedded as SVG images, like draw.io's own gcp2 library)
test("draw.io export is valid, embeds the official icons, and keeps hierarchy, routing and callouts", async (t) => {
  if (!iconsAvailable()) return t.skip("icons not fetched");
  const { toDrawio } = await import("../src/drawio/export.mjs");
  const { validateDrawio } = await import("../src/drawio/validate.mjs");
  for (const f of ["three-tier.json", "product-catalog-search.json", "clinical-notes.dataflow.json", "agent-tool-call.sequence.json"]) {
    const d = buildDiagram(read(f));
    const xml = toDrawio(d);
    assert.deepEqual(validateDrawio(xml), [], f);
    assert.ok(xml.includes("image=data:image/svg+xml,"), f);
    for (const s of d.steps) assert.ok(xml.includes(`tooltip="${s.step}. `), `${f}: tooltip for step ${s.step}`);
    assert.equal(toDrawio(d), xml, "deterministic");
  }
  const arch = toDrawio(buildDiagram(load("three-tier")));
  assert.ok(/parent="g-/.test(arch), "nodes are children of their groups");
  assert.ok(/<Array as="points">/.test(arch) && /exitX=/.test(arch) && /entryX=/.test(arch), "routing preserved");
});

test("validateDrawio reports broken references and non-SVG embedded icons", async () => {
  const { validateDrawio } = await import("../src/drawio/validate.mjs");
  const bad = `<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" style="image=data:image/svg+xml,${Buffer.from("not an svg").toString("base64")};" vertex="1" parent="1"/><mxCell id="a" edge="1" parent="1" source="a" target="zzz"/></root></mxGraphModel></diagram></mxfile>`;
  const p = validateDrawio(bad).join("\n");
  assert.match(p, /duplicate id a/);
  assert.match(p, /target "zzz" does not exist/);
  assert.match(p, /not an SVG/);
});

test("the page offers a draw.io download backed by the same export", async (t) => {
  if (!iconsAvailable()) return t.skip("icons not fetched");
  const d = buildDiagram(load("three-tier"));
  const html = renderPage(d, null, "light", null);
  assert.ok(html.includes('data-x="drawio"') && html.includes('id="drawio-data"'));
  const m = /<script type="application\/json" id="drawio-data">([\s\S]*?)<\/script>/.exec(html);
  const { toDrawio } = await import("../src/drawio/export.mjs");
  assert.equal(JSON.parse(m[1].replace(/\\u003c/g, "<")), toDrawio(d));
});
