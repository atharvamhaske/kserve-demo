#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands base64 curl go jq kubectl

instance_namespace=${1:-}
instance_name=${2:-}
username=${3:-}

if [[ -z $instance_namespace || -z $instance_name || -z $username ]]; then
  fail 'usage: ./scripts/workshop.sh inference NAMESPACE INSTANCE USERNAME'
fi

[[ -f $STATE_DIR/gateway.env ]] || fail 'Gateway state is absent; run https-local or https-public'

set -a
# shellcheck source=/dev/null
source "$STATE_DIR/gateway.env"
set +a

mapfile -t instance_users < <(
  kube -n "$instance_namespace" get instanceuser \
    -l "plugin-user-management.plugins.openeverest.io/instance=$instance_name" \
    -o jsonpath="{range .items[?(@.spec.username==\"$username\")]}{.metadata.name}{'\n'}{end}"
)

((${#instance_users[@]} == 1)) || fail "expected one InstanceUser for $instance_name/$username, found ${#instance_users[@]}"
instance_user=${instance_users[0]}

phase=$(kube -n "$instance_namespace" get instanceuser "$instance_user" -o jsonpath='{.status.phase}')
[[ $phase == Ready ]] || fail "InstanceUser $instance_user is not ready: ${phase:-unknown}"

credentials_secret=$(kube -n "$instance_namespace" get instanceuser "$instance_user" -o jsonpath='{.status.credentialsSecret}')
[[ -n $credentials_secret ]] || fail "InstanceUser $instance_user has no credentials Secret"

read_secret_key() {
  local key=$1
  kube -n "$instance_namespace" get secret "$credentials_secret" -o "jsonpath={.data.$key}" | base64 --decode
}

api_key=$(read_secret_key password)
base_url=$(read_secret_key uri)
model=$(read_secret_key model)

[[ ${#api_key} -ge 32 && ${#api_key} -le 128 ]] || fail "API key length ${#api_key} is outside the supported 32-128 character range"
[[ $api_key != *[[:space:]]* ]] || fail 'API key contains whitespace'
[[ $base_url == */v1 ]] || fail "Base URL must end in /v1: $base_url"
[[ -n $model ]] || fail 'credentials Secret has no model value'

printf 'InstanceUser: %s\n' "$instance_user"
printf 'Credentials Secret: %s\n' "$credentials_secret"
printf 'Base URL: %s\n' "$base_url"
printf 'Model: %s\n' "$model"
printf 'API key loaded without printing it; length: %s\n' "${#api_key}"

curl_args=(--silent --show-error --max-time 180)
if [[ -n ${GATEWAY_CERT:-} ]]; then
  [[ -f $GATEWAY_CERT ]] || fail "Gateway certificate is missing: $GATEWAY_CERT"
  curl_args+=(--cacert "$GATEWAY_CERT")
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT

no_key_status=$(curl "${curl_args[@]}" --output "$tmp_dir/no-key" --write-out '%{http_code}' "$base_url/models")
[[ $no_key_status == 401 ]] || fail "expected no-key status 401, got $no_key_status"
printf 'No-key authentication gate: 401\n'

models_status=$(curl "${curl_args[@]}" \
  --output "$tmp_dir/models" \
  --write-out '%{http_code}' \
  -H "Authorization: Bearer $api_key" \
  "$base_url/models")
if [[ $models_status != 200 ]]; then
  cat "$tmp_dir/models" >&2
  fail "expected authenticated models status 200, got $models_status"
fi
printf 'Authenticated models request: 200\n'

jq -n --arg model "$model" '{
  model: $model,
  messages: [{role: "user", content: "Reply with exactly: gateway inference works"}],
  chat_template_kwargs: {enable_thinking: false},
  max_tokens: 32,
  temperature: 0
}' >"$tmp_dir/request.json"

chat_status=$(curl "${curl_args[@]}" \
  --output "$tmp_dir/chat" \
  --write-out '%{http_code}' \
  -H "Authorization: Bearer $api_key" \
  -H 'Content-Type: application/json' \
  --data-binary @"$tmp_dir/request.json" \
  "$base_url/chat/completions")
if [[ $chat_status != 200 ]]; then
  jq . "$tmp_dir/chat" >&2 2>/dev/null || cat "$tmp_dir/chat" >&2
  fail "expected chat completion status 200, got $chat_status"
fi
printf 'Authenticated chat request: 200\n'
jq '{id, object, model, assistant: .choices[0].message.content, usage}' "$tmp_dir/chat"

printf '\nGo client response:\n'
(
  cd "$WORKSHOP_DIR" || exit
  OPENAI_API_KEY=$api_key \
    OPENAI_BASE_URL=$base_url \
    OPENAI_MODEL=$model \
    SSL_CERT_FILE=${GATEWAY_CERT:-} \
    go run ./clients/go
)

key_id=$(
  kube -n "$instance_namespace" get secret \
    -l "openeverest.io/ai-gateway-key=true,openeverest.io/ai-gateway-key-owner-kind=user,openeverest.io/ai-gateway-key-owner-name=$username" \
    -o jsonpath='{.items[0].metadata.annotations.openeverest\.io/ai-gateway-key-id}'
)
[[ -n $key_id ]] || fail "no AI Gateway key ID found for $username"

kube -n "$instance_namespace" get podmonitor "$instance_name-metrics" >/dev/null
prometheus_proxy="/api/v1/namespaces/$MONITORING_NS/services/http:prometheus-operated:9090/proxy"
metrics_query="gen_ai_client_token_usage_sum%7Bopeneverest_key_id%3D%22$key_id%22%7D"

for _ in {1..12}; do
  kube get --raw "$prometheus_proxy/api/v1/query?query=$metrics_query" >"$tmp_dir/metrics"
  if [[ $(jq '.data.result | length' "$tmp_dir/metrics") -gt 0 ]]; then
    printf '\nGateway token metrics for key ID %s:\n' "$key_id"
    jq '[.data.result[] | {token_type: .metric.gen_ai_token_type, value: .value[1]}]' "$tmp_dir/metrics"
    printf '\nAuthenticated inference, Go client, and metrics verification passed.\n'
    exit 0
  fi
  sleep 5
done

fail "Prometheus has no token metrics for key ID $key_id after 60 seconds"
