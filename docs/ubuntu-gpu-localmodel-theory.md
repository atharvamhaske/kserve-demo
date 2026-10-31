# Ubuntu GPU LocalModel theory

This guide explains the system that the workshop creates. Read it before you present the procedure.

The guide is descriptive. The runbook contains the commands.

## Workshop goal

The workshop serves Qwen3 0.6B on one NVIDIA GPU. OpenEverest manages the user-facing model resource.

KServe manages model storage and the vLLM workload. LocalModel stores one model copy on the selected node.

A replacement Pod uses the existing copy. It does not start another model download Job.

## Control path

The control path creates and reconciles Kubernetes resources.

```text
OpenEverest Instance
  -> provider-kserve
  -> KServe LLMInferenceService
  -> Kubernetes Deployment
  -> vLLM Pod
```

The `Instance` contains the model URI, resource limits, model name, and cache request.

The provider converts that resource into KServe resources. KServe converts them into a Deployment, Pod, Service, PVC, and cache labels.

The controllers do not process inference requests. They compare desired state with live state and correct differences.

## Cache path

The cache path moves the model from Hugging Face to node storage.

```text
hf://Qwen/Qwen3-0.6B
  -> LocalModelNamespaceCache
  -> node download Job
  -> local PV and PVC
  -> /models/models/<storage-key>
  -> serving Pod mount at /mnt/models
```

The node group selects eligible nodes and defines storage capacity. The namespace cache requests one copy in that node group.

The node agent creates a download Job. The Job writes the model through a PVC into the node directory.

KServe records one available copy after the agent can inspect the model directory. The serving Pod then reads the same files through a read-only mount.

## Storage objects

The StorageClass uses `kubernetes.io/no-provisioner`. Kubernetes does not create remote storage for this class.

The LocalModel controller creates a local PV for the selected node. The PV uses the path from the node-agent DaemonSet.

The cache PVC binds to that local PV. Node affinity keeps the serving Pod on the node that contains the model.

`modelSize` reserves capacity in the LocalModel system. It does not stop a download that is larger than the declared value.

## Identity contract

Four processes need compatible access to the cache.

| Process | Verified identity | Required access |
|---|---|---|
| Storage initializer in the download Job | UID 1000 and fsGroup 1000 | Create model files. |
| LocalModel node agent | Explicit UID and GID 1000 | Create, inspect, and remove cache entries. |
| llm-d serving process | UID 2000 with supplementary group 1000 | Read the mounted model files. |
| Minikube node administrator | Root | Prepare the parent directories. |

The cache directories use owner `root`, group `1000`, and mode `2775`. The setgid bit keeps group 1000 on new directories.

The hashed model directory can use mode `2770`. The serving process can traverse it because the Pod receives fsGroup 1000.

## Verified failure

The first download attempts failed because the cache directory did not permit the writer identity.

The download succeeded after the directory used group 1000. The model files and `config.json` then existed in the correct PVC path.

The serving process still failed. UID 2000 did not have group 1000 and did not have read access to `config.json`.

vLLM reported this message:

```text
Invalid repository ID or local directory specified: '/mnt/models'.
```

The message described an unreadable directory as an invalid directory. The model URI and model files were valid.

The Pod worked after it received fsGroup 1000. vLLM loaded the model on the Blackwell GPU and served a chat request.

The node agent also needed identity 1000. Its default image identity did not have access to the restricted model directory.

## Readiness contract

When all requested copies are available, the cache is ready.

For this workshop, the ready state is:

```text
available=1
total=1
failed=0
nodeStatus=NodeDownloaded
```

The current provider applies the cache and creates the LLM workload immediately. It does not wait for the cache status.

The runbook treats the cache as the first gate. It evaluates the model Pod only after the cache reports `1/1`.

This procedure avoids a false failure during a short download. The provider still needs a source change for durable readiness control.

## Serving path

The request path does not pass through the controllers.

