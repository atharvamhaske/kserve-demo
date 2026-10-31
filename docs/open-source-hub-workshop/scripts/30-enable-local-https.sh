#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands base64 curl getent helm kubectl openssl
require_fixed_namespaces

kube apply -f "$WORKSHOP_DIR/manifests/selfsigned-clusterissuer.yaml"

deadline=$((SECONDS + 300))
while [[ -z $(kube -n "$EVEREST_NS" get gateway provider-kserve-ai-gateway -o jsonpath='{.status.addresses[0].value}' 2>/dev/null) ]]; do
  ((SECONDS < deadline)) || fail 'timed out waiting for the Gateway address'
  sleep 5
done
gateway_ip=$(kube -n "$EVEREST_NS" get gateway provider-kserve-ai-gateway -o jsonpath='{.status.addresses[0].value}')
[[ $gateway_ip == *.* ]] || fail 'the Gateway must report an IPv4 address'
gateway_host=${gateway_ip//./-}.nip.io

helm upgrade provider-kserve "$(provider_chart)" \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --version "$PROVIDER_VERSION" \
  --values "$WORKSHOP_DIR/values/provider-kserve.yaml" \
  --set aiGateway.auth.allowInsecureHTTP=false \
  --set aiGateway.tls.enabled=true \
  --set-string aiGateway.tls.hostname="$gateway_host" \
  --set aiGateway.tls.acmeHTTP01=false \
  --set-string aiGateway.tls.issuerRef.name=workshop-selfsigned \
  --set-string aiGateway.tls.issuerRef.kind=ClusterIssuer \
  --wait \
  --timeout 30m

kube -n "$EVEREST_NS" wait certificate/provider-kserve-ai-gateway-tls \
  --for=condition=Ready \
  --timeout=10m

gateway_cert=$STATE_DIR/gateway.crt
kube -n "$EVEREST_NS" get secret provider-kserve-ai-gateway-tls \
  -o jsonpath='{.data.tls\.crt}' | base64 --decode >"$gateway_cert"
chmod 600 "$gateway_cert"

cat >"$STATE_DIR/gateway.env" <<EOF
GATEWAY_IP=$gateway_ip
GATEWAY_HOST=$gateway_host
OPENAI_BASE_URL=https://$gateway_host/v1
GATEWAY_CERT=$gateway_cert
EOF

getent ahostsv4 "$gateway_host"
status=$(curl --silent --cacert "$gateway_cert" --output /dev/null --write-out '%{http_code}' "https://$gateway_host/v1/models")
[[ $status == 401 ]] || fail "expected HTTPS status 401 without a key, got $status"

printf 'Local HTTPS ready: https://%s/v1\n' "$gateway_host"
printf 'Trust file for curl and Go: %s\n' "$gateway_cert"
