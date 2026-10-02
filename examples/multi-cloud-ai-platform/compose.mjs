// Composes the three per-cloud panels (each rendered by its own archify tool) into one multi-cloud diagram:
// ids are namespaced per panel, panels are placed side by side, and cross-cloud links are routed between them.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { svgToPng } from "../../src/png.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
fs.mkdirSync(out, { recursive: true });
const PANELS = [
  { key: "azure", name: "Microsoft Azure", tool: "archify-azure", ns: "p1", crop: 66 },
  { key: "gcp", name: "Google Cloud", tool: "archify-gcp", ns: "p2", crop: 66 },
  { key: "aws", name: "Amazon Web Services", tool: "archify-aws", ns: "p3", crop: 66 },
];
const GAP = 300, MARGIN = 50, TOP = 150;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---- load and namespace each panel
let x0 = MARGIN, maxH = 0;
for (const p of PANELS) {
  const svg = fs.readFileSync(path.join(here, "panels", "out", `${p.key}.svg`), "utf8");
  const head = svg.match(/^<svg[^>]*class="([^"]+)"[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  p.cls = head[1]; p.w = +head[2]; p.h = +head[3] - p.crop;
  let body = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
  body = body.replace(/<title>[\s\S]*?<\/title>\n?/, "")
    .replace(/<rect class="bg"[^>]*\/>\n?/, "")
    .replace(/<text class="(?:title|subtitle)"[^>]*>[\s\S]*?<\/text>\n?/g, "");
  const ids = [...new Set([...body.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]))];
  const rename = (s) => s.replace(/\bid="([^"]+)"/g, `id="${p.ns}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#${p.ns}-$1)`).replace(/(href)="#([^"]+)"/g, `$1="#${p.ns}-$2"`);
  p.body = rename(body);
  void ids;
  p.x = x0; p.y = TOP - p.crop + 0;
  x0 += p.w + GAP; maxH = Math.max(maxH, p.h);
  // node anchors in canvas coordinates
  p.nodes = {};
  for (const m of body.matchAll(/<g class="node"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)) {
    const u = m[2].match(/<use[^>]*x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    if (!u) continue;
    const [ux, uy, uw, uh] = u.slice(1).map(Number);
    const ys = [...m[2].matchAll(/<text[^>]* y="([\d.]+)"/g)].map((t) => +t[1]);
    p.nodes[m[1]] = { icon: { x: p.x + ux, y: p.y + uy, w: uw, h: uh }, box: { x: p.x + ux - 58, y: p.y + uy - 6, w: uw + 116, h: Math.max(...ys, uy + uh) - uy + 14 } };
  }
}
const W = x0 - GAP + MARGIN, H = TOP + maxH + 120;
const node = (ref) => { const [k, id] = ref.split("."); const n = PANELS.find((p) => p.key === k).nodes[id]; if (!n) throw new Error("unknown node " + ref); return n; };

// ---- cross-cloud links
const LINKS = [
  { from: "azure.entra", to: "gcp.apigee", step: 2, label: "OIDC token" },
  { from: "gcp.armor", to: "azure.safety", dashed: true, label: "ensemble" },
  { from: "gcp.gke", to: "azure.aks", dashed: true, label: "GitOps" },
  { from: "gcp.gke", to: "aws.eks", dashed: true, label: "GitOps" },
  { from: "gcp.gke", to: "azure.search", step: 6, label: "retrieve" },
  { from: "gcp.bq", to: "azure.search", step: 7, label: "embeddings" },
  { from: "aws.s3", to: "gcp.bq", dashed: true, label: "BigLake" },
  { from: "azure.er", to: "gcp.ic", dashed: true, label: "private backbone" },
  { from: "gcp.ic", to: "aws.dc", dashed: true },
];