```text
curl
  -> SSH tunnel
  -> kubectl port-forward
  -> KServe workload Service
  -> vLLM Pod
  -> NVIDIA GPU
```

The workload Service uses port 8000. vLLM provides an OpenAI-compatible API on that port.

`/v1/models` lists the served model name. `/v1/chat/completions` runs inference.

The workshop uses a ClusterIP Service. It does not add an ingress controller or an AI Gateway.

## Telemetry path

vLLM publishes Prometheus metrics at `/metrics` on port 8000.

```text
vLLM process
  -> /metrics
  -> curl during this workshop
```

The important workshop metrics are:

| Metric | Meaning |
|---|---|
| `vllm:num_requests_running` | Requests that run now. |
| `vllm:num_requests_waiting` | Requests in the queue. |
| `vllm:kv_cache_usage_perc` | Fraction of the KV cache in use. |
| `vllm:prompt_tokens_total` | Input tokens processed. |
| `vllm:generation_tokens_total` | Output tokens generated. |
| `vllm:request_success_total` | Completed requests by finish reason. |
| `vllm:time_to_first_token_seconds` | Delay before the first output token. |
| `vllm:e2e_request_latency_seconds` | Full request duration. |

The VM contains the VictoriaMetrics operator but no metrics data store. The workshop reads live metrics directly.

A production cluster can add Prometheus and Grafana. The provider can create a PodMonitor after the Prometheus CRD exists.

## Pod replacement and cache reuse

Kubernetes creates a new Pod after the presenter deletes the serving Pod.

The replacement Pod receives the same cache PVC. The node already contains the runtime image and model files.

A successful reuse test has these results:

- The Pod UID changes.
- The new Pod becomes ready.
- The Job list does not change.
- The chat API works again.

The test separates model cache reuse from container image reuse. The runbook pre-pulls the runtime image before it measures replacement time.

## LocalModel and ModelCar

LocalModel and ModelCar solve related distribution problems with different storage paths.

| Property | LocalModel | ModelCar |
|---|---|---|
| Source | Hugging Face, S3, or another storage URI | OCI image |
| Node data | Local PV and PVC | Container image layers |
| Download actor | Kubernetes Job | Kubelet and container runtime |
| Status | Copy status per selected node | Pod image status |
| Serving access | PVC mount | Shared process namespace and symlink |
| Identity rule | Compatible UID or supplementary GID | Same UID as ModelCar, or root |

The provider already accepts `oci://` and `oci+native://` model URIs.

`oci://` uses KServe ModelCar. KServe configures UID 1010 for the ModelCar and serving container in this chart.

`oci+native://` uses a read-only Kubernetes image volume. It removes the shared process namespace and ModelCar UID rule.

The workshop uses LocalModel because it demonstrates explicit pre-download status and Pod reuse. A ModelCar demonstration needs a separate runbook.

## Resource boundaries

Kubernetes allocates the full `nvidia.com/gpu: 1` resource to one Pod. GPU memory size does not permit a second GPU Pod automatically.

The demo uses one model Pod and one request sequence. It does not test multi-node serving, MIG, time sharing, or production autoscaling.

The 0.2 GPU memory value was verified on a 98 GiB GPU. A smaller GPU needs a separate memory test.

## Security boundaries

The lab uses a disposable machine. The node agent has broad permissions and writes to a host-backed path.

The procedure changes one kernel hardening value for Minikube. Cleanup restores the recorded value.

The recording must not include passwords, tokens, private keys, public IP addresses, kubeconfig data, or Kubernetes Secrets.

## Related documents

- [Workshop prerequisites](ubuntu-gpu-workshop-prerequisites.md)
- [Workshop decisions](ubuntu-gpu-workshop-decisions.md)
- [LocalModel runbook](ubuntu-gpu-localmodel-runbook.md)
- [Kubernetes and vLLM observability](kubernetes-and-vllm-observability.md)

Final approval rests with the writer.
