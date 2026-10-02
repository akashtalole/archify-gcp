# Third-party notices

## Archify (MIT)
archify-gcp is a companion to [tt-a1i/archify](https://github.com/tt-a1i/archify) (MIT, © tt-a1i) and follows its conventions: typed JSON in, validated standalone
HTML/SVG out, an agent skill (`SKILL.md`), `finalize`-style receipts, dark/light themes. No Archify source is copied; the Google Cloud renderer, router and review
engine here are original. It is also the Google Cloud sibling of [archify-aws](https://github.com/akashtalole/archify-aws) and [archify-azure](https://github.com/akashtalole/archify-azure) (same author, MIT).

## Google Cloud icons
Not redistributed in this repository. `npm run icons:fetch` downloads the official icon packages from Google (<https://cloud.google.com/icons>:
`google-cloud-legacy-icons.zip` and `core-products-icons.zip`) into `assets/gcp-icons/` (git-ignored). The icons are © Google LLC and subject to Google's icon terms:
use them to depict Google Cloud architecture, do not alter them, and do not imply Google endorsement. Rendered diagrams embed the icons they use — check the current
Google terms before publishing diagrams widely.

## General icons
`data/general-icons/` (users, mobile, browser, internet, server, file, device, cloud, SaaS) are original drawings made for this project and are covered by this repository's MIT licence.

## Cloud Billing Catalog API
Cost estimates use list prices from the Cloud Billing Catalog API (<https://cloud.google.com/billing/docs/how-to/get-pricing-information-api>), fetched with your own API key
by `npm run prices:fetch`. Prices are © Google and change over time. Estimates are indicative and are not a quote. The committed test fixture (`test/fixtures/prices/`) is synthetic and contains no real prices.

## Google Cloud Well-Architected Framework
Principle and recommendation titles in `data/wa/framework.json` are taken from the public Google Cloud Well-Architected Framework pages
(<https://cloud.google.com/architecture/framework>, licensed CC BY 4.0 for content, with code samples under Apache 2.0) with links back to each page. The review rules are heuristics written for this project, not Google content.

## AWS Agent Toolkit skills
The cost-estimation and Well-Architected review features follow the workflows described in the `billing-and-cost-management` and `aws-well-architected-review` skills of
<https://github.com/aws/agent-toolkit-for-aws> (core-skills), which is licensed by AWS under its own terms. Their rules (deterministic cost arithmetic, frozen corpus, five statuses,
impact × likelihood, Eisenhower prioritisation) are paraphrased and applied to Google Cloud; no skill text or data is redistributed.
