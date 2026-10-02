#!/usr/bin/env node
// Builds data/prices/<region>.json from the Cloud Billing Catalog API (https://cloud.google.com/billing/docs/how-to/get-pricing-information-api).
//   GOOGLE_API_KEY=... node scripts/fetch-prices.mjs [--region us-central1] [--services "Compute Engine,Cloud Run"]
// The API needs an API key of your own: enable the Cloud Billing API on a project and create an API key restricted to it.
// Only on-demand list prices that apply to the region (or to a multi-region / global scope) are kept, in a compact form.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, skuRows, forRegion } from "../src/cost/pricefile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const region = opt("--region", "us-central1");
const only = opt("--services")?.split(",");
const key = opt("--key") || process.env.GOOGLE_API_KEY;
if (!key) { console.error("GOOGLE_API_KEY is required (or --key). Enable the Cloud Billing API on a project and create an API key: https://cloud.google.com/billing/docs/how-to/get-pricing-information-api"); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Services the pricers use, by Cloud Billing display name. */
export const SERVICES = ["Compute Engine", "Kubernetes Engine", "Cloud Run", "Cloud Functions", "Cloud Storage", "BigQuery", "Cloud Pub/Sub", "Cloud SQL", "Cloud Logging", "Networking"];
const ALIASES = { "Cloud Pub/Sub": "Pub/Sub" }; // price-book key used by pricers

async function get(url) {
  for (let a = 0; a < 8; a++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    if (r.status !== 429 && r.status < 500) throw new Error(`HTTP ${r.status} for ${url.replace(/key=[^&]+/, "key=***")}: ${(await r.text()).slice(0, 200)}`);
    await sleep(2000 * (a + 1));
  }
  throw new Error("giving up after repeated rate limiting");
}
const services = [];
for (let tok = ""; ;) {
  const j = await get(`${API}/services?pageSize=5000${tok ? `&pageToken=${tok}` : ""}&key=${key}`);
  services.push(...(j.services || []));
  if (!(tok = j.nextPageToken)) break;
}
const file = path.join(root, "data", "prices", `${region}.json`);
const book = fs.existsSync(file) && only ? JSON.parse(fs.readFileSync(file, "utf8")) : { schema_version: "archify-gcp.prices.v1", region, services: {} };
book.retrievedAt = new Date().toISOString();
for (const name of SERVICES) {
  if (only && !only.includes(name)) continue;
  const svc = services.find((s) => s.displayName === name);
  if (!svc) { console.error(`${name}: not found in the Cloud Billing service list`); continue; }
  const skus = [];
  for (let tok = ""; ;) {
    const j = await get(`${API}/${svc.name}/skus?currencyCode=USD&pageSize=5000${tok ? `&pageToken=${tok}` : ""}&key=${key}`);
    skus.push(...(j.skus || []));
    if (!(tok = j.nextPageToken)) break;
    await sleep(300);
  }
  const kept = forRegion(skus, region);
  const rows = kept.flatMap(skuRows);
  const dates = kept.map((s) => s.pricingInfo?.[0]?.effectiveTime).filter(Boolean).sort();
  book.services[ALIASES[name] || name] = { serviceId: svc.serviceId, publicationDate: dates.length ? dates[dates.length - 1] : null, rows };
  console.error(`${name}: ${rows.length} rows kept from ${skus.length} SKUs`);
}
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(book) + "\n");
console.error(`wrote ${path.relative(root, file)} (${(fs.statSync(file).size / 1e6).toFixed(2)} MB)`);
