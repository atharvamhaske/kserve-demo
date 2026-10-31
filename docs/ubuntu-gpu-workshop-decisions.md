# Ubuntu GPU workshop decisions

This document records the workshop decisions and their reasons. It prevents hidden assumptions and keeps each rehearsal consistent.

The decisions apply to the Ubuntu GPU LocalModel workshop. They do not define production requirements.

## Environment decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D01 | Use one disposable native Ubuntu `x86_64` machine. | The lab changes a kernel setting and creates host-backed storage. | Do not use a production or shared host. |
| D02 | Use one full NVIDIA GPU. | The workshop does not configure MIG or GPU time sharing. | A second GPU Pod will remain pending. |
| D03 | Allocate 4 CPUs and 12 GiB memory to Minikube. | This allocation ran the verified control plane and Qwen3 0.6B workload. | The host needs additional memory for Docker and image builds. |
| D04 | Use the Docker driver and Docker container runtime. | The NVIDIA Minikube procedure was verified with this combination. | Other drivers require a separate rehearsal. |
| D05 | Use Kubernetes 1.35.0. | KServe 0.21.0 and the GPU device plug-in worked with this version. | Version changes require a new rehearsal. |
| D06 | Set `net.core.bpf_jit_harden=0` only during the lab. | Minikube requires this value for the verified NVIDIA path. | Record the original value and restore it during cleanup. |

## Configuration decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D07 | Store workshop inputs in one configuration file. | Repeated `export` commands hide changes and cause terminal drift. | Copy `ubuntu-gpu-workshop.env.example` and edit one local file. |
| D08 | Do not store secrets in the configuration file. | A copied file can enter shell history or Git. | Prompt for the OpenEverest password. Use Kubernetes Secrets for credentials. |
| D09 | Derive runtime values from live resources. | Pod names, image tags, cache paths, and generated objects change. | The runbook queries Kubernetes and Git for these values. |
| D10 | Pin all tested platform versions. | Mutable versions make attendee results different. | Update the decision record after each version change. |
| D11 | Pin the provider to commit `9185bfd35626cef5753586a1499c0b4e0f9adbf5`. | This commit produced the verified GPU deployment. | Do not build the moving branch tip during the workshop. |

## Model decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D12 | Use `Qwen/Qwen3-0.6B`. | The public model is small and needs no Hugging Face token. | Attendees can complete the lab without gated-model access. |
| D13 | Serve the model as `qwen3-0.6b`. | A short stable name makes API requests readable. | The request model must match this configured name. |
| D14 | Set the maximum model length to 2,048 tokens. | The workshop tests cache behavior, not maximum context capacity. | Startup and memory use remain predictable. |
| D15 | Set one maximum sequence. | The workshop uses one presenter request at a time. | This setting does not represent production concurrency. |
| D16 | Set GPU memory utilization to 0.2. | The verified 98 GiB GPU had enough memory at this setting. | Smaller GPUs require a separate capacity check. |
| D17 | Pre-pull the runtime image. | A replacement test must measure cache reuse, not image transfer. | The first image pull remains visible as a separate workshop step. |

## LocalModel decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D18 | Use LocalModel for the main workshop. | LocalModel demonstrates Jobs, local storage, cache status, and Pod reuse. | ModelCar remains a separate extension. |
| D19 | Use a 20 GiB local PV and a 3 GiB model reservation. | Qwen3 0.6B uses about 1.4 GiB of checkpoint data. | `modelSize` reserves capacity but does not limit bytes. |
| D20 | Read the cache path from the live DaemonSet. | KServe chart values and rendered paths can differ. | The node group and node agent use one observed path. |
| D21 | Run the node agent with UID, GID, and fsGroup 1000. | KServe 0.21.0 does not render its advertised agent user. | Repeat the patch after each Helm upgrade. |
| D22 | Prepare cache directories as `root:1000` with mode `2775`. | The setgid bit gives new directories group 1000. | The download Job and node agent can create and remove entries. |
| D23 | Add fsGroup 1000 to every serving Pod. | The llm-d image uses UID 2000 and cannot read mode `2770` cache directories alone. | The serving process receives supplementary group 1000. |
| D24 | Wait for cache `1/1` before readiness checks. | The current provider creates the workload before the cache is ready. | A transient serving Pod does not define workshop failure. |
| D25 | Keep `disableStorageInitializer` unset. | KServe uses the storage path to replace the model URI with the cache PVC. | The cached Pod mounts the PVC without a download init container. |

## ModelCar decision

ModelCar is supported by the provider through `oci://`. It uses OCI image layers instead of a LocalModel PVC.

The workshop does not combine ModelCar with LocalModel. The two paths teach different storage designs.

Use a separate rehearsal for ModelCar. That rehearsal must verify UID 1010 in the ModelCar and serving containers.

Use `oci+native://` only after a runtime compatibility test. The image volume is read-only and needs container runtime support.

## Request and telemetry decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D26 | Use the workload ClusterIP Service. | The workshop tests model serving without gateway policy. | Use a port-forward for API calls. |
| D27 | Use four terminal windows. | Installation, watches, tunneling, and requests need separate output. | Each terminal has one stable role. |
| D28 | Use the vLLM `/metrics` endpoint directly. | The VM has no Prometheus or Grafana data store. | Show live counters and histograms in the terminal. |
| D29 | Show `nvidia-smi` during a request. | The command gives direct GPU memory and utilization evidence. | A small model can produce a short utilization spike. |
| D30 | Do not install a monitoring stack during the recording. | A new stack adds time and another failure path. | Use the repository dashboard only as a production reference. |

## Recording and publishing decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D31 | Record a complete successful rehearsal. | The recording is the fallback for a failed live demonstration. | Keep the live cluster as an optional second path. |
| D32 | Save manifests, logs, metrics, and GPU output. | These files explain failures without another paid GPU session. | Store them outside the Git repository. |
| D33 | Do not record passwords, tokens, private keys, public IP addresses, or Kubernetes Secrets. | A public video cannot contain credentials or host access data. | Start the recording after SSH login. |
| D34 | Do not commit video or evidence bundles. | Large files and runtime output do not belong in Git history. | Use the event platform, object storage, or a video service. |
| D35 | Push documentation only after one successful rehearsal. | The commands must match observed behavior. | Correct the documents before the pull request. |

## Cleanup decisions

| ID | Decision | Reason | Result |
|---|---|---|---|
| D36 | Delete the Minikube profile after the final rehearsal. | The profile contains all disposable Kubernetes resources and model data. | One command removes the cluster state. |
| D37 | Restore the recorded kernel value. | The lab temporarily decreases BPF JIT hardening. | The host returns to its prior security state. |
| D38 | Remove only the workshop provider checkout. | The runbook creates that directory. | Do not remove unrelated source directories. |
| D39 | Stop the VM from the cloud control plane. | A guest shutdown can leave the GPU allocated. | Confirm that GPU billing stops in the provider console. |

## Change rule

When a decision changes, update this file and the affected procedure in the same commit.

Record the new evidence before you publish the change.

Final approval rests with the writer.
