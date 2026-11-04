#!/usr/bin/env bash

set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)

while true; do
  "$script_dir/70-status.sh"
  sleep 30
done
