# WSL GPU demo runbook

Use this runbook to deploy a small GPU-backed LLM through the OpenEverest UI on a remote Windows workstation, then call it from a Mac through SSH tunnels.

This is a local demonstration setup. It does not configure public ingress, TLS, Envoy AI Gateway, token quotas, or scale-to-zero.

The matching lab findings are in [wsl-gpu-lab-findings.md](wsl-gpu-lab-findings.md).
Workshop questions, cluster comparisons, and the unverified local Envoy AI Gateway rehearsal are in [wsl-gpu-workshop-faq.md](wsl-gpu-workshop-faq.md).
The optional local gateway exercise is in [envoy-ai-gateway-rehearsal.md](envoy-ai-gateway-rehearsal.md).

## Architecture

```text
Mac browser and curl
  -> SSH local forwards
  -> Windows OpenSSH
  -> WSL localhost forwards
  -> kubectl port-forward
  -> Kubernetes Service
  -> KServe-managed vLLM Pod
  -> NVIDIA GPU
```

The OpenEverest provider and KServe controllers reconcile resources. They do not process each inference request.

## Pinned lab versions

| Component | Version |
|---|---|
| Ubuntu on WSL 2 | 26.04 LTS, amd64 |
| Minikube | 1.39.0 |
| Kubernetes | 1.35.0 |
| cert-manager | 1.21.2 |
| OpenEverest | 2.0.0-dev.4 |
| provider-kserve chart | 0.4.3 |
| KServe bundle | 0.21 |
| GPU runtime image | `ghcr.io/llm-d/llm-d-cuda:v0.9.0` |
| vLLM in that image | 0.26.0 |
| Demo model | `Qwen/Qwen3-0.6B` |

Use these together when reproducing the lab. Revalidate the workarounds before changing versions.

## 1. Set shell variables

Run these commands inside WSL unless a step says Mac.

```bash
export PROFILE=everest-gpu
export INSTANCE=qwen-demo
export INSTANCE_NS=default
export PROVIDER_NS=provider-kserve
export EVEREST_NS=everest-system
export MODEL_URI=hf://Qwen/Qwen3-0.6B
export MODEL_NAME=qwen3-0.6b
```

Use `default` or a dedicated model namespace. Do not deploy model Instances into `cert-manager`.

## 2. Verify WSL and the GPU

```bash
uname -m
ps -p 1 -o comm=
nvidia-smi
free -h
df -h /
```

Required results:

- Architecture is `x86_64`.
- PID 1 is `systemd`.
- `nvidia-smi` lists the GPU.
- The machine has enough RAM and disk for Kubernetes, images, and model files.

Do not install a Linux NVIDIA display driver in WSL. WSL uses the Windows NVIDIA driver.

## 3. Install Docker Engine in WSL

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF
```

```bash
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
```

Use a separate Docker CLI configuration if the SSH session inherits a Windows credential helper:

```bash
mkdir -p "$HOME/.docker-wsl"
export DOCKER_CONFIG="$HOME/.docker-wsl"
export DOCKER_HOST=unix:///var/run/docker.sock
unset DOCKER_CONTEXT
```

Verify both the engine and a basic container:

```bash
docker version
docker run --rm hello-world
```

## 4. Install NVIDIA Container Toolkit

```bash
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
  sudo gpg --dearmor --yes \
  -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
```

Use the deb822 source format. It avoids malformed repository entries caused by a line break in a one-line `.list` entry.

```bash
sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.sources >/dev/null <<'EOF'
Types: deb
URIs: https://nvidia.github.io/libnvidia-container/stable/deb/amd64/
Suites: /
Architectures: amd64
Signed-By: /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
EOF
```

```bash
sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

Prove GPU computation inside Docker:

```bash
docker run --rm --gpus all \
  nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
```

Stop if the output does not contain `Test PASSED`.

## 5. Create the GPU Minikube cluster

Install Minikube when it is not present:

```bash
curl -fLo minikube-linux-amd64 \
  https://github.com/kubernetes/minikube/releases/download/v1.39.0/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

Create the cluster as the normal user:

```bash
minikube start -p "$PROFILE" \
  --driver=docker \
  --container-runtime=docker \
  --gpus=all \
  --kubernetes-version=v1.35.0 \
  --cpus=4 \
  --memory=12288
