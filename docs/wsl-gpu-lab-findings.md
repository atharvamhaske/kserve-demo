# WSL GPU lab context and findings

This document records the remote WSL GPU lab used to prepare an OpenEverest model-serving demo. It separates observed evidence from proposed fixes so the next session does not repeat failed work.

The repeatable procedure is in [wsl-gpu-demo-runbook.md](wsl-gpu-demo-runbook.md).

## Session status

Dates observed: 2026-10-22 through 2026-10-23.

The lab proved GPU access from WSL, Docker, and a Kubernetes Pod. KServe created the expected GPU workload, vLLM loaded Qwen3 0.6B into GPU memory, and the model reached `1/1 Running`.

The final verification succeeded:

- The Deployment rolled out successfully.
- The OpenEverest Instance reported ready.
- `/v1/models` listed `qwen3-0.6b`.
- `/v1/chat/completions` returned a completed response from `qwen3-0.6b`.
- The response reported `finish_reason: stop` and 42 completion tokens.
- `nvidia-smi` in the model container showed GPU use.

The working WSL-specific settings were `VLLM_USE_V2_MODEL_RUNNER=0`, `TRITON_LIBCUDA_PATH=/usr/local/cuda-13.0/compat`, and the vLLM arguments `--enforce-eager`, `--max-model-len=2048`, `--max-num-seqs=1`, and `--gpu-memory-utilization=0.7`.

## Environment

| Item | Observed value |
|---|---|
| Remote host | College Windows workstation accessed through SSH |
| Linux environment | Ubuntu 26.04 LTS on WSL 2, amd64 |
| Init system | systemd |
| GPU | NVIDIA RTX 4000 Ada Generation |
| GPU memory | 20,475 MiB |
| Windows NVIDIA driver | 596.86 |
| WSL NVIDIA-SMI | 595.91.02 |
| Reported CUDA capability | CUDA 13.2 |
| WSL memory | 15 GiB total, about 14 GiB initially available |
| WSL disk | About 861 GiB initially available |
| Local Kubernetes | Minikube profile `everest-gpu` with Docker driver |
| Kubernetes | 1.35.0 |
| Minikube resources | 4 CPUs and 12,288 MiB memory |
| OpenEverest | 2.0.0-dev.4 |
| provider-kserve chart | 0.4.3 |
| KServe bundle | 0.21 |
| GPU runtime | `ghcr.io/llm-d/llm-d-cuda:v0.9.0` |
| vLLM | 0.26.0 |
| First model | `Qwen/Qwen3-4B` |
| Reduced model | `Qwen/Qwen3-0.6B` |

SSH host details, passwords, private keys, and kubeconfig credentials are intentionally excluded.

## Lab architecture

```text
Mac
  browser and curl
  SSH client
    -> Windows OpenSSH
       -> WSL 2
          Docker Engine
          Minikube node container
            Kubernetes control plane
            OpenEverest
            provider-kserve
            KServe controllers
            vLLM model Pod
              NVIDIA GPU
```

Two different flows matter.

### Reconciliation flow

```text
OpenEverest UI
  -> Instance
  -> provider-kserve
  -> LLMInferenceService
  -> KServe controller
  -> Deployment, Pod, and Service
  -> Instance status
```

### Inference flow in this local lab

```text
Mac curl
  -> SSH local forward
  -> WSL kubectl port-forward
  -> Kubernetes Service
  -> ready vLLM Pod
  -> NVIDIA GPU
  -> response stream
```

The provider and KServe controllers are not on the per-request data path.

## What worked

### WSL GPU access

`nvidia-smi` inside WSL listed the RTX 4000 Ada and approximately 20 GiB of GPU memory.

### Docker Engine in WSL

Docker Engine ran directly inside WSL under systemd. This avoided a dependency on physical access to Docker Desktop settings.

A separate CLI configuration was needed because the inherited Docker configuration referenced a Windows credential helper that failed over SSH:

```text
A specified logon session does not exist. It may already have been terminated.
```

The working shell settings were:

```bash
export DOCKER_CONFIG="$HOME/.docker-wsl"
export DOCKER_HOST=unix:///var/run/docker.sock
unset DOCKER_CONTEXT
```

### Docker GPU computation

The NVIDIA vector-add sample completed successfully through Docker. This proved that the WSL Docker daemon could launch a CUDA workload.

