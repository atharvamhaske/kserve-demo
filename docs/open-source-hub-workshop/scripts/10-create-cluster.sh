#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands kubectl minikube sudo

bpf_state_file=$STATE_DIR/bpf_jit_harden
if [[ ! -f $bpf_state_file ]]; then
  sysctl -n net.core.bpf_jit_harden >"$bpf_state_file"
fi
sudo sysctl -w net.core.bpf_jit_harden=0

minikube start -p "$PROFILE" \
  --driver=docker \
  --container-runtime=docker \
  --gpus=all \
  --kubernetes-version="$KUBERNETES_VERSION" \
  --cpus=16 \
  --memory=32768

kubectl config use-context "$PROFILE"
kube get node "$PROFILE" -o wide
kube get node "$PROFILE" -o jsonpath='{.status.allocatable.nvidia\.com/gpu}{"\n"}'

kube delete pod gpu-smoke --ignore-not-found --wait=true

kube run gpu-smoke --restart=Never \
  --image=nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0 \
  --overrides='{"spec":{"containers":[{"name":"gpu-smoke","image":"nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0","resources":{"limits":{"nvidia.com/gpu":1}}}]}}'
kube wait --for=jsonpath='{.status.phase}'=Succeeded pod/gpu-smoke --timeout=30m
kube logs gpu-smoke
kube delete pod gpu-smoke

printf 'Cluster and GPU smoke test passed.\n'
