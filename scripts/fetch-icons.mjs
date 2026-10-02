#!/usr/bin/env node
// Downloads the official Google Cloud icons, extracts the SVGs into assets/gcp-icons/ and rebuilds data/catalog.json.
// The icons are NOT committed: Google distributes them under its own terms (https://cloud.google.com/icons).
//   - google-cloud-legacy-icons.zip : ~216 product icons, one folder per product (<name>/<name>.svg, 24px)
//   - core-products-icons.zip       : the current-brand icons for core products (512px colour SVGs)
// A core-product icon replaces the legacy icon of the same product; products only in the core set are added.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readZip } from "../src/zip.mjs";
import { buildCatalog, CORE_TO_LEGACY } from "../src/catalog-build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://services.google.com/fh/files/misc/";
const LEGACY_URL = process.env.ARCHIFY_GCP_ICON_URL || BASE + "google-cloud-legacy-icons.zip";
const CORE_URL = process.env.ARCHIFY_GCP_CORE_ICON_URL || BASE + "core-products-icons.zip";
const RELEASE = "Google Cloud icons (legacy product set + core products set)";
const args = process.argv.slice(2);
const out = path.resolve(process.env.ARCHIFY_GCP_ICONS || path.join(root, "assets", "gcp-icons"));

const load = async (url, local) => {
  if (local) return fs.readFileSync(local);
  console.error(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
};
const zips = args.filter((a) => a.endsWith(".zip") && fs.existsSync(a));
const legacyZip = zips.find((a) => /legacy/i.test(a)), coreZip = zips.find((a) => /core/i.test(a));

fs.rmSync(out, { recursive: true, force: true });
let n = 0;
for (const e of readZip(await load(LEGACY_URL, legacyZip))) {
  const m = /^([^/]+)\/\1\.svg$/.exec(e.name);
  if (e.isDir || !m) continue;
  const dest = path.join(out, "products", `${m[1]}.svg`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, e.data());
  n++;
}
console.error(`Extracted ${n} product icons`);

if (!args.includes("--no-core")) {
  try {
    let c = 0;
    for (const e of readZip(await load(CORE_URL, coreZip))) {
      // Unique Icons/<Product>/SVG/<File>-512-color[-rgb].svg
      const m = /^Unique Icons\/([^/]+)\/SVG\/[^/]+\.svg$/.exec(e.name);
      if (e.isDir || !m) continue;
      const key = CORE_TO_LEGACY[m[1]] || m[1].toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const dest = path.join(out, "products", `${key}.svg`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, e.data());
      c++;
    }
    console.error(`Extracted ${c} core product icons (replacing legacy icons of the same product)`);
  } catch (e) { console.error(`warning: core product icons not added (${e.message})`); }
}

// General icons (users, mobile, internet, on-premises…) are original drawings kept in data/general-icons/.
for (const f of fs.readdirSync(path.join(root, "data", "general-icons")).filter((x) => x.endsWith(".svg"))) {
  fs.mkdirSync(path.join(out, "general"), { recursive: true });
  fs.copyFileSync(path.join(root, "data", "general-icons", f), path.join(out, "general", f));
}

const cat = buildCatalog(out, RELEASE);
fs.mkdirSync(path.join(root, "data"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "catalog.json"), JSON.stringify(cat, null, 1) + "\n");
console.error(`Catalog: ${cat.services.length} services, ${cat.general.length} general, ${cat.groups.length} group icons`);
