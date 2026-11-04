#!/usr/bin/env bash

set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
# shellcheck disable=SC1091
source "$script_dir/lib.sh"

require_commands jq kubectl

printf '\n## OpenEverest providers\n'
providers=$(kube get providers.core.openeverest.io -o json)
jq -r '.items[] | [.metadata.name, (.status.phase // "Installed"), ((.status.conditions[]? | select(.type == "Ready") | .status) // "Unknown")] | @tsv' <<<"$providers"

printf '\n## LLM instances\n'
instances=$(kube get instances.core.openeverest.io -A -o json)
jq -r '.items[] | [.metadata.namespace, .metadata.name, (.spec.providerRef.name // "-"), (.status.phase // "Pending")] | @tsv' <<<"$instances"

printf '\n## Instance users\n'
kube get instanceusers.plugin-user-management.plugins.openeverest.io -A

printf '\n## Envoy AI Gateway\n'
gateways=$(kube get gateways.gateway.networking.k8s.io -A -o json)
routes=$(kube get aigatewayroutes.aigateway.envoyproxy.io -A -o json)
policies=$(kube get securitypolicies.gateway.envoyproxy.io -A -o json)
jq -r '.items[] | ["Gateway", .metadata.namespace, .metadata.name, ((.status.conditions[]? | select(.type == "Programmed") | .status) // "Unknown")] | @tsv' <<<"$gateways"
jq -r '.items[] | ["AIGatewayRoute", .metadata.namespace, .metadata.name, ((.status.parents[]?.conditions[]? | select(.type == "Accepted") | .status) // "Unknown")] | @tsv' <<<"$routes"
jq -r '.items[] | ["SecurityPolicy", .metadata.namespace, .metadata.name, ((.status.ancestors[]?.conditions[]? | select(.type == "Accepted") | .status) // "Unknown")] | @tsv' <<<"$policies"

failed_providers=$(jq '[.items[] | select((.status.phase // "") == "Failed" or any(.status.conditions[]?; .status == "False" and .type == "Ready"))] | length' <<<"$providers")
failed_instances=$(jq '[.items[] | select((.status.phase // "Pending") == "Failed" or any(.status.conditions[]?; .status == "False" and .type == "Ready"))] | length' <<<"$instances")
failed_gateways=$(jq '[.items[] | select(any(.status.conditions[]?; .status == "False" and (.type == "Accepted" or .type == "Programmed")))] | length' <<<"$gateways")
failed_routes=$(jq '[.items[] | select(any(.status.parents[]?.conditions[]?; .status == "False" and (.type == "Accepted" or .type == "ResolvedRefs")))] | length' <<<"$routes")
failed_policies=$(jq '[.items[] | select(any(.status.ancestors[]?.conditions[]?; .status == "False" and .type == "Accepted"))] | length' <<<"$policies")

pods=$(kube get pods -A -o json)
unhealthy_pods=$(jq '[.items[] | select(
  (.status.phase != "Running" and .status.phase != "Succeeded") or
  any(.status.containerStatuses[]?; .state.waiting.reason == "CrashLoopBackOff" or .state.waiting.reason == "ImagePullBackOff" or .state.waiting.reason == "ErrImagePull")
)]' <<<"$pods")
unhealthy_pod_count=$(jq 'length' <<<"$unhealthy_pods")

printf '\n## Current pod failures\n'
if ((unhealthy_pod_count == 0)); then
  printf 'None\n'
else
  jq -r '.[] | [.metadata.namespace, .metadata.name, .status.phase, ([.status.containerStatuses[]?.state.waiting.reason] | map(select(. != null)) | join(","))] | @tsv' <<<"$unhealthy_pods"
fi

printf '\n## Recent warning events\n'
events=$(kube get events -A --field-selector type=Warning -o json)
jq -r '.items | sort_by(.lastTimestamp // .eventTime // "") | reverse | .[:20][] | [.metadata.namespace, (.involvedObject.kind + "/" + .involvedObject.name), (.reason // "-"), (.message // "-")] | @tsv' <<<"$events"

failure_count=$((failed_providers + failed_instances + failed_gateways + failed_routes + failed_policies + unhealthy_pod_count))
if ((failure_count > 0)); then
  fail "$failure_count active control-plane failure(s) found"
fi

printf '\nControl-plane health passed.\n'