// ---- grid router (A*, bend penalty, soft avoidance of earlier routes)
const C = 8, GW = Math.ceil(W / C), GH = Math.ceil(H / C);
const blocked = new Uint8Array(GW * GH), used = new Uint8Array(GW * GH);
const cell = (v) => Math.max(0, Math.floor(v / C));
const boxes = PANELS.flatMap((p) => Object.entries(p.nodes).map(([id, n]) => ({ ref: p.key + "." + id, ...n.box })));
const fillBox = (b, pad, val) => { for (let gy = cell(b.y - pad); gy <= cell(b.y + b.h + pad); gy++) for (let gx = cell(b.x - pad); gx <= cell(b.x + b.w + pad); gx++) if (gx < GW && gy < GH) blocked[gy * GW + gx] = val; };
for (const b of boxes) fillBox(b, 4, 1);
function route(from, to) {
  const A = node(from), B = node(to);
  const ca = { x: A.icon.x + A.icon.w / 2, y: A.icon.y + A.icon.h / 2 }, cb = { x: B.icon.x + B.icon.w / 2, y: B.icon.y + B.icon.h / 2 };
  const port = (n, c, other) => {
    const dx = other.x - c.x, dy = other.y - c.y;
    return Math.abs(dx) >= Math.abs(dy) * 0.4 ? { x: dx > 0 ? n.icon.x + n.icon.w + 6 : n.icon.x - 6, y: c.y, dir: dx > 0 ? [1, 0] : [-1, 0] } : { x: c.x, y: dy > 0 ? n.box.y + n.box.h + 6 : n.icon.y - 6, dir: dy > 0 ? [0, 1] : [0, -1] };
  };
  const s = port(A, ca, cb), t = port(B, cb, ca);
  // temporarily unblock both endpoint boxes' port corridors
  const saved = [];
  for (const n of [A, B]) { const b = n.box; for (let gy = cell(b.y - 8); gy <= cell(b.y + b.h + 8); gy++) for (let gx = cell(b.x - 8); gx <= cell(b.x + b.w + 8); gx++) { const i = gy * GW + gx; saved.push([i, blocked[i]]); blocked[i] = 0; } }
  const startC = { x: cell(s.x), y: cell(s.y) }, endC = { x: cell(t.x), y: cell(t.y) };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const key = (x, y, d) => (y * GW + x) * 4 + d;
  const dist = new Map(), prev = new Map(), pq = [];
  const push = (f, g, x, y, d) => { pq.push([f, g, x, y, d]); pq.sort((a, b) => a[0] - b[0]); };
  const h = (x, y) => Math.abs(x - endC.x) + Math.abs(y - endC.y);
  const sd = DIRS.findIndex((d) => d[0] === s.dir[0] && d[1] === s.dir[1]);
  dist.set(key(startC.x, startC.y, sd), 0); push(h(startC.x, startC.y), 0, startC.x, startC.y, sd);
  let goal = null;
  while (pq.length) {
    const [, g, x, y, d] = pq.shift();
    if (g > dist.get(key(x, y, d))) continue;
    if (x === endC.x && y === endC.y) { goal = key(x, y, d); break; }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d ^ 1)) continue;
      const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
      if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || blocked[ny * GW + nx]) continue;
      const ng = g + 1 + (nd !== d ? 14 : 0) + (used[ny * GW + nx] ? 7 : 0);
      const k = key(nx, ny, nd);
      if (ng < (dist.get(k) ?? Infinity)) { dist.set(k, ng); prev.set(k, key(x, y, d)); push(ng + h(nx, ny), ng, nx, ny, nd); }
    }
  }
  for (const [i, v] of saved.reverse()) blocked[i] = v;
  if (!goal) throw new Error(`no route ${from} -> ${to}`);
  const cells = []; for (let k = goal; k !== undefined; k = prev.get(k)) { const c = Math.floor(k / 4); cells.push([c % GW, Math.floor(c / GW)]); }
  cells.reverse();
  for (const [gx, gy] of cells) used[gy * GW + gx] = 1;
  // simplify to corner points in pixel coordinates (cell centres), with exact port ends
  const pts = cells.map(([gx, gy]) => [gx * C + C / 2, gy * C + C / 2]);
  const simp = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) { const a = pts[i - 1], b = pts[i], c = pts[i + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) simp.push(b); }
  simp.push(pts[pts.length - 1]);
  simp[0] = [s.x, s.y]; simp[simp.length - 1] = [t.x, t.y];
  return simp;
}

