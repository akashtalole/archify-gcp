#!/bin/sh
# Renders each cloud panel with its own tool. Override the tool checkouts with ARCHIFY_AWS / ARCHIFY_AZURE.
here=$(cd "$(dirname "$0")" && pwd); root=$(cd "$here/../.." && pwd)
AWS=${ARCHIFY_AWS:-$root/../archify-aws}; AZ=${ARCHIFY_AZURE:-$root/../archify-azure}
mkdir -p "$here/panels/out"
node "$AWS/bin/archify-aws.mjs" render "$here/panels/aws.json" --svg --no-review --no-cost -o "$here/panels/out/aws.html" >/dev/null
node "$AZ/bin/archify-azure.mjs" render "$here/panels/azure.json" --svg --no-review --no-cost -o "$here/panels/out/azure.html" >/dev/null
node "$root/bin/archify-gcp.mjs" render "$here/panels/gcp.json" --svg --no-review --no-cost -o "$here/panels/out/gcp.html" >/dev/null
