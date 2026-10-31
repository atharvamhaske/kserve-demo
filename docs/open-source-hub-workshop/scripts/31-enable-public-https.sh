#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands curl getent helm kubectl
require_fixed_namespaces

[[ ${PUBLIC_GATEWAY_CONFIRMED:-} == yes ]] || fail 'set PUBLIC_GATEWAY_CONFIRMED=yes after confirming public ports 80 and 443'
[[ -n ${ACME_EMAIL:-} ]] || fail 'set ACME_EMAIL to a public contact address'
acme_server=${ACME_SERVER:-https://acme-v02.api.letsencrypt.org/directory}

deadline=$((SECONDS + 300))
while [[ -z $(kube -n "$EVEREST_NS" get gateway provider-kserve-ai-gateway -o jsonpath='{.status.addresses[0].value}' 2>/dev/null) ]]; do
  ((SECONDS < deadline)) || fail 'timed out waiting for the Gateway address'
  sleep 5
done
gateway_ip=$(kube -n "$EVEREST_NS" get gateway provider-kserve-ai-gateway -o jsonpath='{.status.addresses[0].value}')
[[ $gateway_ip == *.* ]] || fail 'the Gateway must report a public IPv4 address'
gateway_host=${gateway_ip//./-}.nip.io

cat <<EOF | kube apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod-ai-gateway
spec:
  acme:
    email: $ACME_EMAIL
    server: $acme_server
    privateKeySecretRef:
      name: letsencrypt-prod-ai-gateway-account
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs:
              - name: provider-kserve-ai-gateway
                namespace: $EVEREST_NS
                kind: Gateway
                sectionName: acme-http01
EOF
kube wait clusterissuer/letsencrypt-prod-ai-gateway --for=condition=Ready --timeout=2m

helm upgrade provider-kserve "$(provider_chart)" \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --version "$PROVIDER_VERSION" \
  --values "$WORKSHOP_DIR/values/provider-kserve.yaml" \
  --set aiGateway.auth.allowInsecureHTTP=false \
  --set aiGateway.tls.enabled=true \
  --set-string aiGateway.tls.hostname="$gateway_host" \
  --set aiGateway.tls.acmeHTTP01=true \
  --set-string aiGateway.tls.issuerRef.name=letsencrypt-prod-ai-gateway \
  --set-string aiGateway.tls.issuerRef.kind=ClusterIssuer \
  --wait \
  --timeout 30m

kube -n "$EVEREST_NS" wait certificate/provider-kserve-ai-gateway-tls \
  --for=condition=Ready \
  --timeout=10m

cat >"$STATE_DIR/gateway.env" <<EOF
GATEWAY_IP=$gateway_ip
GATEWAY_HOST=$gateway_host
OPENAI_BASE_URL=https://$gateway_host/v1
GATEWAY_CERT=
EOF

getent ahostsv4 "$gateway_host"
status=$(curl --silent --output /dev/null --write-out '%{http_code}' "https://$gateway_host/v1/models")
[[ $status == 401 ]] || fail "expected HTTPS status 401 without a key, got $status"

printf 'Public HTTPS ready: https://%s/v1\n' "$gateway_host"