// ---- draw
const paths = [];
for (const l of LINKS) {
  const pts = route(l.from, l.to);
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  // label and badge on the longest segment
  let best = 0, bi = 0; for (let i = 1; i < pts.length; i++) { const len = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); if (len > best) { best = len; bi = i; } }
  const mx = (pts[bi][0] + pts[bi - 1][0]) / 2, my = (pts[bi][1] + pts[bi - 1][1]) / 2;
  const horiz = Math.abs(pts[bi][1] - pts[bi - 1][1]) < 1;
  const tip = `${l.from.split(".")[1]} → ${l.to.split(".")[1]}${l.label ? " (" + l.label + ")" : ""}`;
  paths.push(`<g class="xedge" data-from="${l.from}" data-to="${l.to}"${l.step ? ` data-step="${l.step}"` : ""}><title>${esc(tip)}</title><path d="${d}" fill="none" class="xline" ${l.dashed ? 'stroke-dasharray="6 4" ' : ""}stroke-width="2" marker-end="url(#xarw)"/>` +
    (l.label ? `<text class="elabel" x="${mx.toFixed(1)}" y="${(horiz ? my - 8 : my).toFixed(1)}" text-anchor="${horiz ? "middle" : "start"}" dx="${horiz ? 0 : 8}">${esc(l.label)}</text>` : "") +
    (l.step ? `<g class="badge"><circle cx="${(horiz ? mx - 30 : mx).toFixed(1)}" cy="${(horiz ? my : my - 24).toFixed(1)}" r="11"/><text x="${(horiz ? mx - 30 : mx).toFixed(1)}" y="${((horiz ? my : my - 24) + 4.5).toFixed(1)}" text-anchor="middle">${l.step}</text></g>` : "") + `</g>`);
}

const panelSvg = PANELS.map((p) => `<g class="panel panel-${p.key}" transform="translate(${p.x} ${p.y})"><g class="${p.cls} theme-light">${p.body}</g></g>` +
  `<text class="caption" x="${p.x + p.w / 2}" y="${TOP + p.h + 24}" text-anchor="middle">${p.name} · rendered by ${p.tool}</text>`).join("\n");
const title = "Cloud-agnostic enterprise AI platform across AWS, Azure and Google Cloud";
const subtitle = "One AI gateway and portable Kubernetes agent runtime route requests to the best model on any cloud; each panel is drawn by its own archify skill with that cloud's official icons";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>.mc text{font-family:Arial,Helvetica,sans-serif}.mc .title{font-size:24px;font-weight:700;fill:#000}.mc .subtitle{font-size:13px;fill:#545b64}.mc .caption{font-size:12px;fill:#545b64}
.mc .xline{stroke:#c5221f;stroke-width:2}.mc .elabel{font-size:12px;fill:#000;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
.mc .badge circle{fill:#c5221f}.mc .badge text{fill:#fff;font-weight:700;font-size:12px}
.mc .legend{font-size:12px;fill:#545b64}
${PANELS.map((p) => ".az{--bg:#ffffff;--fg:#000000;--muted:#545b64;--line:#232F3E;--halo:#ffffff;--badge:#000000;--badgeFg:#ffffff}").filter((v, i, a) => a.indexOf(v) === i).join("")}</style>
<defs><marker id="xarw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1.5 1.5 L8.5 5 L1.5 8.5" fill="none" stroke="#c5221f" stroke-width="1.6"/></marker></defs>
<g class="mc"><rect width="${W}" height="${H}" fill="#fff"/>
<text class="title" x="${MARGIN}" y="46">${esc(title)}</text><text class="subtitle" x="${MARGIN}" y="70">${esc(subtitle)}</text>
<line x1="${MARGIN}" y1="100" x2="${MARGIN + 36}" y2="100" stroke="#c5221f" stroke-width="2" marker-end="url(#xarw)"/><text class="legend" x="${MARGIN + 46}" y="104">cross-cloud link (red); black arrows are drawn inside each cloud by its own tool; dashed = control or data sync</text>
${panelSvg}
${paths.join("\n")}
</g></svg>
`;
// panel CSS (.aws / .az) must be present: lift the panels' own <style> blocks (already inside bodies) – nothing else to do.
fs.writeFileSync(path.join(out, "architecture.svg"), svg);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{margin:0;background:#fff}svg{max-width:100%;height:auto;display:block}</style></head><body>${svg}</body></html>\n`;
fs.writeFileSync(path.join(out, "architecture.html"), html);
svgToPng(path.join(out, "architecture.svg"), path.join(out, "architecture.png"), W, H, 2);
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
fs.writeFileSync(path.join(out, "architecture.receipt.json"), JSON.stringify({
  ok: true, tool: "multi-cloud compose", panels: PANELS.map((p) => ({ cloud: p.key, renderedBy: p.tool, spec: sha(path.join(here, "panels", `${p.key}.json`)), svg: sha(path.join(here, "panels", "out", `${p.key}.svg`)) })),
  crossCloudLinks: LINKS.length, size: { width: W, height: H }, visualReview: "not-performed",
}, null, 2) + "\n");
console.log(`composed ${W}x${H}, ${LINKS.length} cross-cloud links`);
