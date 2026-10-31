# Workshop troubleshooting FAQ

Use this file to fix installation, browser access, model serving, API key, quota, or metrics failures.

Run commands from `docs/open-source-hub-workshop` on the GPU host unless a section says presenter machine.

```bash
set -a
source "${WORKSHOP_CONFIG:-config/workshop.env}"
set +a
```

Never share passwords, API keys, Secret data, kubeconfig content, or public host addresses.

## First checks

```bash
minikube status -p "$PROFILE"
kubectl --context "$PROFILE" get nodes -o wide
kubectl --context "$PROFILE" get pods --all-namespaces
helm list --all-namespaces --kube-context "$PROFILE"
./scripts/workshop.sh verify
```

Use the first failing command to choose a section.

## UI and SSH

### What does `ui` start?

```bash
./scripts/workshop.sh ui
```

It starts background GPU-host forwards:

- `127.0.0.1:8080` to OpenEverest.
- `127.0.0.1:3000` to Grafana.

It stores process IDs and logs under `${XDG_STATE_HOME:-$HOME/.local/state}/openeverest-kserve-workshop`.

### How do I verify the GPU-host listeners?

```bash
curl --head --silent --show-error http://localhost:8080/
curl --head --silent --show-error http://localhost:3000/

STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/openeverest-kserve-workshop
cat "$STATE_DIR/everest.log"
cat "$STATE_DIR/grafana.log"
```

If either curl fails, restart the UI forwards.

### How do I restart UI forwards?

```bash
STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/openeverest-kserve-workshop
for name in everest grafana; do
  pid_file="$STATE_DIR/$name.pid"
  if [[ -f $pid_file ]]; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
  fi
done
./scripts/workshop.sh ui
```

A repeated `ui` command keeps a live recorded process and replaces a stale one.

### Why does SSH fail?

Test the base connection from the presenter machine:

```bash
ssh -v "$GPU_HOST" 'hostname'
```

Fix the username, host, key, VPN, security group, SSH service, or custom port. Then add the forwards. Use `-p 2222` for a non-default port.

### Why is a presenter port already in use?

Use different presenter-side ports:

```bash
ssh -N \
  -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:18080:127.0.0.1:8080 \
  -L 127.0.0.1:13000:127.0.0.1:3000 \
  "$GPU_HOST"
```

Open `http://localhost:18080` and `http://localhost:13000`.

### Why does OpenEverest reject my password?

Use the admin password entered during `prepare` or `fresh`. The script does not write it to a workshop file. Helm stores the supplied value in release metadata. Protect cluster access and Helm release Secrets. An unknown password requires `cleanup` followed by `fresh`, which deletes workshop state. Never expose UI ports publicly.

## Cluster and GPU

### Why does kubectl use the wrong cluster?

```bash
kubectl config current-context
minikube status -p "$PROFILE"
kubectl config use-context "$PROFILE"
kubectl --context "$PROFILE" get nodes
```

Workshop scripts always use the configured context.

### Why is Minikube stopped?

Run `minikube status -p "$PROFILE"`. Then run `minikube start -p "$PROFILE"`. If profile creation never completed, rerun `./scripts/workshop.sh cluster`. Do not create a kind cluster for this workshop.

### Why is the GPU unavailable?

Check each layer in order:

```bash
nvidia-smi
docker info --format '{{json .Runtimes}}'
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
kubectl --context "$PROFILE" get node "$PROFILE" \
  -o jsonpath='{.status.allocatable.nvidia\.com/gpu}{"\n"}'
```

Fix the first failure. Recreating Kubernetes does not repair a host driver or Docker runtime.

### Why did `gpu-smoke` fail?

```bash
kubectl --context "$PROFILE" describe pod gpu-smoke
kubectl --context "$PROFILE" logs gpu-smoke
kubectl --context "$PROFILE" get events --sort-by=.lastTimestamp
```

`Insufficient nvidia.com/gpu` means no GPU is allocatable. An image-pull error means the host cannot reach NVIDIA NGC.

## Platform and Gateway

### Why did Helm installation stop?

```bash
helm list --all-namespaces --kube-context "$PROFILE"
kubectl --context "$PROFILE" get pods --all-namespaces
kubectl --context "$PROFILE" get events \
  --all-namespaces \
  --sort-by=.lastTimestamp
```

