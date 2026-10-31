# OpenEverest KServe GPU demo

A reproducible workshop for serving Qwen3 0.6B on an NVIDIA GPU with OpenEverest, provider-kserve, KServe, and vLLM.

## Open Source Hub workshop

Start with the [UI-first workshop module](docs/open-source-hub-workshop/README.md).

Before presenting, read the [model creation and parallelism guide](docs/open-source-hub-workshop/model-configuration-guide.md). It explains preset cards, manual UI fields, Instance YAML, and every scaling method.

It contains one script entry point, pinned Helm values, Kubernetes manifests, every UI selector, a Go client, recovery, and cleanup.

The current path uses provider-kserve 0.5.0 on native Ubuntu. It exposes Qwen3 0.6B through HTTPS and creates one API key per application.

## Quick start

```bash
cd docs/open-source-hub-workshop
./scripts/workshop.sh prepare
```

Run `./scripts/workshop.sh tunnel` in terminal 2. Then run `https-local`, `verify`, and `ui` in terminal 1.

Create `qwen-demo` from the `kserve-qwen-demo-gateway` preset. Create `chat-app` and `batch-job` in the Users tab.

## Workshop files

```text
docs/open-source-hub-workshop/
├── README.md                      # UI-first runbook and speaker flow
├── model-configuration-guide.md  # Preset, YAML, parallelism, and attendee answers
├── release-sources.md            # Release and API evidence
├── scripts/README.md             # Operator entry point and staged commands
├── config/README.md              # Pinned workshop versions and names
├── values/README.md              # Provider and monitoring Helm values
├── manifests/README.md           # Preset, Instance, user, and TLS manifests
└── clients/README.md             # Curl and Go client contract
```

The public page and screenshot guide are in `docs/one-click-llm-deployment-*`.

## Earlier verified WSL result

The lab completed this path:

```text
Mac curl
  -> SSH local forward
  -> Windows OpenSSH
  -> WSL kubectl port-forward
  -> Kubernetes ClusterIP Service
  -> KServe-managed vLLM Pod
  -> NVIDIA GPU
  -> Qwen3 0.6B response
```

Verified outcomes:

- WSL exposed the NVIDIA GPU.
- Docker completed a CUDA vector-add test.
- Kubernetes allocated `nvidia.com/gpu: 1` to a Pod.
- OpenEverest and provider-kserve created the KServe resources.
- Qwen3 0.6B loaded into GPU memory.
- The model Pod reached `1/1 Running`.
- `/v1/models` returned `qwen3-0.6b`.
- `/v1/chat/completions` returned a completed response.
- `nvidia-smi` in the model container showed GPU use.

## Additional references

| Document | Purpose |
|---|---|
| [All-in-one Open Source Hub runbook](docs/open-source-hub-workshop/README.md) | Current native Ubuntu setup, UI deployment, API, metrics, speaker cues, recovery, and cleanup |
| [Workshop release sources](docs/open-source-hub-workshop/release-sources.md) | Official version and compatibility evidence |
| [Model creation and parallelism guide](docs/open-source-hub-workshop/model-configuration-guide.md) | Presenter choice, preset versus YAML, GPU planning, and attendee questions |
| [Public workshop page](docs/one-click-llm-deployment-workshop.md) | Event summary, architecture, schedule, and proof |
| [Screenshot guide](docs/one-click-llm-deployment-screenshot-guide.md) | Exact capture points and file names |
| [WSL GPU demo runbook](docs/wsl-gpu-demo-runbook.md) | Earlier verified WSL setup, deployment, UI, inference, and recording procedure |
| [Lab findings and troubleshooting](docs/wsl-gpu-lab-findings.md) | Earlier environment, observed failures, root causes, fixes, and evidence |
| [Workshop FAQ](docs/wsl-gpu-workshop-faq.md) | Architecture, audience questions, demo boundaries, and fallback answers |
| [Kubernetes and vLLM observability](docs/kubernetes-and-vllm-observability.md) | Controller, request-flow, metrics, Grafana, and OpenTelemetry reference |
| [Local Envoy AI Gateway rehearsal](docs/envoy-ai-gateway-rehearsal.md) | Unverified local routing, authentication, 401, and 403 exercise |

Use the all-in-one runbook for the current workshop. Use the WSL documents only for the earlier verified environment.

## Cluster mental model

The laboratory contains several nested systems. Names from one layer do not automatically exist in another.

```text
Mac
  browser, curl, and SSH client
  -> Windows workstation
     OpenSSH server
     -> WSL 2 Ubuntu
        Docker Engine
        -> Minikube node container named everest-gpu
           Kubernetes cluster and context named everest-gpu
           -> Kubernetes namespaces
              -> controllers, model workloads, and Services
```

