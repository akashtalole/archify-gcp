// Cost estimate + Well-Architected review for a built diagram, shared by render and finalize.
import { estimateCost } from "./cost/estimate.mjs";
import { PricingError } from "./cost/pricebook.mjs";
import { reviewWorkload } from "./wa/evaluate.mjs";

/** Either part can be turned off; the review reads the estimate when both are on. */
export function analyze(diagram, { cost = true, review = true, region, usage, mode, pillars, filter, lens, criticality, asOf } = {}) {
  const spec = diagram.spec.meta || {};
  let est = null, costNote = null;
  if (cost && spec.cost !== false) {
    try { est = estimateCost(diagram, { region: region || spec.cost?.region, usage, ...(asOf ? { asOf } : {}) }); }
    catch (e) { if (!(e instanceof PricingError) || !/^no price book/.test(e.message)) throw e; costNote = e.message; } // no snapshot yet: the Cost tab is omitted, not faked
  }
  const wa = review && spec.review !== false ? reviewWorkload(diagram, { cost: est, mode, pillars, filter, lens, criticality, ...(asOf ? { now: asOf } : {}) }) : null;
  return { cost: est, wa, costNote };
}
