# Workshop screenshot capture guide

Use this guide during the final Open Source Hub rehearsal.

The guide names each capture, the correct terminal, and the exact time to take it.

## Before the demo

Create this repository directory:

```bash
mkdir -p docs/assets/one-click-llm-deployment
```

Open five terminal windows:

| Terminal | Role |
|---|---|
| 1 | Run the main cluster and cache-reuse commands. |
| 2 | Watch cache resources. |
| 3 | Run the OpenEverest UI port-forward. |
| 4 | Run the model Service port-forward. |
| 5 | Run API, metrics, GPU, and Grafana commands. |

Set the terminal font to at least 18 points. Use a dark background and high-contrast text.

Do not show the SSH command, public IP address, password, token, private key, kubeconfig, or Kubernetes Secret.

On macOS, press `Shift+Command+4`. Then press Space and click the terminal window.

Save each file with the exact name from this guide.

## Capture 1: GPU preflight

Use terminal 1 before Minikube starts.

Run:

```bash
nvidia-smi
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
```

When both commands show the same NVIDIA GPU, click the terminal window.

Save the image as:

```text
01-gpu-preflight.png
```

The image must show the GPU name, driver version, CUDA version, and container GPU result.

## Capture 2: Kubernetes GPU

Use terminal 1 after runbook step 4.

Run:

```bash
kubectl get node "$PROFILE" \
  -o custom-columns='NAME:.metadata.name,STATUS:.status.conditions[-1].type,GPU:.status.allocatable.nvidia\.com/gpu,VERSION:.status.nodeInfo.kubeletVersion'
kubectl logs gpu-smoke
```

When the node reports GPU capacity and `Test PASSED`, click the terminal window.

Take the image before you delete the smoke Pod.

Save the image as:

```text
02-kubernetes-gpu.png
```

## Capture 3: OpenEverest and KServe platform

Use terminal 1 after runbook step 7.

Run:

```bash
kubectl get pods -n "$EVEREST_NS"
kubectl get pods -n "$PROVIDER_NS"
kubectl get provider provider-kserve
```

When every Pod is ready and `Running`, click the terminal window after the Provider status appears.

Save the image as:

```text
03-platform-ready.png
```

Do not capture the OpenEverest password command.

## Capture 4: OpenEverest model selector

Use the browser during runbook step 9.

Open Instances and start a new `llm` Instance with `provider-kserve`.

Open the Model selector. Keep the model list visible with `Qwen3 0.6B` selected.

Include the Instance name, Provider, Topology, and Model fields in the image.

Take the image before you click Create.

Save the image as:

```text
04-ui-model-selector.png
```

Do not capture the login form, admin password, public host, or SSH command.

## Capture 5: LocalModel cache

Use terminal 2 after runbook step 9.

Stop the watch with `Control+C`. Then run:

```bash
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" \
  -o custom-columns='NAME:.metadata.name,AVAILABLE:.status.copies.available,TOTAL:.status.copies.total,FAILED:.status.copies.failed'
kubectl -n "$JOB_NS" get jobs,pods,pvc
kubectl get pv
```

When the cache reports `1/1` and the Job reports `Complete`, click the terminal window.

Include the cache, Job, PVC, and PV in the image.

Save the image as:

```text
05-localmodel-cache.png
```

## Capture 6: Ready OpenEverest Instance

Use terminal 1 after runbook step 10.

Run:

```bash
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" \
  -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,MESSAGE:.status.message'
kubectl -n "$INSTANCE_NS" get llminferenceservice,pod,svc
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- \
  sh -c 'id; test -r /mnt/models/config.json; echo model-config-readable'
```

When the `Instance` reports `Ready` and the Pod reports `1/1`, click the terminal window.

Take the image after `model-config-readable` appears.

Save the image as:

```text
06-instance-ready.png
```

## Capture 7: OpenAI-compatible API

Keep the model Service port-forward running in terminal 4.

Use terminal 5 after runbook step 11.

Run the `/v1/models` command. Then run the chat completion command from the runbook.

If `jq` is available, format each response:

```bash
curl --fail-with-body http://localhost:8000/v1/models | jq
```

When both API responses are valid, click terminal 5.

The model list must contain `qwen3-0.6b`. The chat response must contain assistant text and no error.

Do not include unrelated shell history.

Save the image as:

```text
07-openai-api.png
```

## Capture 8: vLLM metrics and GPU

Use terminal 5 immediately after the chat request.

Run:

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

When the counters are positive and `VLLM::EngineCore` appears, click the terminal window.

Include both the metrics and GPU process.

Save the image as:

```text
08-vllm-metrics.png
```

## Capture 9: Cache reuse

Use terminal 1 during runbook step 12.

Run the complete reuse block. It prints these results:

- The old Pod UID.
- The new Pod UID.
- Replacement readiness in seconds.
- `New download Jobs: none`.

The old and new Pod UIDs must differ.

Call the chat API once more after the replacement Pod is ready.

When the response succeeds, click the terminal window. Include the UIDs, Job result, readiness time, and chat response.

Save the image as:

```text
09-cache-reuse.png
```

## Crop and size

Keep each image smaller than 1.5 MB. Keep text readable at the GitHub page width.

On macOS, resize a large image with:

```bash
sips -Z 1800 docs/assets/one-click-llm-deployment/01-gpu-preflight.png
```

Repeat the command for each image.

Do not stretch an image. Crop empty terminal space instead.

## Add the images to the blog

Add each image after the matching blog section.

Use descriptive alternative text:

```markdown
![KServe LocalModel cache with one available copy](assets/one-click-llm-deployment/05-localmodel-cache.png)
```

Do not use `screenshot`, `image`, or a file name as alternative text.

## Final check

Run:

```bash
find docs/assets/one-click-llm-deployment -name '*.png' -size +1500k -print
git diff --check
```

The first command must print no files. Open the blog from GitHub and click every image before publishing.

Final approval rests with the writer.
