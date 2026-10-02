// Structural checks on a generated .drawio file: unique ids, every parent/source/target resolves, and every embedded icon is a valid SVG data URI.

const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function validateDrawio(xml) {
  const problems = [];
  if (!/^<mxfile[\s>]/.test(xml)) problems.push("not an <mxfile> document");
  const cells = [...xml.matchAll(/<(mxCell|object)\b([^>]*?)\/?>/g)].map((m) => ({ tag: m[1], attrs: Object.fromEntries([...m[2].matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], unesc(a[2])])) }));
  const ids = new Set();
  for (const { attrs } of cells) {
    if (!attrs.id) continue;
    if (ids.has(attrs.id)) problems.push(`duplicate id ${attrs.id}`);
    ids.add(attrs.id);
  }
  // <object> wraps an <mxCell> that has no id of its own: its parent/style live on the inner cell
  for (const { attrs } of cells) {
    for (const k of ["parent", "source", "target"]) if (attrs[k] && !ids.has(attrs[k])) problems.push(`${attrs.id || "cell"}: ${k} "${attrs[k]}" does not exist`);
    const m = /(?:^|;)image=data:image\/svg\+xml,([^;]+);/.exec(attrs.style || "");
    if (m && !/^<svg[\s>]/.test(Buffer.from(m[1], "base64").toString("utf8").replace(/^\s*(<\?xml[^>]*\?>)?\s*(<!--[\s\S]*?-->)?\s*/, ""))) problems.push(`${attrs.id}: embedded icon is not an SVG`);
  }
  const tags = (xml.match(/<mxCell\b/g) || []).length;
  if (tags < 3) problems.push("diagram has no cells");
  const open = (xml.match(/<(?!\/|\?|!)[A-Za-z][^>]*[^/]>/g) || []).length, close = (xml.match(/<\/[A-Za-z]+>/g) || []).length;
  if (open !== close) problems.push(`unbalanced tags (${open} open, ${close} close)`);
  return problems;
}
