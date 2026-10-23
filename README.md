# OpenEverest KServe GPU demo

A reproducible workshop lab for serving Qwen3 0.6B on an NVIDIA GPU with OpenEverest, provider-kserve, KServe, vLLM, Minikube, Docker, and WSL 2.

The direct model-serving path was verified end to end. The optional Envoy AI Gateway path is documented as a separate rehearsal and remains unverified in this lab until its success gates pass.

## Verified result

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

## Repository map

| Document | Purpose |
|---|---|
| [WSL GPU demo runbook](docs/wsl-gpu-demo-runbook.md) | Full copy-paste setup, deployment, UI, inference, and recording procedure |
| [Lab findings and troubleshooting](docs/wsl-gpu-lab-findings.md) | Environment, every observed failure, root causes, fixes, and final evidence |
| [Workshop FAQ](docs/wsl-gpu-workshop-faq.md) | Architecture, 58 audience questions, skeptical questions, demo boundaries, and fallback answers |
| [Local Envoy AI Gateway rehearsal](docs/envoy-ai-gateway-rehearsal.md) | Unverified local routing, authentication, 401, and 403 exercise |

Start with the [WSL GPU demo runbook](docs/wsl-gpu-demo-runbook.md). Use the findings when a step fails. Read the FAQ before presenting.

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

The lab did not establish a universal minimum hardware specification. Revalidate capacity when changing the model, context length, concurrency, runtime image, or Kubernetes topology.

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

Use the pinned combination when reproducing the lab. Revalidate all WSL-specific workarounds after an upgrade.

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

## Quick start

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

Keep this command on one shell line if the terminal copy tool breaks multiline commands:

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

A replacement Pod may report `Insufficient nvidia.com/gpu` until the old Pod terminates. Read events in time order.

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

A defensible statement:

> The pinned OpenEverest and provider-kserve stack served one Qwen3 0.6B chat completion through a direct Kubernetes Service on one WSL-backed NVIDIA GPU.

Do not convert that result into claims about performance, reliability, high availability, public ingress, TLS, quotas, multi-node serving, or production readiness.

## Upstream projects

- [OpenEverest](https://github.com/openeverest/openeverest)
- [provider-kserve](https://github.com/openeverest/provider-kserve)
- [KServe](https://github.com/kserve/kserve)
- [vLLM](https://github.com/vllm-project/vllm)
- [Envoy AI Gateway](https://github.com/envoyproxy/ai-gateway)
- [Minikube NVIDIA GPU guide](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/)
- [NVIDIA CUDA on WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html)

## Security

This repository contains no real host addresses, usernames, passwords, private keys, API keys, or kubeconfig data. Keep it that way.
