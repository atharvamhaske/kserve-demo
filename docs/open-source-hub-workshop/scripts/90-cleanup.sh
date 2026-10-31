#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

[[ ${CONFIRM_DELETE:-} == all ]] || fail 'set CONFIRM_DELETE=all to remove the workshop cluster'

for name in everest grafana; do
  pid_file=$STATE_DIR/$name.pid
  if [[ -f $pid_file ]]; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
  fi
done

if minikube status -p "$PROFILE" >/dev/null 2>&1; then
  kube -n "$INSTANCE_NS" delete instance "$INSTANCE" --ignore-not-found --wait=true
  helm uninstall plugin-user-management --kube-context "$PROFILE" --namespace "$EVEREST_NS" || true
  helm uninstall provider-kserve --kube-context "$PROFILE" --namespace "$EVEREST_NS" || true
  kube -n "$EVEREST_NS" delete -f "$WORKSHOP_DIR/manifests/demo-valkey.yaml" --ignore-not-found
  helm uninstall observability --kube-context "$PROFILE" --namespace "$MONITORING_NS" || true
  helm uninstall everest-core --kube-context "$PROFILE" --namespace "$EVEREST_NS" || true
  helm uninstall cert-manager --kube-context "$PROFILE" --namespace cert-manager || true
  minikube delete -p "$PROFILE"
fi

bpf_state_file=$STATE_DIR/bpf_jit_harden
if [[ -f $bpf_state_file ]]; then
  original_bpf_value=$(cat "$bpf_state_file")
  sudo sysctl -w "net.core.bpf_jit_harden=$original_bpf_value"
fi

rm -rf "$STATE_DIR"
printf 'Workshop cleanup complete. Stop the tunnel terminal with Ctrl-C if it is still open.\n'
