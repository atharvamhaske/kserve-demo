#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands df docker free getent git go helm jq kubectl minikube nproc nvidia-smi openssl sudo uname

kernel_release=$(uname -r)
case "${kernel_release,,}" in
  *microsoft* | *wsl*) fail 'use a native Linux GPU host, not WSL' ;;
esac

# shellcheck disable=SC1091
. /etc/os-release
printf 'OS: %s %s\n' "$ID" "$VERSION_ID"
printf 'Kernel: %s\n' "$kernel_release"
printf 'Architecture: %s\n' "$(uname -m)"
printf 'CPUs: %s\n' "$(nproc)"
free -h
df -h /
nvidia-smi
docker version
docker info --format '{{json .Runtimes}}'
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
minikube version --short
kubectl version --client=true
helm version --short
go version

printf 'Preflight passed.\n'
