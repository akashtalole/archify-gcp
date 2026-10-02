// Well-Architected corpus: every pillar, principle and recommendation of the Google Cloud Well-Architected Framework.
// Each pillar publishes a printable page whose structure is: pillar > core principle (H1) > "Recommendations" (H2) > recommendation (H3).
// Google does not number them, so archify-gcp derives ids from the page order (REL-3 = third principle of Reliability, REL-3.2 = its second
// recommendation) and stores the page anchor and title with each id. Ids are therefore stable for a snapshot and re-derived on refresh;
// a test checks that every id used by an evidence rule exists in the snapshot. A validation gate must pass before any assessment, and a
// committed snapshot makes reviews work offline (`wa corpus --refresh` re-reads the live pages).
// Mapping to the shared engine: a principle is a "question" and a recommendation is a "best practice" (BP).
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../catalog.mjs";

const BASE = "https://cloud.google.com/architecture/framework/";
export const PILLARS = [
  { id: "operational-excellence", name: "Operational excellence", prefix: "OE", page: "operational-excellence/printable" },
  { id: "security", name: "Security, privacy, and compliance", prefix: "SEC", page: "security/printable" },
  { id: "reliability", name: "Reliability", prefix: "REL", page: "reliability/printable" },
  { id: "cost-optimization", name: "Cost optimization", prefix: "COST", page: "cost-optimization/printable" },
  { id: "performance-optimization", name: "Performance optimization", prefix: "PERF", page: "performance-optimization/printable" },
  { id: "sustainability", name: "Sustainability", prefix: "SUS", page: "sustainability/printable" },
];
export const SOURCES = { framework: { name: "Google Cloud Well-Architected Framework", base: BASE, file: "framework.json" } };
const ID = /^(OE|SEC|REL|COST|PERF|SUS)-\d+\.\d+$/;
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rsquo;|&#x27;/g, "'").replace(/\s+/g, " ").trim();

/** Pure: parse one pillar's printable page into principles (questions) and recommendations (BPs). */
export function parsePillar(html, pillar, pageUrl = BASE + pillar.page) {
  const body = (/<article[\s\S]*?<\/article>/.exec(html) || [html])[0];
  const questions = [], bps = [];
  let q = null, inRecs = false;
  for (const m of body.matchAll(/<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\1>/g)) {
    const level = Number(m[1]), id = (/\bid="([^"]+)"/.exec(m[2]) || [])[1] || "", title = text(m[3]);
    if (!title) continue;
    if (level === 1) {
      if (/^Well-Architected Framework:/i.test(title)) continue; // page title, not a principle
      q = { question_id: `${pillar.prefix}-${questions.length + 1}`, question_title: title, pillar_id: pillar.id, pillar_name: pillar.name, question_url: `${pageUrl}#${id}` };
      questions.push(q); inRecs = false;
    } else if (level === 2) inRecs = !!q && /^Recommendations\b/i.test(title);
    else if (level === 3 && inRecs && q && !/^Product summary$/i.test(title)) {
      const n = bps.filter((b) => b.question_id === q.question_id).length + 1;
      bps.push({ bp_id: `${q.question_id}.${n}`, bp_title: title, bp_url: `${pageUrl}#${id}`, question_id: q.question_id, pillar_id: pillar.id, pillar_name: pillar.name });
    }
  }
  // Informational principles (for example "Shared responsibilities and shared fate") carry no recommendations: leave them out and renumber.
  const kept = questions.filter((x) => bps.some((b) => b.question_id === x.question_id));
  if (kept.length === questions.length) return { questions, bps };
  const ren = new Map(kept.map((x, i) => [x.question_id, `${pillar.prefix}-${i + 1}`]));
  return {
    questions: kept.map((x) => ({ ...x, question_id: ren.get(x.question_id) })),
    bps: bps.map((b) => { const q2 = ren.get(b.question_id); const n = b.bp_id.split(".")[1]; return { ...b, question_id: q2, bp_id: `${q2}.${n}` }; }),
  };
}