`everest-gpu` is the Minikube profile, kubeconfig context, cluster, and node name in this lab. It is not an application namespace.

Use these commands to distinguish the layers:

```bash
minikube profile list
kubectl config current-context
kubectl get nodes
kubectl get namespaces
kubectl get pods --all-namespaces -o wide
```

## Namespace map

These namespaces existed in the observed cluster. The table states their intended role. Always use `kubectl get pods --all-namespaces` for the live inventory.

| Namespace | Intended role | Typical contents |
|---|---|---|
| `cert-manager` | Certificate and webhook support | cert-manager controller, cainjector, and webhook |
| `default` | General workloads when no dedicated namespace is chosen | Intended home for the clean `qwen-demo` Instance; confirm live workloads with `kubectl get pods -A` |
| `everest-monitoring` | OpenEverest monitoring integration namespace | Its existence alone does not prove Prometheus or Grafana is installed |
| `everest-system` | OpenEverest control plane and UI | OpenEverest server, controllers, and supporting Services |
| `kube-node-lease` | Kubernetes node heartbeat leases | Lease objects, normally no application Pods |
| `kube-public` | Publicly readable cluster metadata | ConfigMaps, normally no application Pods |
| `kube-system` | Kubernetes and Minikube system components | DNS, control-plane static Pods, storage support, Metrics Server when enabled, and GPU device integration |
| `provider-kserve` | provider-kserve and bundled operator control plane | provider controller, KServe controllers and webhooks, plus optional gateway controllers |

The first working model was accidentally created in `cert-manager`. That was technically possible because Instances are namespaced, but it mixed an application workload with certificate infrastructure. Use `default` or a dedicated namespace such as `llm-demo` for the final demonstration.

## Control-plane ownership

```text
OpenEverest UI or kubectl
  -> Instance
     watched by provider-kserve
  -> LLMInferenceService and optional LLMInferenceServiceConfig
     watched by KServe LLM controllers
  -> Deployment or LeaderWorkerSet, Pod, Service, and optional InferencePool
     managed by Kubernetes and KServe
  -> status flows back through provider-kserve
  -> Instance status appears in OpenEverest
```

The controllers are not in the direct inference request path. They continuously reconcile desired state.

## Important resource types

| Resource | API owner | Purpose |
|---|---|---|
| `Provider` | OpenEverest | Registers provider-kserve schemas, versions, UI fields, and capabilities |
| `Instance` | OpenEverest | User-facing desired state and connection status |
| `InstancePreset` | OpenEverest | Reusable UI and deployment defaults |
| `LLMInferenceService` | KServe | Desired vLLM model-serving topology |
| `LLMInferenceServiceConfig` | KServe | Composable runtime and Pod configuration |
| `InferenceService` | KServe | Predictive or custom-container serving topology |
| `ClusterServingRuntime` | KServe | Available model-server runtime definitions |
| `ClusterStorageContainer` | KServe | Model downloader selected by URI scheme |
| `PodMonitor` | Prometheus Operator | Tells Prometheus how to scrape model Pods |
| `Gateway`, `AIGatewayRoute`, and `SecurityPolicy` | Optional Gateway controllers | Shared routing and API-key policy |
| `Certificate` and `Issuer` | cert-manager | Optional TLS certificate lifecycle |
| `LeaderWorkerSet` | Optional LWS controller | Multi-node model layouts |

`Deployment`, `ReplicaSet`, `Pod`, `Service`, `Secret`, and `ConfigMap` are native Kubernetes resources, not CRDs.

List the installed CRDs:

```bash
kubectl get customresourcedefinitions
```

List the important live objects:

```bash
kubectl get provider
kubectl get instance --all-namespaces
kubectl get llminferenceservice --all-namespaces
kubectl get deployment,pod,service --all-namespaces
```

## Request, metric, and trace flows

Direct request path verified in the lab:

```text
curl
  -> SSH and kubectl port-forwards
  -> KServe workload Service
  -> vLLM Pod
  -> NVIDIA GPU
```

Prometheus metric path:

```text
vLLM Pod :8000/metrics
  <- selected by PodMonitor
  <- scraped by Prometheus
  <- queried by Grafana
```

OpenTelemetry trace path:

```text
instrumented KServe and model components
  -> OTLP exporter
  -> OpenTelemetry Collector
  -> trace backend such as Tempo or Jaeger
  -> Grafana or trace UI
```

Metrics and traces are different:

- Metrics are numeric time series such as queue depth, token counts, latency histograms, and KV-cache usage.
- Traces connect spans from one request across instrumented components.
- A `PodMonitor` does not collect traces.
- An OpenTelemetry Collector does not create the provider's Prometheus metrics.

See [Kubernetes and vLLM observability](docs/kubernetes-and-vllm-observability.md) for the complete Pod, namespace, CRD, metrics, Grafana, and OTLP revision guide.

