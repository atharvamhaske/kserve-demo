# Workshop screenshot capture guide

Use this guide during the final Open Source Hub rehearsal.

Follow the [all-in-one runbook](open-source-hub-workshop/).

## Before the demo

Create the asset directory:

```bash
mkdir -p docs/assets/one-click-llm-deployment
```

Open five terminal windows:

| Terminal | Role |
|---|---|
| 1 | Install and inspect the platform. |
| 2 | Watch the created resources. |
| 3 | Run the OpenEverest UI port-forward. |
| 4 | Run the model Service port-forward. |
| 5 | Run Grafana, API, metrics, and GPU commands. |

Use a terminal font of at least 18 points.

Do not show passwords, SSH commands, public addresses, tokens, private keys, kubeconfig data, or Secrets.

Save each file with the exact name from this guide.

## Capture 1: GPU preflight

Use terminal 1 before Minikube starts.

Run:

```bash
nvidia-smi
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
```

Capture both commands showing the same NVIDIA GPU.

Save:

```text
01-gpu-preflight.png
```

## Capture 2: Kubernetes GPU

Use terminal 1 after the CUDA smoke Pod succeeds.

Run:

```bash
kubectl get node "$PROFILE" \
  -o custom-columns='NAME:.metadata.name,READY:.status.conditions[?(@.type=="Ready")].status,GPU:.status.allocatable.nvidia\.com/gpu,VERSION:.status.nodeInfo.kubeletVersion'
kubectl logs gpu-smoke
```

Capture the allocatable GPU and `Test PASSED` before deleting the Pod.

Save:

```text
02-kubernetes-gpu.png
```

## Capture 3: Released platform

Use terminal 1 after platform installation.

Run:

```bash
helm list --all-namespaces --kube-context "$PROFILE"
kubectl --context "$PROFILE" -n "$EVEREST_NS" get pods
kubectl --context "$PROFILE" get provider provider-kserve
```

Capture the pinned releases, ready Pods, and registered Provider.

Save:

```text
03-released-platform.png
```

Do not capture the OpenEverest password command.

## Capture 4: OpenEverest model selector

Use the browser during the UI creation section.

Open Instances and start a new `llm` Instance with `provider-kserve`.

Open the Model selector. Keep `Qwen3 0.6B` selected and the catalog visible.

Include the Instance name, Provider, Topology, and Model fields.

Take this image before clicking Create.

Save:

```text
04-ui-model-selector.png
```

## Capture 5: Ready model resources

Use terminal 1 after the serving Pod becomes ready.

Run:

```bash
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" -o wide
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" -o wide
kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" -o wide
kubectl -n "$INSTANCE_NS" get svc,podmonitor
```

Capture the Instance, `LLMInferenceService`, ready Pod, Service, and PodMonitor.

Save:

```text
05-ready-model-resources.png
```

## Capture 6: OpenAI-compatible API

Keep the model Service port-forward in terminal 4.

Use terminal 5 after the API section.

Run `/v1/models`, then run the chat completion request.

Capture the model list and completed assistant response.

Save:

```text
06-openai-api.png
```

The model list must contain `qwen3-0.6b`.

## Capture 7: vLLM metrics and GPU

Use terminal 5 immediately after the chat request.

Run:

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

Capture positive counters and the `VLLM::EngineCore` GPU process.

Save:

```text
07-vllm-metrics-gpu.png
```

## Capture 8: Grafana dashboard

Open dashboard UID `provider-kserve-vllm`.

Set the range to Last 5 minutes and refresh to 5 seconds.

Capture token throughput, requests, time to first token, and end-to-end latency.

Save:

```text
08-grafana-vllm.png
```

Do not capture the Grafana login page or password.

## Capture 9: Generated controller chain

Use terminal 1 during the generated resources section.

Run:

```bash
kubectl -n "$INSTANCE_NS" get instance,llminferenceservice,pod,svc,podmonitor
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" \
  -o jsonpath='{.metadata.ownerReferences}{"\n"}'
kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" \
  -o jsonpath='{.metadata.labels}{"\n"}'
```

Capture the resource list, owner reference, and Pod labels.

Save:

```text
09-controller-chain.png
```

## Crop and size

Keep each image smaller than 1.5 MB. Keep text readable at GitHub page width.

On macOS, resize a large image with:

```bash
sips -Z 1800 docs/assets/one-click-llm-deployment/01-gpu-preflight.png
```

Crop empty terminal space. Do not stretch an image.

## Add images to the workshop page

Use descriptive alternative text:

```markdown
![OpenEverest Qwen model selector backed by provider-kserve](assets/one-click-llm-deployment/04-ui-model-selector.png)
```

Do not use `screenshot`, `image`, or a file name as alternative text.

## Final check

Run:

```bash
find docs/assets/one-click-llm-deployment -name '*.png' -size +1500k -print
git diff --check
```

The first command must print no files.

Open every image from the rendered workshop page before publishing.

Final approval rests with the writer.