/** The skill's validation gate. Returns {valid, errors, counts}. */
export function validateCorpus(c) {
  const errors = [];
  if (!c.bps.length) errors.push("zero recommendations parsed (acquisition failure)");
  const ids = new Set(c.bps.map((b) => b.bp_id));
  if (ids.size !== c.bps.length) errors.push("duplicate recommendation ids");
  for (const b of c.bps) {
    if (!ID.test(b.bp_id)) errors.push(`non-canonical recommendation id ${b.bp_id}`);
    const p = c.pillars.find((x) => x.id === b.pillar_id);
    if (!p) errors.push(`${b.bp_id} refers to unknown pillar`);
    else if (p.prefix && !b.bp_id.startsWith(p.prefix + "-")) errors.push(`${b.bp_id} does not belong to pillar ${p.name} (expected prefix ${p.prefix})`);
    if (!(c.questions || []).some((q) => q.question_id === b.question_id)) errors.push(`${b.bp_id} refers to unknown principle ${b.question_id}`);
    if (!b.bp_title) errors.push(`${b.bp_id} has no title`);
  }
  for (const p of c.pillars) if (!c.bps.some((b) => b.pillar_id === p.id)) errors.push(`pillar ${p.name} carries no recommendation`);
  for (const q of c.questions || []) if (!c.bps.some((b) => b.question_id === q.question_id)) errors.push(`principle ${q.question_id} has no recommendation`);
  const per = Object.fromEntries(c.pillars.map((p) => [p.id, c.bps.filter((b) => b.pillar_id === p.id).length]));
  const total = c.bps.length || 1;
  if (c.pillars.length > 1 && Math.max(...Object.values(per)) / total > 0.6) errors.push("implausible spread: one pillar holds >60% of recommendations");
  return { valid: errors.length === 0, errors, counts: { pillars: c.pillars.length, questions: (c.questions || []).length, bps: c.bps.length, perPillar: per } };
}

/** Network: read the six pillar pages (HTTPS, cloud.google.com only) and return a validated corpus. */
export async function acquireCorpus(lens = "framework", { fetchImpl = fetch } = {}) {
  const src = SOURCES[lens];
  if (!src) throw new Error(`unknown corpus "${lens}" (${Object.keys(SOURCES).join(", ")})`);
  const bps = [], questions = [];
  for (const p of PILLARS) {
    const url = BASE + p.page;
    if (!url.startsWith("https://cloud.google.com/")) throw new Error("corpus must be fetched over HTTPS from cloud.google.com");
    // The site sometimes serves a machine-translated variant (for example lang="fr-x-mtfrom-en"): insist on the English original and retry.
    let html = null, last = "";
    for (let attempt = 0; attempt < 8 && html === null; attempt++) {
      try {
        const res = await fetchImpl(url + "?hl=en", { headers: { "Accept-Language": "en-US,en;q=0.9" } });
        if (!res.ok) { last = `HTTP ${res.status}`; continue; }
        const body = await res.text(), title = text((/<h1[^>]*devsite-page-title[^>]*>([\s\S]*?)<\/h1>/.exec(body) || [])[1] || "");
        if (/^Well-Architected Framework: [\x20-\x7E]*?\bpillar\b/i.test(title)) html = body; else last = `unexpected page title "${title}" (translated variant?)`;
      } catch (e) { last = e.message; }
    }
    if (html === null) throw new Error(`cannot read ${url}: ${last}`);
    const r = parsePillar(html, p, BASE + p.page.replace(/\/printable$/, ""));
    questions.push(...r.questions); bps.push(...r.bps);
  }
  const parsed = { pillars: PILLARS.map(({ id, name, prefix, page }) => ({ id, name, prefix, url: BASE + page.replace(/\/printable$/, "") })), questions, bps };
  const manifest = { ...validateCorpus(parsed), provenance: { indexUrl: BASE, retrievedAt: new Date().toISOString() } };
  return { schema_version: "archify-gcp.wa-corpus.v1", lens, name: src.name, ...parsed, manifest };
}

const snapFile = (lens) => path.join(ROOT, "data", "wa", SOURCES[lens].file);
export function loadCorpus(lens = "framework") {
  if (!SOURCES[lens]) throw new Error(`unknown corpus "${lens}"`);
  const f = snapFile(lens);
  if (!fs.existsSync(f)) throw new Error(`no corpus snapshot for ${lens}; run \`archify-gcp wa corpus --refresh\``);
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  const v = validateCorpus(c); // never trust a snapshot silently: revalidate on load
  if (!v.valid) throw new Error(`corpus snapshot for ${lens} failed validation: ${v.errors.join("; ")}`);
  return c;
}
export function saveCorpus(c) { fs.mkdirSync(path.join(ROOT, "data", "wa"), { recursive: true }); fs.writeFileSync(snapFile(c.lens), JSON.stringify(c, null, 1) + "\n"); }
export const corpusAgeDays = (c) => Math.floor((Date.now() - Date.parse(c.manifest.provenance.retrievedAt)) / 86400000);