```

```bash
kubectl config use-context "$PROFILE"
kubectl get nodes
kubectl get node "$PROFILE" \
  -o jsonpath='{.status.allocatable.nvidia\.com/gpu}{"\n"}'
```

The final command must print a positive GPU count.

Run a Kubernetes GPU smoke test:

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: gpu-smoke
spec:
  restartPolicy: Never
  containers:
    - name: cuda
      image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
      resources:
        limits:
          nvidia.com/gpu: 1
EOF
```

```bash
kubectl wait --for=jsonpath='{.status.phase}'=Succeeded \
  pod/gpu-smoke --timeout=5m
kubectl logs gpu-smoke
kubectl delete pod gpu-smoke
```

Stop unless the pod prints `Test PASSED`.

## 6. Install the platform

Install Helm 3 if needed, then add the repositories:

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo add openeverest https://openeverest.github.io/helm-charts/
helm repo update
```

Install cert-manager:

```bash
helm upgrade --install cert-manager jetstack/cert-manager \
  --kube-context "$PROFILE" \
  --namespace cert-manager \
  --create-namespace \
  --version v1.21.2 \
  --set crds.enabled=true \
  --wait \
  --timeout 10m
```

Choose an OpenEverest password without putting it in shell history:

```bash
read -rsp 'OpenEverest admin password: ' UI_PASSWORD
printf '\n'
```

```bash
helm upgrade --install everest openeverest/openeverest \
  --kube-context "$PROFILE" \
  --namespace "$EVEREST_NS" \
  --create-namespace \
  --version 2.0.0-dev.4 \
  --set-literal "server.initialAdminPassword=$UI_PASSWORD" \
  --set telemetry=false \
  --set upgrade.preflightChecks=false \
  --set kube-state-metrics.enabled=false \
  --wait \
  --timeout 15m
unset UI_PASSWORD
```

Install the provider:

```bash
helm upgrade --install provider-kserve \
  oci://ghcr.io/openeverest/charts/provider-kserve \
  --kube-context "$PROFILE" \
  --namespace "$PROVIDER_NS" \
  --create-namespace \
  --version 0.4.3 \
  --wait \
  --timeout 15m
```

```bash
kubectl get provider provider-kserve
kubectl -n "$EVEREST_NS" get pods
kubectl -n "$PROVIDER_NS" get pods
```

## 7. Find the WSL CUDA driver directory

The pinned vLLM image runs Triton runtime compilation. Triton needs the directory that contains `libcuda.so.1`.

Pre-pull the runtime image and list matching driver files inside it:

```bash
export RUNTIME_IMAGE=ghcr.io/llm-d/llm-d-cuda:v0.9.0
minikube -p "$PROFILE" ssh -- docker run \
  --rm --user 0 --gpus all \
  --entrypoint /usr/bin/find "$RUNTIME_IMAGE" \
  / -name libcuda.so.1 -print
```

The verified directory for the pinned image in this WSL lab is:

```text
/usr/local/cuda-13.0/compat
```

Confirm that `/usr/local/cuda-13.0/compat/libcuda.so.1` exists before using it. `TRITON_LIBCUDA_PATH` must contain the directory, not the full filename. A full filename produces an invalid linker flag such as `-L/usr/local/cuda-13.0/compat/libcuda.so.1`.

## 8. Open the UI on the Mac

In WSL terminal 1:

```bash
kubectl --context "$PROFILE" -n "$EVEREST_NS" \
  port-forward svc/everest 8080:8080
```

On the Mac, replace the placeholders with the existing SSH key and destination:

```bash
ssh -N -i <ssh-key> \
  -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -L 127.0.0.1:8080:127.0.0.1:8080 \
  <windows-user>@<lab-host>
```

Open `http://localhost:8080` and log in as `admin`.

## 9. Create the GPU model in the UI

Create an Instance with these values:

| Field | Value |
|---|---|
| Namespace | `default` |
| Name | `qwen-demo` |
| Provider | `provider-kserve` |
| Topology | `llm` |
| Model | `Qwen3 0.6B` |
| Served model name | `qwen3-0.6b` |
| Compute profile | GPU |
| GPUs per pod | 1 |
| CPU | 2 |
| Memory | 6 GiB |
| Replicas | 1 |
| Tensor parallel size | 1 |
| Pipeline parallel size | 1 |
| Data parallel size | 1 |
| External access | ClusterIP |

