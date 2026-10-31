# Open Source Hub all-in-one workshop runbook

This is the only live runbook for the 45-minute OpenEverest and KServe workshop.

It contains every cluster command, UI step, verification gate, recovery check, and speaker cue.

## Scope

Use one disposable native Ubuntu GPU host.

Create the model `Instance` only through the OpenEverest UI. Use terminal commands to install, observe, and verify the platform.

KServe downloads the public model for the serving Pod. This runbook adds no persistent model-delivery component.

OpenEverest v2 and provider-kserve are pre-alpha. Use them for testing and feedback, not production.

## Release pins

| Component | Version |
|---|---:|
| OpenEverest | `2.0.0-dev.4` Developer Preview |
| provider-kserve | `0.5.0` |
| KServe | `0.21.0`, bundled by provider-kserve |
| Kubernetes | `v1.36.6` |
| Minikube | `v1.39.0` |
| cert-manager | `v1.21.3` |
| kube-prometheus-stack | `92.16.1` |
| Prometheus | `v3.15.1` |
| Grafana | `13.3.0` |

Kubernetes 1.37 is newer but outside the provider's declared range. Pin Kubernetes 1.36.6.

See [release sources](release-sources.md) for compatibility evidence and official links.

## Terminal layout

Open five terminals on the GPU host:

| Terminal | Role |
|---|---|
| 1 | Install, verify, and inspect the controller chain. |
| 2 | Watch the created Kubernetes resources. |
| 3 | Run the OpenEverest UI port-forward. |
| 4 | Run the model Service port-forward. |
| 5 | Run Grafana, API, metrics, and GPU commands. |

Do not record passwords, SSH commands, public addresses, Secrets, or kubeconfig data.

## 1. Load the workshop values

Run this block in all five terminals:

```bash
set -a
PROFILE=kserve-demo
EVEREST_NS=everest-system
INSTANCE_NS=default
MONITORING_NS=monitoring-demo
INSTANCE=qwen-demo
MODEL_NAME=qwen3-0.6b
KUBERNETES_VERSION=v1.36.6
CERT_MANAGER_VERSION=v1.21.3
EVEREST_VERSION=2.0.0-dev.4
PROVIDER_VERSION=0.5.0
MONITORING_VERSION=92.16.1
RUNTIME_IMAGE=ghcr.io/llm-d/llm-d-cuda:v0.9.0
set +a
```

## 2. Verify the Ubuntu GPU host

Run in terminal 1:

```bash
. /etc/os-release
printf 'OS=%s %s\n' "$ID" "$VERSION_ID"
uname -m
systemd-detect-virt || true
nproc
free -h
df -h /
nvidia-smi
docker version
docker info --format '{{json .Runtimes}}'
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
minikube version --short
kubectl version --client=true
helm version --short
```

If the host is WSL, the GPU is absent, or Docker cannot use the GPU, stop.

Gate: The host and container show the same NVIDIA GPU. Minikube reports `v1.39.0`.

## 3. Create the GPU cluster

The Minikube Docker GPU path requires `net.core.bpf_jit_harden=0`.

Record the current value:

```bash
ORIGINAL_BPF_JIT_HARDEN=$(sudo sysctl -n net.core.bpf_jit_harden)
printf '%s\n' "$ORIGINAL_BPF_JIT_HARDEN" >"$HOME/.kserve-demo-bpf-jit-harden"
printf 'Original net.core.bpf_jit_harden=%s\n' "$ORIGINAL_BPF_JIT_HARDEN"
```

Warning: Setting `0` reduces kernel hardening for this lab.

```bash
sudo sysctl -w net.core.bpf_jit_harden=0
minikube start -p "$PROFILE" \
  --driver=docker \
  --container-runtime=docker \
  --gpus=all \
  --kubernetes-version="$KUBERNETES_VERSION" \
  --cpus=16 \
  --memory=32768
kubectl config use-context "$PROFILE"
kubectl get node "$PROFILE" -o wide
kubectl get node "$PROFILE" \
  -o jsonpath='{.status.allocatable.nvidia\.com/gpu}{"\n"}'
```

Run a real CUDA workload:

```bash
kubectl run gpu-smoke --restart=Never \
  --image=nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0 \
  --overrides='{"spec":{"containers":[{"name":"gpu-smoke","image":"nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0","resources":{"limits":{"nvidia.com/gpu":1}}}]}}'
kubectl wait --for=jsonpath='{.status.phase}'=Succeeded pod/gpu-smoke --timeout=30m
kubectl logs gpu-smoke
kubectl delete pod gpu-smoke
```

Gate: GPU capacity is positive and the smoke Pod prints `Test PASSED`.

