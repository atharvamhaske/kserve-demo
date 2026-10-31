#!/usr/bin/env bash

set -Eeuo pipefail

WORKSHOP_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/openeverest-kserve-workshop
CONFIG_FILE=${WORKSHOP_CONFIG:-$WORKSHOP_DIR/config/workshop.env}

if [[ ! -f $CONFIG_FILE ]]; then
  printf 'Missing workshop config: %s\n' "$CONFIG_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090,SC1091
source "$CONFIG_FILE"
set +a

mkdir -p "$STATE_DIR"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_commands() {
  local command_name
  for command_name in "$@"; do
    command -v "$command_name" >/dev/null 2>&1 || fail "missing command: $command_name"
  done
}

kube() {
  kubectl --context "$PROFILE" "$@"
}

require_fixed_namespaces() {
  [[ $EVEREST_NS == everest-system ]] || fail 'EVEREST_NS must be everest-system for the checked-in manifests'
  [[ $INSTANCE_NS == default ]] || fail 'INSTANCE_NS must be default for the checked-in manifests and runbook'
  [[ $MONITORING_NS == monitoring-demo ]] || fail 'MONITORING_NS must be monitoring-demo for the checked-in Helm values'
}

provider_chart() {
  printf '%s' 'oci://ghcr.io/openeverest/charts/provider-kserve'
}

plugin_chart() {
  printf '%s' 'oci://ghcr.io/openeverest/charts/plugin-user-management'
}
