# Open Source Hub terminal runbook

Use this runbook for commands shown during the 45-minute workshop.

Use the [UI runbook](../ui/) for browser actions.

Use the [Ubuntu GPU LocalModel runbook](../../ubuntu-gpu-localmodel-runbook.md) for installation and cleanup.

## Terminal roles

Open five terminal windows on the GPU host:

| Terminal | Role |
|---|---|
| 1 | Main cluster checks, controller chain, and cache reuse. |
| 2 | Cache Job, Pod, and PVC watch. |
| 3 | OpenEverest UI port-forward. |
| 4 | Model Service port-forward. |
| 5 | Grafana port-forward, API requests, metrics, and GPU output. |

If the GPU host is remote, open one local terminal for the SSH tunnel.

Do not record the SSH command, public IP address, passwords, or Secrets.

## Load the workshop configuration

Run in terminals 1, 2, 4, and 5:

```bash
WORKSHOP_CONFIG=${WORKSHOP_CONFIG:-"$HOME/ubuntu-gpu-workshop.env"}
set -a
. "$WORKSHOP_CONFIG"
set +a
```

Confirm the selected resources in terminal 1:

```bash
printf 'profile=%s instance=%s namespace=%s model=%s\n' \
  "$PROFILE" "$INSTANCE" "$INSTANCE_NS" "$MODEL_NAME"
```

## Pre-session gate

Complete this gate before the audience arrives:

```bash
kubectl config use-context "$PROFILE"
kubectl get node "$PROFILE" \
  -o custom-columns='NAME:.metadata.name,READY:.status.conditions[?(@.type=="Ready")].status,GPU:.status.allocatable.nvidia\.com/gpu'
kubectl -n "$EVEREST_NS" get pods
kubectl -n "$PROVIDER_NS" get pods
kubectl get provider provider-kserve
kubectl get localmodelnodegroup "$NODE_GROUP"
kubectl -n monitoring-demo get pods
kubectl get crd podmonitors.monitoring.coreos.com
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" >/dev/null 2>&1 && \
  printf 'Delete the rehearsal Instance before the session.\n' >&2 || true
```

Do not continue unless the node GPU is allocatable and every control-plane Pod is ready.

Pre-pull the runtime before the session:

```bash
timeout 90m minikube -p "$PROFILE" image pull "$RUNTIME_IMAGE"
```

## Start the browser tunnels

In terminal 3, expose OpenEverest:

```bash
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  port-forward svc/everest 8080:8080
```

In terminal 5, start Grafana in the background:

```bash
kubectl --context "$PROFILE" -n monitoring-demo \
  port-forward svc/observability-grafana 3000:80 \
  >"$HOME/grafana-port-forward.log" 2>&1 &
GRAFANA_FORWARD_PID=$!
printf 'Grafana port-forward PID: %s\n' "$GRAFANA_FORWARD_PID"
```

If the GPU host is remote, run one SSH tunnel on the presentation computer:

```text
ssh -N -i <ssh-key> \
  -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -L 127.0.0.1:8080:127.0.0.1:8080 \
  -L 127.0.0.1:3000:127.0.0.1:3000 \
  -L 127.0.0.1:8000:127.0.0.1:8000 \
  ubuntu@<gpu-host>
```

Confirm that OpenEverest and Grafana load before recording.

## Watch the UI create the resources

Start this watch in terminal 2 before the presenter clicks Create:

```bash
kubectl -n "$JOB_NS" get jobs,pods,pvc -w
```

In terminal 1, watch the OpenEverest and KServe resources:

```bash
kubectl -n "$INSTANCE_NS" get \
  instance,llminferenceservice,localmodelnamespacecache,pod,svc -w
```

Stop the terminal 1 watch after the Instance appears.

Show the controller chain:

```bash
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" \
  -o custom-columns='INSTANCE:.metadata.name,PHASE:.status.phase,MESSAGE:.status.message'
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE"
kubectl -n "$INSTANCE_NS" get llminferenceservice,pod,svc
```

Explain the chain:

```text
Instance
  -> provider-kserve
  -> LLMInferenceService
  -> LocalModel cache
  -> Deployment, Service, and Pod
```

## Prove cache readiness

Wait in terminal 1:

```bash
timeout 30m bash -c 'until [ "$(kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o jsonpath="{.status.copies.available}/{.status.copies.total}" 2>/dev/null)" = "1/1" ]; do sleep 10; done'
```

Stop the terminal 2 watch with `Control+C`.

Show the cache proof:

```bash
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" \
  -o custom-columns='NAME:.metadata.name,AVAILABLE:.status.copies.available,TOTAL:.status.copies.total,FAILED:.status.copies.failed'
kubectl -n "$JOB_NS" get jobs,pods,pvc
kubectl get pv
```

The gate is one available copy, one total copy, and a completed download Job.

## Prove model readiness

Set the live Pod name in terminal 1:

```bash
timeout 30m bash -c 'until [ -n "$(kubectl -n "$INSTANCE_NS" get pod -l internal.serving.kserve.io/localmodel="$INSTANCE" -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)" ]; do sleep 5; done'
MODEL_POD=$(kubectl -n "$INSTANCE_NS" get pod \
  -l internal.serving.kserve.io/localmodel="$INSTANCE" \
  -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$INSTANCE_NS" wait \
  --for=condition=Ready pod/"$MODEL_POD" --timeout=30m
```

Show the access and GPU proof:

