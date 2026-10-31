#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands curl helm kubectl

helm list --all-namespaces --kube-context "$PROFILE"
kube -n "$EVEREST_NS" get pods
kube -n "$MONITORING_NS" get pods
kube get provider provider-kserve
kube get plugins.extensions.openeverest.io plugin-user-management
kube get gatewayclasses,gateways -A
kube get instancepreset
kube get crd \
  instances.core.openeverest.io \
  instanceusers.plugin-user-management.plugins.openeverest.io \
  llminferenceservices.serving.kserve.io \
  podmonitors.monitoring.coreos.com

if [[ -f $STATE_DIR/gateway.env ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$STATE_DIR/gateway.env"
  set +a
  curl_args=(--silent --output /dev/null --write-out '%{http_code}')
  if [[ -n ${GATEWAY_CERT:-} ]]; then
    curl_args+=(--cacert "$GATEWAY_CERT")
  fi
  status=$(curl "${curl_args[@]}" "$OPENAI_BASE_URL/models")
  [[ $status == 401 ]] || fail "expected Gateway status 401 without a key, got $status"
  printf 'HTTPS authentication gate passed.\n'
else
  printf 'Gateway HTTPS state is absent. Run https-local or https-public.\n' >&2
  exit 1
fi
