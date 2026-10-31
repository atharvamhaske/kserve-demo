# Ubuntu GPU workshop prerequisites

Use this checklist before the Open Source Hub workshop. Complete it before the recorded or live demonstration.

The workshop starts with an installed NVIDIA driver, Docker, and command-line tools.

The runbook creates the Kubernetes cluster and all application resources.

## Supported environment

Use a disposable native Ubuntu GPU machine with the `x86_64` architecture.

Do not use these environments for this runbook:

- WSL 2.
- macOS.
- ARM64.
- A shared production Kubernetes cluster.
- A machine with unrelated Kubernetes workloads.

Use the separate WSL runbook for a Windows workstation.

## Recommended machine size

The recommended size gives enough space for container images, the model cache, and workshop retries.

| Resource | Recommended attendee value | Verified workshop host |
|---|---:|---:|
| GPU | One NVIDIA GPU with at least 24 GiB VRAM | RTX PRO 6000 Blackwell, 97,887 MiB |
| Host CPU | 8 or more vCPUs | 28 vCPUs |
| Host memory | 32 GiB or more | 157 GiB |
| Root disk | 100 GiB or more | 96 GiB |
| Free disk before setup | 60 GiB or more | 51 GiB after the first completed rehearsal |
| Architecture | `x86_64` | `x86_64` |
| Operating system | Ubuntu 24.04 or newer | Ubuntu, Linux 6.8 |

The Qwen3 0.6B model is small. Larger models require more GPU memory, host memory, disk space, and download time.

The tested Minikube node uses 4 CPUs and 12 GiB memory. Do not allocate all host memory to Minikube.

## Verified software versions

The rehearsal used the versions in `ubuntu-gpu-workshop.env.example`.

| Tool | Verified version |
|---|---|
| NVIDIA driver | 595.58.03 |
| Docker | 29.5.1 |
| Minikube | 1.39.0 |
| Kubernetes client | 1.35.10 |
| Kubernetes cluster | 1.35.0 |
| Helm | 4.3.1 |
| cert-manager | 1.21.2 |
| OpenEverest | 2.0.0-dev.4 |
| KServe | 0.21.0 |
| vLLM runtime image | `ghcr.io/llm-d/llm-d-cuda:v0.9.0` |

Other versions can work. They are outside the verified workshop combination and require a new rehearsal.

## Required host tools

Install these tools before the workshop:

- NVIDIA Linux driver.
- NVIDIA Container Toolkit.
- Docker Engine.
- Git.
- Make.
- Curl.
- Minikube.
- kubectl.
- Helm.

The local presentation computer also needs:

- An SSH client.
- Curl.
- `jq` for readable JSON.
- Screen-recording software.

## Network access

The GPU machine needs outbound HTTPS access to these services:

- GitHub and GitHub Container Registry.
- Docker Hub.
- NVIDIA NGC.
- Quay.
- Hugging Face.
- Jetstack Helm repository.
- OpenEverest Helm repository.

Allow at least 30 minutes for first-time image pulls. A slow connection can require 90 minutes or more.

The public Qwen3 0.6B model does not require a Hugging Face token.

## Security boundary

Use a disposable, single-user machine.

The LocalModel node agent manages host-backed model directories. Its current KServe v0.21.0 chart also has broad cluster permissions.

The Minikube NVIDIA procedure temporarily sets this kernel value:

```text
net.core.bpf_jit_harden=0
```

This setting reduces kernel hardening. The runbook records the original value and restores it during cleanup.

Do not run the procedure on a production host.

## Host preflight

Run these commands on the GPU machine:

```bash
. /etc/os-release
printf 'OS=%s %s\n' "$ID" "$VERSION_ID"
uname -m
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
git --version
make --version
curl --version
```

When all checks pass, continue:

- The operating system is Ubuntu.
- The architecture is `x86_64`.
- `nvidia-smi` lists one NVIDIA GPU.
- Docker can run `nvidia-smi` inside a container.
- At least 60 GiB disk space is free.
- Minikube, kubectl, Helm, Git, Make, and Curl are available.

## Prepare the workshop files

If the workshop repository is absent, get it:

```bash
DEMO_REPO_DIR=${DEMO_REPO_DIR:-"$HOME/src/kserve-demo"}
if [ ! -d "$DEMO_REPO_DIR/.git" ]; then
  mkdir -p "$(dirname "$DEMO_REPO_DIR")"
  git clone https://github.com/atharvamhaske/kserve-demo.git "$DEMO_REPO_DIR"
fi
```

Create one private configuration file:

```bash
WORKSHOP_CONFIG=${WORKSHOP_CONFIG:-"$HOME/ubuntu-gpu-workshop.env"}
if [ ! -e "$WORKSHOP_CONFIG" ]; then
  cp "$DEMO_REPO_DIR/docs/ubuntu-gpu-workshop.env.example" "$WORKSHOP_CONFIG"
fi
chmod 600 "$WORKSHOP_CONFIG"
${EDITOR:-nano} "$WORKSHOP_CONFIG"
set -a
. "$WORKSHOP_CONFIG"
set +a
```

The template contains tested workshop inputs. It contains no password, token, private key, public IP address, or Kubernetes Secret.

## Clean starting state

The runbook expects no configured Minikube profile and no previous provider source directory.

Check the state:

```bash
minikube status -p "$PROFILE" || true
test ! -e "$REPO_DIR"
```

If the profile belongs to an earlier disposable lab, delete it:

```bash
minikube delete -p "$PROFILE"
```

If the source directory belongs to an earlier workshop, delete it:

```bash
rm -rf "$REPO_DIR"
```

Do not delete an unrelated source checkout.

## Presenter preparation

Read these documents before the rehearsal:

- [Ubuntu GPU LocalModel theory](ubuntu-gpu-localmodel-theory.md).
- [Ubuntu GPU workshop decisions](ubuntu-gpu-workshop-decisions.md).

Complete one full rehearsal before recording.

Save these fallback materials:

- The successful terminal recording.
- The final `Instance` YAML.
- The final cache YAML.
- The model-server logs.
- The vLLM metrics output.
- One screenshot of the GPU status.
- One successful chat response.

Use the recorded demo as the primary fallback. Keep the live cluster as an optional second demonstration.

## Next step

Continue with [Ubuntu GPU LocalModel cache runbook](ubuntu-gpu-localmodel-runbook.md).

Final approval rests with the writer.
