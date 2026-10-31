#!/usr/bin/env bash

set -Eeuo pipefail

script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
command_name=${1:-help}

case "$command_name" in
  preflight) exec "$script_dir/00-preflight.sh" ;;
  cluster) exec "$script_dir/10-create-cluster.sh" ;;
  install) exec "$script_dir/20-install-platform.sh" ;;
  prepare)
    "$script_dir/00-preflight.sh"
    "$script_dir/10-create-cluster.sh"
    exec "$script_dir/20-install-platform.sh"
    ;;
  tunnel)
    # shellcheck disable=SC1091
    source "$script_dir/lib.sh"
    exec minikube tunnel -p "$PROFILE" --cleanup
    ;;
  https-local) exec "$script_dir/30-enable-local-https.sh" ;;
  https-public) exec "$script_dir/31-enable-public-https.sh" ;;
  verify) exec "$script_dir/40-verify.sh" ;;
  ui) exec "$script_dir/50-open-ui.sh" ;;
  cleanup) exec "$script_dir/90-cleanup.sh" ;;
  help | --help | -h)
    cat <<'EOF'
Usage: ./scripts/workshop.sh COMMAND

Commands:
  preflight     Check the native Ubuntu GPU host.
  cluster       Create Minikube and run a CUDA smoke test.
  install       Install the platform, Gateway, monitoring, and plugin.
  prepare       Run preflight, cluster, and install in order.
  tunnel        Run the Minikube LoadBalancer tunnel in terminal 2.
  https-local   Create a self-signed nip.io HTTPS endpoint.
  https-public  Create a Let's Encrypt nip.io HTTPS endpoint.
  verify        Check releases, CRDs, presets, Gateway, and HTTPS auth.
  ui            Start OpenEverest and Grafana port-forwards.
  cleanup       Delete the workshop after CONFIRM_DELETE=all.
EOF
    ;;
  *)
    printf 'Unknown command: %s\n' "$command_name" >&2
    exit 2
    ;;
esac