## Observed GPU host

These are the specifications of the verified lab, not minimum requirements.

| Item | Observed value |
|---|---|
| Host OS | Windows with WSL 2 |
| WSL distribution | Ubuntu 26.04 LTS, amd64 |
| Init system | systemd |
| GPU | NVIDIA RTX 4000 Ada Generation |
| GPU memory | 20,475 MiB |
| Windows NVIDIA driver | 596.86 |
| WSL NVIDIA-SMI | 595.91.02 |
| Reported CUDA capability | CUDA 13.2 |
| WSL memory | 15 GiB total |
| Minikube allocation | 4 CPUs and 12,288 MiB memory |
| Minikube driver | Docker |
| Kubernetes runtime | Docker |

The lab did not establish a universal minimum hardware specification. When the model, context length, concurrency, runtime image, or Kubernetes topology changes, revalidate capacity.

## Model specifications

Model-card properties:

| Item | Value |
|---|---|
| Model | Qwen3 0.6B |
| Hugging Face URI | `hf://Qwen/Qwen3-0.6B` |
| Type | Causal language model |
| Parameters | 0.6B total, 0.44B non-embedding |
| Layers | 28 |
| Attention heads | 16 query heads, 8 key/value heads |
| Published context length | 32,768 tokens |
| License | Apache 2.0 |
| Thinking modes | Thinking and non-thinking |

Verified demo settings:

| Item | Value |
|---|---|
| Served model name | `qwen3-0.6b` |
| Runtime image | `ghcr.io/llm-d/llm-d-cuda:v0.9.0` |
| vLLM | `0.26.0+precompiled` |
| Checkpoint size reported by vLLM | 1.40 GiB |
| Model GPU memory reported by vLLM | 1.12 GiB |
| Demo maximum model length | 2,048 tokens |
| Maximum concurrent sequences | 1 |
| GPU memory utilization setting | 0.7 |
| Compute profile | GPU |
| GPUs per Pod | 1 |

The model supports a longer published context than this demo uses. The lab intentionally capped the context at 2,048 tokens to reduce startup and memory risk.