### Kubernetes GPU allocation

Minikube was created with:

```bash
minikube start -p everest-gpu \
  --driver=docker \
  --container-runtime=docker \
  --gpus=all \
  --kubernetes-version=v1.35.0 \
  --cpus=4 \
  --memory=12288
```

A Kubernetes test Pod requested `nvidia.com/gpu: 1`, completed with exit code 0, and ran the CUDA vector-add sample. This proved scheduler allocation and GPU execution inside Kubernetes.

### Platform installation

cert-manager, OpenEverest, provider-kserve, the KServe controllers, and required CRDs installed. The OpenEverest UI was reached from the Mac through WSL and SSH port-forwards.

### Provider reconciliation

The UI-created Instance produced:

- An `LLMInferenceService`.
- Deployment `<instance>-kserve`.
- Service `<instance>-kserve-workload-svc` on port 8000.
- A GPU-backed model Pod.

The provider reported `Provisioning` while the Deployment had no ready Pod. That was correct even when KServe briefly reported the `LLMInferenceService` as ready.

### Model download and GPU loading

Qwen3 0.6B downloaded in about 115 seconds. vLLM then reported:

```text
Checkpoint size: 1.40 GiB
Model loading took 1.12 GiB memory
Available KV cache memory: 12.77 GiB
GPU KV cache size: 119,504 tokens
```

This proved that the model weights reached GPU memory. It did not prove that the API server became ready.

## Issues and findings

### Stale Kubernetes context

An existing `kind-llm-lab` kubeconfig context pointed at a stopped API server on a random localhost port. `kubectl` returned connection refused.

Decision: create and use a separate Minikube profile named `everest-gpu`. Do not mutate or delete unrelated kubeconfig contexts.

### Docker CLI unavailable in WSL

The initial WSL session had no `docker` command. Docker Desktop integration was not suitable for a remote-only workflow.

Decision: install Docker Engine inside WSL and manage it through systemd.

### NVIDIA APT source malformed

A copied one-line NVIDIA `.list` entry split after the `signed-by` clause. APT rejected it as a malformed URI.

Decision: use a deb822 `.sources` file with one field per line. This format survives terminal wrapping and copy operations.

### Docker credential helper failed over SSH

The Docker CLI tried to use a Windows credential helper and failed before pulling a public image.

Decision: use an isolated `DOCKER_CONFIG` for the WSL Docker Engine. Do not delete the user’s existing Docker configuration.

### Runtime image pull was large and unstable

The pinned `llm-d-cuda` image contained a layer with an extracted size near 5.987 GB. Downloads repeatedly ended with `unexpected EOF`, then resumed with a smaller remaining-byte total.

Evidence showed forward progress across retries. The Minikube node had about 837 GB free and only 1 percent inode use, so disk capacity was not the blocker.

Decision: allow active retries to continue. Do not restart Docker or recreate the Pod while bytes are increasing.

### Model files were ephemeral

The KServe Pod used `EmptyDir` for `/mnt/models` and the model cache. Replacing the Pod discarded downloaded weights. The runtime image remained cached on the Minikube node, but each replacement Pod downloaded the model again.

Implication: use a small model during compatibility work. Add persistent model caching before repeated production-like rollouts.

### Single-GPU rollout reported temporary scheduling failure

During a model Pod replacement, the new Pod briefly reported:

```text
Insufficient nvidia.com/gpu
```

The old Pod still held the only GPU. After it terminated, the new Pod scheduled successfully one second later.

Decision: interpret events in time order. A historical scheduling warning does not prove the current Pod is unschedulable.

### Qwen3 4B was selected by the preset

The `qwen-gpu` preset selected Qwen3 4B, not the intended smallest GPU model. Its model download was about 4.9 GB in the observed Pod.

Decision: select Qwen3 0.6B explicitly for the demo. It is still GPU-backed and shortens every Pod replacement.

### vLLM V2 runner failed on WSL UVA

The first vLLM startup failed at:

```text
GPUModelRunnerV2
  -> UvaBuffer
  -> RuntimeError: UVA is not available
```

vLLM 0.26.0 detects WSL pinned-memory constraints. Its V2 model runner requires UVA-backed buffers and does not fall back in this path.

Workaround applied:

```yaml
- name: VLLM_USE_V2_MODEL_RUNNER
  value: "0"
```

