#!/usr/bin/env bash

set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)

while true; do
  if ! "$script_dir/70-status.sh"; then
    printf 'Health check failed. Waiting for recovery.\n' >&2
  fi
  sleep 30
done