## 4. Install OpenEverest, KServe, and monitoring

Add the chart repositories:

```bash
helm repo add jetstack https://charts.jetstack.io --force-update
helm repo add openeverest https://openeverest.github.io/helm-charts/ --force-update
helm repo add prometheus-community \
  https://prometheus-community.github.io/helm-charts \
  --force-update
helm repo update
```

Install cert-manager first:

```bash
helm upgrade --install cert-manager jetstack/cert-manager \
  --kube-context "$PROFILE" \
  --namespace cert-manager \
  --create-namespace \
  --version "$CERT_MANAGER_VERSION" \
  --set crds.enabled=true \
  --wait \
  --timeout 30m
```

Install OpenEverest Developer Preview 4:

```bash
read -rsp 'OpenEverest admin password: ' UI_PASSWORD
printf '\n'
helm upgrade --install everest-core openeverest/openeverest \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --create-namespace \
  --devel \
  --version "$EVEREST_VERSION" \
  --set-literal "server.initialAdminPassword=$UI_PASSWORD" \
  --wait \
  --timeout 30m
unset UI_PASSWORD
```

Install the released provider chart. It installs KServe 0.21.0:

```bash
helm upgrade --install provider-kserve \
  oci://ghcr.io/openeverest/charts/provider-kserve \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --version "$PROVIDER_VERSION" \
  --wait \
  --timeout 30m
```

Install monitoring before model creation:

```bash
kubectl --context "$PROFILE" create namespace "$MONITORING_NS" \
  --dry-run=client -o yaml \
  | kubectl --context "$PROFILE" apply -f -
cat >/tmp/kube-prometheus-stack-values.yaml <<'EOF'
alertmanager:
  enabled: false
grafana:
  enabled: true
kubeStateMetrics:
  enabled: false
nodeExporter:
  enabled: false
prometheus:
  prometheusSpec:
    retention: 2h
    scrapeInterval: 15s
    podMonitorSelectorNilUsesHelmValues: false
    podMonitorSelector: {}
    podMonitorNamespaceSelector: {}
EOF
helm upgrade --install observability \
  prometheus-community/kube-prometheus-stack \
  --kube-context "$PROFILE" \
  --namespace "$MONITORING_NS" \
  --version "$MONITORING_VERSION" \
  --values /tmp/kube-prometheus-stack-values.yaml \
  --wait \
  --timeout 30m
```

Provision the released provider dashboard:

```bash
curl --fail --location \
  --output /tmp/vllm-dashboard.json \
  https://raw.githubusercontent.com/openeverest/provider-kserve/v0.5.0/docs/dashboards/vllm.json
kubectl --context "$PROFILE" -n "$MONITORING_NS" create configmap \
  grafana-dashboard-vllm \
  --from-file=vllm.json=/tmp/vllm-dashboard.json \
  --dry-run=client -o yaml \
  | kubectl label --local -f - grafana_dashboard=1 -o yaml \
  | kubectl --context "$PROFILE" apply -f -
```

Verify every release:

```bash
helm list --all-namespaces --kube-context "$PROFILE"
kubectl --context "$PROFILE" -n "$EVEREST_NS" get pods
kubectl --context "$PROFILE" -n "$MONITORING_NS" get pods
kubectl --context "$PROFILE" get provider provider-kserve
kubectl --context "$PROFILE" get crd \
  instances.core.openeverest.io \
  llminferenceservices.serving.kserve.io \
  podmonitors.monitoring.coreos.com
```

Pre-pull the vLLM runtime image:

```bash
timeout 90m minikube -p "$PROFILE" image pull "$RUNTIME_IMAGE"
```

Gate: Helm shows four deployed releases. Platform Pods are ready. The Provider exists.

## 5. Open the browser interfaces

In terminal 3:

```bash
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  port-forward svc/everest 8080:8080
```

In terminal 5:

```bash
kubectl --context "$PROFILE" -n "$MONITORING_NS" \
  port-forward svc/observability-grafana 3000:80 \
  >"$HOME/grafana-port-forward.log" 2>&1 &
GRAFANA_FORWARD_PID=$!
```

Retrieve the Grafana password off-camera:

```bash
kubectl --context "$PROFILE" -n "$MONITORING_NS" \
  get secret observability-grafana \
  -o jsonpath='{.data.admin-password}' | base64 --decode
printf '\n'
```

For a remote GPU host, forward ports 8080, 3000, and 8000 through SSH.

Open `http://localhost:8080` and `http://localhost:3000`. Log in before recording.

## 6. Create the model through the UI

Open OpenEverest, then Instances. Click Create.

Set the Instance fields:

| Section | Field | Value |
|---|---|---|
| Instance | Namespace | `default` |
| Instance | Name | `qwen-demo` |
| Instance | Provider | `provider-kserve` |
| Instance | Topology | `llm` |
| Basic Information | Model | `Qwen3 0.6B` |
| Basic Information | Image pull secret | Empty |
| Basic Information | Served Model Name | `qwen3-0.6b` |
| Basic Information | vLLM Runtime Version | Keep the default |
| Scaling & Parallelism | Replicas | `1` |
| Scaling & Parallelism | Autoscaling | Off |
| Scaling & Parallelism | Tensor parallel size | `1` |
| Scaling & Parallelism | Pipeline parallel size | `1` |
| Scaling & Parallelism | Data parallel size | `1` |
| Scaling & Parallelism | Multi-node workers | Off |
| Runtime | Compute Profile | GPU |
| Runtime | GPUs per pod | `1` |
| Runtime | CPU | `2` |
| Runtime | Memory | `16` GiB |
| Engine Tuning | Max context length | `2048` |
| Engine Tuning | Max concurrent sequences | `1` |
| Engine Tuning | GPU memory utilization | `0.2` |
| Routing | External access | `ClusterIP` |
| Observability | vLLM Prometheus metrics | On |
| Observability | Distributed tracing | Off |

Keep precision, quantization, tool calling, reasoning, LoRA, and Advanced configuration on their defaults.

In terminal 2, start this watch before you submit:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get \
  instance,llminferenceservice,pod,svc,podmonitor -w