Evidence: the next startup logged `Initializing a V1 LLM engine` and passed the UVA failure point.

### Torch compilation failed under the V1 runner

The next startup reached Torch Inductor and failed while GCC built Triton CUDA utilities.

Workaround applied:

```yaml
args:
  - --enforce-eager
```

Evidence: vLLM logged that eager mode disabled Torch compilation and CUDA Graphs. This avoided the first Inductor path but did not avoid mandatory Triton kernel warmup.

Tradeoff: eager mode reduces performance. It is acceptable for a small demonstration but should not become a silent production default.

### Triton kernel warmup could not link libcuda

After model loading and KV-cache sizing, mandatory block-table kernel warmup failed with:

```text
/usr/bin/ld: cannot find -l:libcuda.so.1
collect2: error: ld returned 1 exit status
```

CUDA execution already worked, so the issue was not general GPU visibility. The first path override set `TRITON_LIBCUDA_PATH` to the full filename:

```text
/usr/local/cuda-13.0/compat/libcuda.so.1
```

Triton used the value as a linker search directory and generated:

```text
-L/usr/local/cuda-13.0/compat/libcuda.so.1
```

The `-L` option requires a directory. The verified fix was:

```yaml
- name: TRITON_LIBCUDA_PATH
  value: /usr/local/cuda-13.0/compat
```

The corrected rollout passed Triton kernel warmup, reached `1/1 Running`, and served a chat completion. The invariant is that `TRITON_LIBCUDA_PATH` names the directory containing `libcuda.so.1`, not the library file itself.

### Deployment exceeded its progress deadline

During failed revisions, `kubectl rollout status` reported:

```text
deployment "inst-izu-kserve" exceeded its progress deadline
```

This was a symptom of the crash-looping model container, not a separate root cause. Repeating `kubectl rollout status` only observed the same failed Deployment revision. It did not restart the Pod, reset the deadline, or apply the Instance patch.

After the corrected Instance patch changed the generated Pod template, Kubernetes created a new ReplicaSet and Pod. The new Pod completed model initialization, became ready, and cleared the rollout failure through a successful new revision.

## Final verified state

The lab finished with:

- Minikube profile `everest-gpu`.
- Instance `inst-izu` in namespace `cert-manager`.
- Deployment `inst-izu-kserve` successfully rolled out.
- Model Pod `1/1 Running`.
- Service `inst-izu-kserve-workload-svc` serving port 8000.
- Runtime image `ghcr.io/llm-d/llm-d-cuda:v0.9.0`.
- Model `Qwen/Qwen3-0.6B` served as `qwen3-0.6b`.
- A successful non-streaming chat completion through `kubectl port-forward`.
- GPU use confirmed from the model container.

For a clean demonstration, create the final Instance in `default` or a dedicated model namespace. The working `cert-manager` deployment should remain intact until that clean Instance passes the same readiness and inference gates.

## Demo and talk implications

The lab produced several useful examples:

- A small model can still require a multi-gigabyte serving-runtime image.
- `PodInitializing` can mean image or model download, not model inference.
- `Running 0/1` means a process exists but readiness has not passed.
- Controller status and workload readiness can disagree temporarily.
- A scheduler warning can resolve without intervention.
- A model can load into VRAM and still fail before its HTTP server becomes ready.
- A healthy Kubernetes Pod does not guarantee that a requested API path or model name is valid.
- Port-forwarding is a debug access path, not ingress or gateway validation.

For a five-minute recording, use a warm, already-ready model. Record a backup video. Do not depend on a cold image pull, remote SSH reliability, or a live model rollout.

## Sources

- [provider-kserve README](https://github.com/openeverest/provider-kserve/blob/main/README.md)
- [WSL GPU demo runbook](wsl-gpu-demo-runbook.md)
- [NVIDIA CUDA on WSL guide](https://docs.nvidia.com/cuda/wsl-user-guide/index.html)
- [NVIDIA Container Toolkit installation](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
- [Minikube NVIDIA GPU guide](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/)
- [vLLM WSL UVA issue](https://github.com/vllm-project/vllm/issues/50239)
- [vLLM 0.26.0 environment variables](https://docs.vllm.ai/en/v0.26.0/configuration/env_vars/)
- [llm-d v0.9.0 CUDA image source](https://github.com/llm-d/llm-d/blob/v0.9.0/docker/Dockerfile.cuda)