```bash
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- \
  sh -c 'id; test -r /mnt/models/config.json; echo model-config-readable'
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- nvidia-smi
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" \
  -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,MESSAGE:.status.message'
```

## Verify the PodMonitor

Run after the Instance becomes ready:

```bash
kubectl -n "$INSTANCE_NS" get podmonitor
```

If no PodMonitor exists, trigger another reconciliation:

```bash
kubectl -n "$INSTANCE_NS" annotate instance "$INSTANCE" \
  "observability-demo-refresh=$(date +%s)" --overwrite
kubectl -n "$INSTANCE_NS" get podmonitor -w
```

Stop the watch after the PodMonitor appears.

## Start the model API tunnel

In terminal 4, run:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  port-forward svc/${INSTANCE}-kserve-workload-svc 8000:8000
```

Confirm that port 8000 is open before the API segment.

## Call the OpenAI-compatible API

In terminal 5, list models:

```bash
curl --fail-with-body http://localhost:8000/v1/models | jq
```

Create one request file:

```bash
REQUEST_FILE=$(mktemp)
cat >"$REQUEST_FILE" <<EOF
{
  "model": "${MODEL_NAME}",
  "messages": [
    {
      "role": "user",
      "content": "Explain why model caching reduces cold-start latency."
    }
  ],
  "chat_template_kwargs": {
    "enable_thinking": false
  },
  "max_tokens": 96,
  "temperature": 0
}
EOF
```

Send the request:

```bash
curl --fail-with-body http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  --data-binary "@$REQUEST_FILE" | jq
rm -f "$REQUEST_FILE"
```

The gate is a completed assistant response with model `qwen3-0.6b`.

## Show live metrics and GPU state

Run immediately after the request:

```bash
curl --fail-with-body http://localhost:8000/metrics | \
  grep -F \
    -e 'vllm:prompt_tokens_total' \
    -e 'vllm:generation_tokens_total' \
    -e 'vllm:request_success_total' \
    -e 'vllm:time_to_first_token_seconds_count' \
    -e 'vllm:e2e_request_latency_seconds_count' \
    -e 'http_requests_total'
nvidia-smi
```

The counters must be positive. `nvidia-smi` must list `VLLM::EngineCore`.

Return to Grafana and refresh the dashboard.

## Delete the Pod and prove cache reuse

In terminal 1, capture the Job list and old Pod UID:

```bash
JOB_LIST_BEFORE=$(mktemp)
JOB_LIST_AFTER=$(mktemp)
kubectl -n "$JOB_NS" get jobs -o name | sort >"$JOB_LIST_BEFORE"
OLD_UID=$(kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" \
  -o jsonpath='{.metadata.uid}')
REUSE_START=$(date +%s)
```

Delete only the serving Pod:

```bash
kubectl -n "$INSTANCE_NS" delete pod "$MODEL_POD" --wait=true
```

Wait for a different Pod UID:

```bash
OLD_UID="$OLD_UID" timeout 30m bash -c 'until pod=$(kubectl -n "$INSTANCE_NS" get pod -l internal.serving.kserve.io/localmodel="$INSTANCE" -o jsonpath="{.items[0].metadata.name}" 2>/dev/null); [ -n "$pod" ] && [ "$(kubectl -n "$INSTANCE_NS" get pod "$pod" -o jsonpath="{.metadata.uid}" 2>/dev/null)" != "$OLD_UID" ]; do sleep 5; done'
MODEL_POD=$(kubectl -n "$INSTANCE_NS" get pod \
  -l internal.serving.kserve.io/localmodel="$INSTANCE" \
  -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$INSTANCE_NS" wait \
  --for=condition=Ready pod/"$MODEL_POD" --timeout=30m
```

Print the proof:

```bash
REUSE_END=$(date +%s)
NEW_UID=$(kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" \
  -o jsonpath='{.metadata.uid}')
kubectl -n "$JOB_NS" get jobs -o name | sort >"$JOB_LIST_AFTER"
printf 'Old Pod UID: %s\n' "$OLD_UID"
printf 'New Pod UID: %s\n' "$NEW_UID"
printf 'Replacement readiness: %s seconds\n' "$((REUSE_END-REUSE_START))"
if diff -u "$JOB_LIST_BEFORE" "$JOB_LIST_AFTER"; then
  printf 'New download Jobs: none\n'
else
  printf 'The replacement created a download Job.\n' >&2
  exit 1
fi
rm -f "$JOB_LIST_BEFORE" "$JOB_LIST_AFTER"
```

Call the chat API again. The response must succeed.

## Recovery commands

If the cache remains `0/1`, show:

```bash
kubectl -n "$JOB_NS" get jobs,pods,pvc
kubectl -n "$PROVIDER_NS" logs daemonset/kserve-localmodelnode-agent --tail=100
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o yaml
```

If the model Pod fails, show:

```bash
kubectl -n "$INSTANCE_NS" describe pod "$MODEL_POD"
kubectl -n "$INSTANCE_NS" logs "$MODEL_POD" -c main --tail=150
```

Do not debug for more than two minutes. Switch to the backup recording.

## After the session

Stop each port-forward with `Control+C`.

Stop the background Grafana port-forward:

```bash
kill "$GRAFANA_FORWARD_PID"
```

Continue with cleanup in the [Ubuntu GPU LocalModel runbook](../../ubuntu-gpu-localmodel-runbook.md).

Final approval rests with the writer.
