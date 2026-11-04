#!/usr/bin/env bash

set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
source "$script_dir/lib.sh"

HEADLAMP_NAMESPACE=headlamp
HEADLAMP_RELEASE=headlamp
HEADLAMP_CHART_VERSION=0.46.0
PLUGIN_SECRET=headlamp-openeverest-llm
plugin_dir="$WORKSHOP_DIR/headlamp-plugin"

require_commands helm kubectl
[[ -f $plugin_dir/dist/main.js ]] || fail "missing bundled plugin: $plugin_dir/dist/main.js"

kube apply -f "$WORKSHOP_DIR/manifests/headlamp-readonly-rbac.yaml"
kube create namespace "$HEADLAMP_NAMESPACE" --dry-run=client -o yaml | kube apply -f -
kube -n "$HEADLAMP_NAMESPACE" create secret generic "$PLUGIN_SECRET" \
  --from-file=main.js="$plugin_dir/dist/main.js" \
  --from-file=package.json="$plugin_dir/package.json" \
  --dry-run=client -o yaml | kube apply -f -

helm repo add headlamp https://kubernetes-sigs.github.io/headlamp/ --force-update >/dev/null
helm repo update headlamp >/dev/null
helm --kube-context "$PROFILE" upgrade --install "$HEADLAMP_RELEASE" headlamp/headlamp \
  --namespace "$HEADLAMP_NAMESPACE" \
  --version "$HEADLAMP_CHART_VERSION" \
  --values "$WORKSHOP_DIR/values/headlamp.yaml" \
  --wait \
  --timeout 10m

kube -n "$HEADLAMP_NAMESPACE" rollout restart "deployment/$HEADLAMP_RELEASE"
kube -n "$HEADLAMP_NAMESPACE" rollout status "deployment/$HEADLAMP_RELEASE" --timeout=5m

cat <<EOF
Headlamp LLM control plane is ready.
Open it from the GPU host:
  kubectl --context $PROFILE -n $HEADLAMP_NAMESPACE port-forward service/$HEADLAMP_RELEASE 4466:80
Then browse to http://localhost:4466 and select LLM Control Plane.
EOF