Do not use the `qwen-gpu` preset unchanged. It selects Qwen3 4B.

Set the Advanced inline config below:

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

These settings are specific to the pinned vLLM image on WSL:

- The V1 runner avoids a V2 runner requirement for Unified Virtual Addressing.
- Eager mode avoids Torch Inductor and CUDA Graph compilation.
- `TRITON_LIBCUDA_PATH` lets mandatory Triton kernel warmup link the WSL CUDA driver.

Watch the result:

```bash
kubectl -n "$INSTANCE_NS" get instance,llminferenceservice,pod,svc -w
```

The proof gate is all three results:

- Instance phase is `Ready`.
- Model Pod is `1/1 Running`.
- A real chat request succeeds.

## 10. YAML fallback

Use this only if the UI cannot save Advanced config.

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: qwen-demo
  namespace: default
spec:
  providerRef:
    name: provider-kserve
  topology:
    type: llm
  components:
    llmEngine:
      type: vllm
      replicas: 1
      resources:
        limits:
          cpu: "2"
          memory: 6Gi
      service:
        serviceType: ClusterIP
      parameters:
        modelURI: hf://Qwen/Qwen3-0.6B
        modelName: qwen3-0.6b
        computeProfile: gpu
        gpuCount: 1
        tensorParallelSize: 1
        config: |
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

## 11. Call the model from the Mac

In WSL terminal 2:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  port-forward svc/${INSTANCE}-kserve-workload-svc 8000:8000
```

On the Mac, start a second SSH tunnel:

```bash
ssh -N -i <ssh-key> \
  -o IdentitiesOnly=yes \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -L 127.0.0.1:18000:127.0.0.1:8000 \
  <windows-user>@<lab-host>
```

List models:

```bash
curl --fail-with-body http://localhost:18000/v1/models
```

Run a normal request:

```bash
curl --fail-with-body http://localhost:18000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-0.6b",
    "messages": [{
      "role": "user",
      "content": "Explain what happens when an LLM request enters Kubernetes in three short steps. /no_think"
    }],
    "chat_template_kwargs": {"enable_thinking": false},
    "max_tokens": 150,
    "temperature": 0.7
  }'
```

Run a streaming request:

```bash
curl -N --fail-with-body http://localhost:18000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-0.6b",
    "messages": [{
      "role": "user",
      "content": "Trace an LLM request through Kubernetes in three short steps. /no_think"
    }],
    "chat_template_kwargs": {"enable_thinking": false},
    "max_tokens": 150,
    "temperature": 0.7,
    "stream": true
  }'
```

## 12. Record the demo

Use an already-ready model. Do not make a cold image pull part of a five-minute stage demo.

Record these shots:

1. OpenEverest UI showing the ready `qwen-demo` Instance.
2. `kubectl get instance,llminferenceservice,deployment,pod,svc` in `default`.
3. `nvidia-smi` from the model container.
4. A streaming chat request from the Mac.
5. An unknown model request returning an application error while the Pod stays healthy.

GPU proof:

```bash
kubectl -n "$INSTANCE_NS" exec deployment/${INSTANCE}-kserve \
  -c main -- nvidia-smi
```

Unknown-model request:

```bash
curl --fail-with-body http://localhost:18000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "does-not-exist",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 16
  }'
```

The request path in this demo is:

```text
Mac curl
  -> SSH tunnel
  -> kubectl port-forward
  -> Kubernetes Service
  -> ready vLLM Pod
  -> NVIDIA GPU
  -> streamed response
```

Do not describe the SSH tunnel or port-forward as ingress or an AI Gateway.

## 13. Stop and resume

Stop only the demo Instance:

```bash
kubectl -n "$INSTANCE_NS" delete instance "$INSTANCE"
```

Stop the local cluster without deleting cached images:

```bash
minikube stop -p "$PROFILE"
```

Resume later:

```bash
minikube start -p "$PROFILE"
kubectl config use-context "$PROFILE"
```

Delete the cluster only when its cached runtime images and resources are no longer needed:

```bash
minikube delete -p "$PROFILE"
```