```

Return to the UI. Review the values and click Create.

Gate: `qwen-demo` appears in terminal 2. The UI is the only creation path.

## 7. Prove the controller chain and readiness

Run in terminal 1:

```bash
timeout 5m bash -c 'until kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" >/dev/null 2>&1; do sleep 5; done'
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" -o wide
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" -o wide
kubectl -n "$INSTANCE_NS" get deployment,pod,svc
```

Wait for the vLLM Pod:

```bash
export MODEL_SELECTOR="app.kubernetes.io/name=$INSTANCE,kserve.io/component=workload"
timeout 30m bash -c 'until [ -n "$(kubectl -n "$INSTANCE_NS" get pod -l "$MODEL_SELECTOR" -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)" ]; do sleep 5; done'
MODEL_POD=$(kubectl -n "$INSTANCE_NS" get pod \
  -l "$MODEL_SELECTOR" \
  -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$INSTANCE_NS" wait \
  --for=condition=Ready pod/"$MODEL_POD" \
  --timeout=30m
kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" -o wide
kubectl -n "$INSTANCE_NS" get podmonitor
```

If no PodMonitor exists, trigger one provider reconciliation:

```bash
kubectl -n "$INSTANCE_NS" annotate instance "$INSTANCE" \
  "observability-demo-refresh=$(date +%s)" \
  --overwrite
kubectl -n "$INSTANCE_NS" get podmonitor -w
```

Gate: The serving Pod is ready, uses one GPU, and one PodMonitor exists.

## 8. Call the OpenAI-compatible API

In terminal 4:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  port-forward svc/${INSTANCE}-kserve-workload-svc 8000:8000
```

In terminal 5:

```bash
curl --fail-with-body http://localhost:8000/v1/models | jq
REQUEST_FILE=$(mktemp)
cat >"$REQUEST_FILE" <<EOF
{
  "model": "${MODEL_NAME}",
  "messages": [
    {
      "role": "user",
      "content": "Explain why a Kubernetes controller uses desired state."
    }
  ],
  "chat_template_kwargs": {
    "enable_thinking": false
  },
  "max_tokens": 96,
  "temperature": 0
}
EOF
curl --fail-with-body http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  --data-binary "@$REQUEST_FILE" | jq
rm -f "$REQUEST_FILE"
```

Gate: The model list contains `qwen3-0.6b`. The chat request returns assistant text.

## 9. Show vLLM metrics and Grafana

Run in terminal 5:

```bash
curl --fail-with-body http://localhost:8000/metrics | \
  grep -F \
    -e 'vllm:prompt_tokens_total' \
    -e 'vllm:generation_tokens_total' \
    -e 'vllm:request_success_total' \
    -e 'vllm:time_to_first_token_seconds_count' \
    -e 'vllm:e2e_request_latency_seconds_count'
nvidia-smi
```

Open Grafana. Select Dashboards, then Browse. Open dashboard UID `provider-kserve-vllm`.

Set the range to Last 5 minutes and refresh to 5 seconds.

Show token throughput, running requests, waiting requests, time to first token, end-to-end latency, successes, and preemptions.

Gate: Direct counters are positive and Grafana shows the completed request.

## 10. Show the generated resources

Run in terminal 1:

```bash
kubectl -n "$INSTANCE_NS" get instance,llminferenceservice,pod,svc,podmonitor
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" \
  -o jsonpath='{.metadata.ownerReferences}{"\n"}'
kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" \
  -o jsonpath='{.metadata.labels}{"\n"}'
kubectl -n "$INSTANCE_NS" describe pod "$MODEL_POD"
```

Explain this chain:

```text
OpenEverest Instance
  -> provider-kserve 0.5.0
  -> KServe LLMInferenceService 0.21.0
  -> Deployment, Service, and vLLM Pod
  -> NVIDIA GPU
  -> OpenAI-compatible API and Prometheus metrics
```

## 11. Show optional UI controls

Open a second unsaved Instance form. Do not submit it.

Point to CPU and GPU profiles, OCI model images, autoscaling, and LoRA.

Then point to tool calling, reasoning, AI Gateway routing, tracing, and multi-node workers.

State that these controls are available. Do not call them verified workshop results.

Close the unsaved form.

## 12. Speaker timeline

| Time | Show | Say |
|---|---|---|
| 0 to 5 minutes | Architecture | One Instance replaces hand-written serving resources. Controllers remain visible and inspectable. |
| 5 to 12 minutes | OpenEverest form | The provider supplies the model catalog and technology-specific controls. |
| 12 to 20 minutes | Resource watch | OpenEverest stores intent. provider-kserve creates KServe resources. KServe creates the serving workload. |
| 20 to 25 minutes | API terminal | Pod readiness is not enough. A real OpenAI-compatible request proves inference. |
| 25 to 32 minutes | Metrics and Grafana | Request counters and latency show client-visible health. |
| 32 to 38 minutes | Generated resources | The abstraction keeps Kubernetes ownership, status, logs, and events visible. |
| 38 to 42 minutes | Optional selectors | Show available controls without claiming untested paths. |
| 42 to 45 minutes | Ready Instance | Summarize the proof and take questions. |

Use these closing lines:

```text
We created one OpenEverest Instance through the UI.
provider-kserve translated it into KServe resources.
vLLM served a real OpenAI-compatible request on the GPU.
Prometheus and Grafana showed what the model server did.
```

## 13. Recovery

If the UI returns an error, stop. Capture the message and use the prepared recording.

If the model Pod stays in init, inspect the model download:

```bash
kubectl -n "$INSTANCE_NS" describe pod "$MODEL_POD"
kubectl -n "$INSTANCE_NS" logs "$MODEL_POD" -c storage-initializer --tail=150
```

If vLLM fails:

```bash
kubectl -n "$INSTANCE_NS" logs "$MODEL_POD" -c main --tail=200
kubectl -n "$INSTANCE_NS" describe pod "$MODEL_POD"
```

If Grafana fails, show direct `/metrics` output. Do not hide a live failure.

## 14. Cleanup

Warning: These commands delete the workshop Instance and cluster.

Stop the foreground port-forwards in terminals 3 and 4 with `Control+C`.

In terminal 5:

```bash
if [ -n "${GRAFANA_FORWARD_PID:-}" ]; then
  kill "$GRAFANA_FORWARD_PID"
fi
```

Run the remaining cleanup in terminal 1:

```bash
kubectl -n "$INSTANCE_NS" delete instance "$INSTANCE" --ignore-not-found
helm uninstall provider-kserve -n "$EVEREST_NS" --kube-context "$PROFILE"
helm uninstall observability -n "$MONITORING_NS" --kube-context "$PROFILE"
helm uninstall everest-core -n "$EVEREST_NS" --kube-context "$PROFILE"
helm uninstall cert-manager -n cert-manager --kube-context "$PROFILE"
minikube delete -p "$PROFILE"
if [ -f "$HOME/.kserve-demo-bpf-jit-harden" ]; then
  ORIGINAL_BPF_JIT_HARDEN=$(cat "$HOME/.kserve-demo-bpf-jit-harden")
  sudo sysctl -w "net.core.bpf_jit_harden=$ORIGINAL_BPF_JIT_HARDEN"
  rm -f "$HOME/.kserve-demo-bpf-jit-harden"
fi
rm -f /tmp/kube-prometheus-stack-values.yaml /tmp/vllm-dashboard.json
```

Gate: The Minikube profile is absent and the original kernel hardening value is restored.

## Related documents

- [Release sources](release-sources.md).
- [Screenshot guide](../one-click-llm-deployment-screenshot-guide.md).
- [Workshop page](../one-click-llm-deployment-workshop.md).

Final approval rests with the writer.
