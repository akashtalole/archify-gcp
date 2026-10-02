// Price ingestion from the Cloud Billing Catalog API (https://cloudbilling.googleapis.com/v1/services/{id}/skus), which is
// the official, machine-readable list of Google Cloud SKUs and list prices. The API needs an API key of your own
// (Cloud Billing API enabled on a project; see docs). Rows are normalized into a compact form:
//   sku = skuId, d = description, g = resourceGroup, f = resourceFamily, ut = usageType, unit = usageUnit,
//   usd = price per unit, b/e = tier begin/end (in the unit), r = serviceRegions.
export const API = "https://cloudbilling.googleapis.com/v1";

const money = (p) => (Number(p.units || 0) + Number(p.nanos || 0) / 1e9);

/** Compact rows (one per pricing tier) from one SKU object of the Billing Catalog API. */
export function skuRows(s) {
  const info = (s.pricingInfo || [])[0];
  if (!info) return [];
  const expr = info.pricingExpression || {};
  const tiers = expr.tieredRates || [];
  const out = [];
  tiers.forEach((t, n) => {
    out.push({
      sku: s.skuId, d: s.description, g: s.category?.resourceGroup || "", f: s.category?.resourceFamily || "", ut: s.category?.usageType || "",
      unit: expr.usageUnit || "", usd: String(money(t.unitPrice || {})), b: Number(t.startUsageAmount || 0),
      e: n + 1 < tiers.length ? Number(tiers[n + 1].startUsageAmount || 0) : null, r: s.serviceRegions || [],
    });
  });
  return out;
}

/** Keep the on-demand SKUs that apply to a region (or to a multi-region / global scope). */
export function forRegion(skus, region, extra = []) {
  const geo = (r) => /^(us|europe|asia|northamerica|southamerica|me|africa|australia|global)$/.test(r) || r === "global";
  return skus.filter((s) => {
    if (s.category?.usageType && !["OnDemand", "Commit1Yr", "Commit3Yr"].includes(s.category.usageType)) return false;
    if (s.category?.usageType && s.category.usageType !== "OnDemand") return false;
    const rs = s.serviceRegions || [];
    return rs.includes(region) || rs.includes("global") || rs.some((r) => extra.includes(r)) || (rs.length && rs.every(geo) && rs.some((r) => region.startsWith(r)));
  });
}
