#!/usr/bin/env bash

set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
source "$script_dir/lib.sh"

require_commands jq kubectl

user=$(kube get instanceusers.plugin-user-management.plugins.openeverest.io -A -o json | jq -r '
  .items
  | sort_by(.metadata.namespace, .metadata.name)
  | first
  | [
      .metadata.namespace,
      .spec.instanceRef.name,
      (.spec.username // .metadata.name)
    ]
  | @tsv
')
[[ -n $user ]] || fail 'no InstanceUser found; create one in OpenEverest first'

IFS=$'\t' read -r namespace instance username <<<"$user"
[[ -n $namespace && -n $instance && -n $username ]] || fail 'the first InstanceUser is missing namespace, instanceRef, or username'

printf 'Lesson target: namespace=%s instance=%s username=%s\n' "$namespace" "$instance" "$username"
exec "$script_dir/60-test-inference.sh" "$namespace" "$instance" "$username"
