#!/usr/bin/env bash

# shellcheck disable=SC1091
source "$(dirname -- "$0")/lib.sh"

require_commands base64 helm kubectl mktemp rm
require_fixed_namespaces

helm repo add jetstack https://charts.jetstack.io --force-update
helm repo add openeverest https://openeverest.github.io/helm-charts/ --force-update
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update
helm repo update

gateway_crd_dir=$(mktemp -d)
trap 'rm -rf "$gateway_crd_dir"' EXIT
helm pull oci://docker.io/envoyproxy/gateway-helm \
  --version "$ENVOY_GATEWAY_VERSION" \
  --untar \
  --untardir "$gateway_crd_dir"
kube apply --server-side \
  -f "$gateway_crd_dir/gateway-helm/charts/crds/crds/gatewayapi-crds.yaml"

helm upgrade --install cert-manager jetstack/cert-manager \
  --kube-context "$PROFILE" \
  --namespace cert-manager \
  --create-namespace \
  --version "$CERT_MANAGER_VERSION" \
  --set crds.enabled=true \
  --set config.apiVersion=controller.config.cert-manager.io/v1alpha1 \
  --set config.kind=ControllerConfiguration \
  --set config.enableGatewayAPI=true \
  --wait \
  --timeout 30m

read -rsp 'OpenEverest admin password: ' ui_password
printf '\n'
helm upgrade --install everest-core openeverest/openeverest \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --create-namespace \
  --devel \
  --version "$EVEREST_VERSION" \
  --set-literal "server.initialAdminPassword=$ui_password" \
  --wait \
  --timeout 30m
unset ui_password

helm upgrade --install observability prometheus-community/kube-prometheus-stack \
  --kube-context "$PROFILE" \
  --namespace "$MONITORING_NS" \
  --create-namespace \
  --version "$MONITORING_VERSION" \
  --values "$WORKSHOP_DIR/values/monitoring.yaml" \
  --wait \
  --timeout 30m

kube apply -f "$WORKSHOP_DIR/manifests/demo-valkey.yaml"
kube -n "$EVEREST_NS" rollout status deployment/demo-valkey --timeout=5m

helm upgrade --install provider-kserve "$(provider_chart)" \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --version "$PROVIDER_VERSION" \
  --values "$WORKSHOP_DIR/values/provider-kserve.yaml" \
  --wait \
  --timeout 30m

helm upgrade --install plugin-user-management "$(plugin_chart)" \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --version "$PLUGIN_VERSION" \
  --wait \
  --timeout 10m

kube apply -f "$WORKSHOP_DIR/manifests/instancepreset-qwen-demo-gateway.yaml"

printf '\nPlatform installed. In terminal 2, run:\n'
printf '  %s tunnel\n' "$WORKSHOP_DIR/scripts/workshop.sh"
printf 'Then return here and run:\n'
printf '  %s https-local\n' "$WORKSHOP_DIR/scripts/workshop.sh"