Inspect the failed release namespace. Do not install separate KServe or Envoy controllers. The provider chart owns them.

### Why does the Gateway have no address?

Keep `./scripts/workshop.sh tunnel` running in terminal 2, then inspect:

```bash
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  get gateway,service -o wide
```

`provider-kserve-ai-gateway` needs an IPv4 address before `https-local` can continue.

### Why does local HTTPS fail?

```bash
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  get gateway,certificate,certificaterequest
kubectl --context "$PROFILE" -n cert-manager get pods
kubectl --context "$PROFILE" -n cert-manager logs \
  deployment/cert-manager --tail=200
```

Start the tunnel, then rerun:

```bash
./scripts/workshop.sh https-local
./scripts/workshop.sh verify
```

A no-key `401` proves that HTTPS routing and authentication are active.

### Why does `verify` say Gateway state is absent?

Run `./scripts/workshop.sh https-local` before `verify`. Use `https-public` only after confirming public ports 80 and 443 and setting its required environment variables.

## Model and API

### Why is `qwen-demo` not ready?

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get instance,llminferenceservice,pod -o wide
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get events --sort-by=.lastTimestamp

MODEL_POD=$(kubectl --context "$PROFILE" -n "$INSTANCE_NS" get pod \
  -l 'app.kubernetes.io/name=qwen-demo,kserve.io/component=workload' \
  -o jsonpath='{.items[0].metadata.name}')
kubectl --context "$PROFILE" -n "$INSTANCE_NS" describe pod "$MODEL_POD"
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  logs "$MODEL_POD" -c main --tail=200
```

Common causes are image-pull failure, no free GPU, insufficient memory, or model-download failure.

### Why are API-key users missing?

```bash
kubectl --context "$PROFILE" get \
  plugins.extensions.openeverest.io plugin-user-management
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  logs deployment/plugin-user-management --tail=200
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get instanceuser -o wide
```

Create each username once. Do not create `chat-app` through both UI and manifest.

### Why does the API return `401`?

No-key requests, rotated old keys, and deleted-user keys return `401`.

For a current key, confirm that Base URL ends in `/v1`. Confirm that the model matches the UI and the key belongs to this Instance. Retrieve the current value through Show credentials. Do not print it.

### Why does the API return `429`?

The preset limits each key to 300 tokens per user per hour. Use `batch-job` to prove another identity still works.

For rehearsal only:

```bash
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  rollout restart deployment/demo-valkey
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  rollout status deployment/demo-valkey --timeout=5m
```

Do not use this reset as a production quota procedure.

### Why does curl reject the local certificate?

```bash
GATEWAY_STATE=${XDG_STATE_HOME:-$HOME/.local/state}/openeverest-kserve-workshop/gateway.env
set -a
source "$GATEWAY_STATE"
set +a
export CURL_CA_BUNDLE="$GATEWAY_CERT"
export SSL_CERT_FILE="$GATEWAY_CERT"
```

Do not use `curl -k`. It hides certificate failures.

## Metrics and cleanup

### Why are metrics missing?

Generate a successful request, then check:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get podmonitor
kubectl --context "$PROFILE" -n "$MONITORING_NS" get pods
kubectl --context "$PROFILE" -n "$EVEREST_NS" get gateway
```

Wait for a Prometheus scrape. In Grafana Explore, use a one-hour range and the query from the main runbook.

### Why does Grafana not open?

```bash
kubectl --context "$PROFILE" -n "$MONITORING_NS" \
  get service observability-grafana
STATE_DIR=${XDG_STATE_HOME:-$HOME/.local/state}/openeverest-kserve-workshop
cat "$STATE_DIR/grafana.log"
```

Restart UI forwards after the Service is ready.

### Why does cleanup refuse to run?

Cleanup requires explicit confirmation:

```bash
CONFIRM_DELETE=all ./scripts/workshop.sh cleanup
```

Stop the Minikube tunnel with Ctrl-C. Cleanup deletes the workshop profile and restores the saved kernel setting.

## Verify recovery

```bash
./scripts/workshop.sh verify
./scripts/workshop.sh ui
curl --head --silent --show-error http://localhost:8080/
curl --head --silent --show-error http://localhost:3000/
```

Return to the [main workshop runbook](README.md).