Model source: [Qwen3 0.6B model card](https://huggingface.co/Qwen/Qwen3-0.6B).

## Pinned software stack

| Component | Version |
|---|---|
| Minikube | 1.39.0 |
| Kubernetes | 1.35.0 |
| cert-manager | 1.21.2 |
| OpenEverest | 2.0.0-dev.4 |
| provider-kserve chart | 0.4.3 |
| KServe bundle | 0.21 |
| Envoy Gateway for optional rehearsal | 1.9.2 |

When reproducing the lab, use the pinned combination. After an upgrade, revalidate all WSL-specific workarounds.

## Critical WSL runtime configuration

The pinned vLLM image required:

```yaml
template:
  containers:
    - name: main
      env:
        - name: VLLM_USE_V2_MODEL_RUNNER
          value: "0"
        - name: TRITON_LIBCUDA_PATH
          value: "/usr/local/cuda-13.0/compat"
      args:
        - --enforce-eager
        - --max-model-len=2048
        - --max-num-seqs=1
        - --gpu-memory-utilization=0.7
```

Important invariant:

```text
TRITON_LIBCUDA_PATH is a directory, not a library filename.
```

Correct:

```text
/usr/local/cuda-13.0/compat
```

Incorrect:

```text
/usr/local/cuda-13.0/compat/libcuda.so.1
```

The incorrect value generates an invalid GCC linker search argument and prevents vLLM from becoming ready.

## Earlier WSL quick start

### 1. Clone this repository

```bash
git clone https://github.com/atharvamhaske/kserve-demo.git
cd kserve-demo
```

### 2. Follow the full setup

Open:

```text
docs/wsl-gpu-demo-runbook.md
```

Complete each proof gate in order. Do not skip the Docker CUDA test or Kubernetes GPU smoke test.

### 3. Open the OpenEverest UI

In WSL:

```bash
kubectl --context everest-gpu -n everest-system \
  port-forward service/everest 8080:8080
```

On the presenter machine, use an existing SSH key and lab host:

```bash
ssh -N -i "$HOME/.ssh/YOUR_KEY_FILE" \
  -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:8080:127.0.0.1:8080 \
  YOUR_WINDOWS_USER@YOUR_LAB_HOST
```

Open:

```text
http://localhost:8080
```

Never commit the real host, username, key, password, kubeconfig, or API key.

### 4. Create the model in the UI

Use:

| Field | Value |
|---|---|
| Namespace | `default` |
| Name | `qwen-demo` |
| Provider | `provider-kserve` |
| Topology | `llm` |
| Model | Qwen3 0.6B |
| Model URI | `hf://Qwen/Qwen3-0.6B` |
| Served model name | `qwen3-0.6b` |
| Compute profile | GPU |
| GPUs per Pod | 1 |
| CPU | 2 |
| Memory | 6 GiB |
| Replicas | 1 |
| External access | ClusterIP |

Paste the WSL runtime configuration from the previous section into Advanced configuration.

### 5. Wait for real readiness

```bash
kubectl --context everest-gpu -n default get instance,pod -w
```

Require both:

```text
Instance: Ready
Pod: 1/1 Running
```

Controller status alone is not enough.

### 6. Forward the model Service

```bash
kubectl --context everest-gpu -n default \
  port-forward service/qwen-demo-kserve-workload-svc 8000:8000
```

### 7. List models

From a second WSL terminal:

```bash
curl --fail-with-body http://127.0.0.1:8000/v1/models
```

### 8. Run a chat completion

If the terminal copy tool breaks multiline commands, keep this command on one shell line:

```bash
curl --fail-with-body http://127.0.0.1:8000/v1/chat/completions -H 'Content-Type: application/json' -d '{"model":"qwen3-0.6b","messages":[{"role":"user","content":"Explain how this request reaches the GPU in three short steps. /no_think"}],"chat_template_kwargs":{"enable_thinking":false},"max_tokens":150,"temperature":0.7}'
```

### 9. Prove GPU use

```bash
kubectl --context everest-gpu -n default \
  exec deployment/qwen-demo-kserve -c main -- nvidia-smi
```

## Common gotchas

### Repeating `kubectl rollout status` does not retry a failed rollout

`rollout status` observes the current Deployment revision. It does not restart the Pod, reset the progress deadline, or apply a configuration patch.

Fix the source `Instance`, confirm that the generated Pod template changed, then watch the new Pod.

### `Running 0/1` is not ready

The process exists, but the readiness probe has not passed. Read the main-container logs before calling the deployment successful.

### A model can load into VRAM and still fail

The lab loaded Qwen3 into GPU memory before Triton failed to link `libcuda.so.1`. Require a successful HTTP request, not only model-loading logs.

### The old Pod can hold the only GPU

A replacement Pod can report `Insufficient nvidia.com/gpu` until the old Pod terminates. Read events in time order.

### Replacement Pods redownload the model

The observed model storage used `EmptyDir`. Runtime images remained cached on the node, but model files did not survive Pod replacement.

### Shell line breaks change commands

A newline immediately after `-d`, `-o`, an image name, or a backslash can turn one command into two broken commands. Use the exact command blocks and keep short commands on one line.

### Placeholders are not literal shell arguments

Text such as `YOUR_LAB_HOST` must be replaced. Shell text enclosed in angle brackets can be interpreted as input redirection.

See [lab findings and troubleshooting](docs/wsl-gpu-lab-findings.md) for the full failure history.

## Envoy AI Gateway

The verified request used the direct model Service. The optional gateway path is documented separately:

- [Local Envoy AI Gateway rehearsal](docs/envoy-ai-gateway-rehearsal.md)
- [Workshop gateway questions](docs/wsl-gpu-workshop-faq.md#envoy-ai-gateway-routing-authentication-quotas-and-tls)

Do not claim the following until they are exercised:

- Gateway routing on this WSL cluster.
- API-key 401 and model-authorization 403 behavior.
- TLS and certificate issuance.
- Public ingress.
- Token quota enforcement.

Quota enforcement requires Redis or Valkey. Local plain HTTP requires `allowInsecureHTTP=true` and must remain limited to localhost rehearsal traffic.

## Cluster choice

| Cluster | Recommended use |
|---|---|
| Minikube | This WSL GPU workshop and live demonstration |
| kind | CPU controller tests and CI; GPU passthrough is not a first-class kind feature |
| kubeadm | Production-like GPU testing on separate native Linux infrastructure |

provider-kserve uses Kubernetes APIs and is distribution agnostic. GPU runtime integration and LoadBalancer behavior are not distribution agnostic.

## Demo claim boundary

The pinned OpenEverest and provider-kserve stack served one Qwen3 0.6B chat completion through a direct Kubernetes Service on one WSL-backed NVIDIA GPU.

Do not convert that result into claims about performance, reliability, high availability, public ingress, TLS, quotas, multi-node serving, or production readiness.

## Upstream projects

- [OpenEverest](https://github.com/openeverest/openeverest).
- [provider-kserve](https://github.com/openeverest/provider-kserve).
- [KServe](https://github.com/kserve/kserve).
- [vLLM](https://github.com/vllm-project/vllm).
- [Envoy AI Gateway](https://github.com/envoyproxy/ai-gateway).
- [Minikube NVIDIA GPU guide](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/).
- [NVIDIA CUDA on WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html).

## Security

This repository contains no real host addresses, usernames, passwords, private keys, API keys, or kubeconfig data. Keep it that way.
