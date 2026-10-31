# Workshop release sources

This note fixes the release inputs for the Ubuntu NVIDIA GPU workshop as of 2026-10-31. It separates the newest published releases from the newest set allowed by the provider's compatibility table. These are source-backed pins, not a rehearsal result.

## Recommended stack

Use this set for the current workshop:

| Component | Workshop pin | Install artifact | Why this pin |
|---|---:|---|---|
| OpenEverest | `2.0.0-dev.4` | Helm chart `openeverest/openeverest`, asset `openeverest-2.0.0-dev.4.tgz` | `provider-kserve` 0.5.x requires OpenEverest `>= 2.0.0-dev.4`. This is a Developer Preview, not a stable production release. |
| provider-kserve | `0.5.0` | `oci://ghcr.io/openeverest/charts/provider-kserve`, asset `provider-kserve-0.5.0.tgz`, image `ghcr.io/openeverest/provider-kserve:0.5.0` | This is the latest non-prerelease provider tag. The project still labels the provider and OpenEverest v2 pre-alpha and not for production. |
| plugin-user-management | `0.2.0` | `oci://ghcr.io/openeverest/charts/plugin-user-management`, image `ghcr.io/openeverest/plugin-user-management:0.2.0` | This release adds provider-kserve API-key users through the OpenEverest Users tab. |
| Envoy Gateway | `v1.9.2` | Bundled `gateway-helm` dependency | provider-kserve 0.5.0 pins this version. The workshop enables the disabled-by-default subchart. |
| Envoy AI Gateway / Agent Router | `v1.2.0` | Bundled `ai-gateway-helm` and `ai-gateway-crds-helm` dependencies | provider-kserve 0.5.0 pins this version and keeps the Envoy AI Gateway resource names. |
| Gateway API | `v1.6` | CRDs from the Envoy Gateway `v1.9.2` chart | cert-manager Gateway support requires these CRDs before cert-manager starts. |
| KServe | `0.21.0` | KServe charts `kserve-crd`, `kserve-llmisvc-crd`, `kserve-resources`, `kserve-llmisvc-resources`, and `kserve-runtime-configs`, all at `v0.21.0` | This is the KServe version required by provider 0.5.x. The provider chart installs the KServe CRDs and controllers. Do not install a second KServe release. |
| vLLM | `0.26.0` | `ghcr.io/llm-d/llm-d-cuda:v0.9.0` | This is the vLLM version in the provider 0.5.0 default version bundle and bundled GPU presets. |
| Kubernetes | `v1.36.6` | Minikube `--kubernetes-version=v1.36.6` | Kubernetes `v1.37.1` is the newest stable release, but provider 0.5.x supports only Kubernetes 1.30 through 1.36. `v1.36.6` is the newest patch in the newest compatible minor. |
| kubectl | `v1.36.6` | `kubectl` Linux `amd64` binary | Matching the Kubernetes server patch removes avoidable client skew. |
| Minikube | `v1.39.0` | `minikube-linux-amd64` | This is the latest stable Minikube release. It supports Kubernetes 1.36 and 1.37, but its default is 1.37. The workshop passes the Kubernetes pin explicitly. |
| Helm | `v3.22.1` | `helm-v3.22.1-linux-amd64.tar.gz` | This is the pinned Helm 3 client used for the workshop charts. |
| Go | `1.26.10` | `go1.26.10.linux-amd64.tar.gz` | This supported Go 1.26 patch satisfies the client module and OpenAI Go requirements. |
| cert-manager | `v1.21.3` | `jetstack/cert-manager` | This is the latest stable release. Install it separately before provider-kserve so the admission webhook is ready. |
| kube-prometheus-stack | `92.16.1` | `prometheus-community/kube-prometheus-stack`, asset `kube-prometheus-stack-92.16.1.tgz` | This is the latest chart release. Its Kubernetes constraint is `>=1.25.0-0`, which includes 1.36.6. |
| Prometheus | `v3.15.1` | `quay.io/prometheus/prometheus:v3.15.1-distroless` | This is the image pinned by kube-prometheus-stack 92.16.1 and the latest stable Prometheus release. Do not replace it with the `v3.16.0-rc.2` preview. |
| Grafana | `13.3.0` | Grafana dependency chart `14.2.0`, image `docker.io/grafana/grafana:13.3.0-distroless` | kube-prometheus-stack 92.16.1 pins Grafana chart 14.2.0, whose `appVersion` is 13.3.0. This matches the latest stable Grafana release. |
| Valkey | `9.1.3` | `valkey/valkey:9.1.3-alpine` | This is the latest stable Valkey release. The workshop uses one disposable instance for token-quota counters. |
| OpenAI Go client | `v3.91.0` | `github.com/openai/openai-go/v3` | This is the latest non-prerelease client. It requires Go 1.26 or newer. |

Install cert-manager before provider-kserve. A separate release avoids the same-release admission webhook race documented by provider-kserve.

## Fresh-host tooling

The bootstrap targets Ubuntu 24.04 LTS on `x86_64`.

Before bootstrap, the host owner installs the NVIDIA driver, Docker Engine, and NVIDIA Container Toolkit. The script does not automate kernel modules, Secure Boot enrollment, daemon replacement, or Docker group membership.

Use these official procedures:

- [NVIDIA Ubuntu driver installation](https://docs.nvidia.com/datacenter/tesla/driver-installation-guide/ubuntu.html).
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
- [Docker post-installation and group warning](https://docs.docker.com/engine/install/linux-postinstall/).
- [NVIDIA Container Toolkit installation](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/1.20.1/install-guide.html).
- [Minikube NVIDIA GPU procedure](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/).

`bootstrap-host.sh` installs the remaining workshop clients from their official release artifacts:

- kubectl `v1.36.6`: [binary and checksum procedure](https://v1-36.docs.kubernetes.io/docs/tasks/tools/install-kubectl-linux/).
- Minikube `v1.39.0`: [release and assets](https://github.com/kubernetes/minikube/releases/tag/v1.39.0).
- Helm `v3.22.1`: [release and checksums](https://github.com/helm/helm/releases/tag/v3.22.1).
- Go `1.26.10`: [download metadata](https://go.dev/dl/?mode=json) and [installation procedure](https://go.dev/doc/install).

For each missing client, the script downloads the artifact into a temporary directory and verifies its published SHA-256 value before privileged installation. It leaves a matching managed version unchanged and rejects another installation.

Kind is not a workshop dependency. Minikube owns the cluster lifecycle and documents the Docker-based NVIDIA path. Installing kind adds another cluster and kubeconfig context without serving a runbook step.

## Exact runbook pins

The GPU path requires the Docker driver and Docker container runtime even though Minikube 1.39 defaults to containerd. The official Minikube NVIDIA guide also requires the host NVIDIA driver, NVIDIA Container Toolkit or CDI, and `net.core.bpf_jit_harden=0` for this path.

```bash
minikube start \
  --driver=docker \
  --container-runtime=docker \
  --gpus=all \
  --kubernetes-version=v1.36.6

helm repo add openeverest https://openeverest.github.io/helm-charts/
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm upgrade --install everest-core openeverest/openeverest \
  --devel --version 2.0.0-dev.4 \
  --namespace everest-system --create-namespace

helm upgrade --install observability prometheus-community/kube-prometheus-stack \
  --version 92.16.1 \
  --namespace monitoring --create-namespace

helm upgrade --install provider-kserve \
  oci://ghcr.io/openeverest/charts/provider-kserve \
  --version 0.5.0 \
  --namespace everest-system

helm upgrade --install plugin-user-management \
  oci://ghcr.io/openeverest/charts/plugin-user-management \
  --version 0.2.0 \
  --namespace everest-system
```

Verify the resolved pins before the workshop:

```bash
minikube version --short
kubectl version
helm show chart openeverest/openeverest --devel --version 2.0.0-dev.4
helm show chart oci://ghcr.io/openeverest/charts/provider-kserve --version 0.5.0
helm show chart prometheus-community/kube-prometheus-stack --version 92.16.1
helm show chart oci://ghcr.io/openeverest/charts/plugin-user-management --version 0.2.0
```

## Latest release comparison

| Component | Latest published release | Status and compatibility consequence |
|---|---:|---|
| OpenEverest | `v1.17.0` stable and `v2.0.0-dev.4` preview | Stable v1.17.0 uses the v1 architecture and cannot satisfy provider 0.5.x's v2 requirement. Use the preview on a fresh cluster. The preview release states that it is not for production and has no upgrade path from v1 or the prior preview. |
| provider-kserve | `v0.5.0` | GitHub marks the release non-prerelease, but the repository labels the project pre-alpha. Its declared range is OpenEverest `>=2.0.0-dev.4`, KServe `0.21.0`, and Kubernetes 1.30 through 1.36. |
| plugin-user-management | `v0.2.0` | Adds provider-kserve API keys and requires the OpenEverest plugin contract `^18.0.0`. |
| Envoy Gateway | `v1.9.2` | Pinned by provider-kserve 0.5.0. |
| Envoy AI Gateway / Agent Router | `v1.2.0` | Pinned by provider-kserve 0.5.0. Do not install a second controller. |
| KServe | `v0.21.0` | Stable and compatible with provider 0.5.x. |
| Kubernetes | `v1.37.1` | Stable but outside the provider's declared maximum. Use `v1.36.6`. |
| Minikube | `v1.39.0` | Stable and compatible. Its default Kubernetes version is too new for the provider, so pin 1.36.6. |
| kube-prometheus-stack | `92.16.1` | Stable chart release, compatible with Kubernetes 1.36.6. |
| Prometheus | `v3.15.1` stable and `v3.16.0-rc.2` preview | Use 3.15.1, which the selected monitoring chart already pins. |
| Grafana | `v13.3.0` | Stable and already selected by Grafana chart 14.2.0 in the monitoring stack. |
| Valkey | `v9.1.3` | Latest stable release. Used only for the workshop quota backend. |
| OpenAI Go client | `v3.91.0` | Latest stable release. Used by the checked-in consumer example. |

## provider-kserve 0.1.0 compatibility

Yes. OpenEverest requires a Developer Preview with provider-kserve `0.1.0`.

OpenEverest stable `v1.17.0` is not compatible.

The provider table maps `0.1.x` to OpenEverest `>=2.0.0-dev.2`, KServe `0.20.0`, and Kubernetes 1.30 through 1.34.

Use OpenEverest `2.0.0-dev.2` for an exact historical pairing.

Do not pair provider 0.1.0 with Developer Preview 3 or 4. Those releases changed the provider-facing schemas.

Providers built for the prior preview do not reconcile correctly.

The complete historical set is therefore OpenEverest `2.0.0-dev.2`, provider-kserve `0.1.0`, KServe `0.20.0`, Kubernetes `v1.34.12`, and Minikube `v1.39.0`. It is not the recommended workshop set. Kubernetes 1.34 reached end of life on 2026-10-27, and provider 0.1.0 cannot move to a supported Kubernetes minor within its declared range.

Provider 0.1.0 artifacts are `oci://ghcr.io/openeverest/charts/provider-kserve --version 0.1.0`, `provider-kserve-0.1.0.tgz`, and `ghcr.io/openeverest/provider-kserve:0.1.0`. Its chart pins the KServe `v0.20.0` CRD, controller, and runtime-config charts.

## Workshop configuration choices and vLLM parallelism

This section separates an OpenEverest creation method from the runtime layout that the resulting `Instance` requests. It applies to the workshop pins: OpenEverest `2.0.0-dev.4`, provider-kserve `0.5.0`, and KServe `0.21.0`.

### What an InstancePreset does

An `InstancePreset` is a reusable, ready-to-deploy instance configuration. Its spec has the same shape as `Instance.spec`, including the provider, version, topology, components, storage, and scheduling.

The official [Instance preset guide](https://openeverest.io/documentation/2.0.0-dev.4/administer/instance_presets.html#the-instancepreset-resource) documents that full-spec shape. The API is even more direct: [`InstancePresetSpec` embeds `InstanceSpec`](https://github.com/openeverest/openeverest/blob/v2.0.0-dev.4/api/core/v1alpha1/instancepreset_types.go#L21-L24).

In the UI, selecting a card resolves the preset for the target namespace. OpenEverest fills namespace defaults, populates the form, locks the preset-owned configuration, and submits the resolved spec as-is.

The [official UI procedure](https://openeverest.io/documentation/2.0.0-dev.4/administer/instance_presets.html#using-presets-in-the-ui) describes that flow. The UI implementation is source evidence: [`buildPresetCreateArgs` assigns the resolved spec and provenance annotation](https://github.com/openeverest/openeverest/blob/v2.0.0-dev.4/ui/apps/everest/src/pages/database-form/preset-selection/preset-selection.utils.ts#L51-L55).

The resulting object is a normal `Instance` with a full `spec`, not an object that depends on a `presetRef` at runtime. [`InstanceSpec` has the normal provider, topology, parameter, and component fields and no `presetRef`](https://github.com/openeverest/openeverest/blob/v2.0.0-dev.4/api/core/v1alpha1/instance_types.go#L34-L132). The annotation records provenance only.

### Workshop decision rule

Use these three paths deliberately:

- Live demo: select the checked-in [`kserve-qwen-demo-gateway` preset](manifests/instancepreset-qwen-demo-gateway.yaml). It keeps the provider's 1-GPU layout and adds the Gateway, quota, and metrics required by this workshop.
- One-off exploration: start without a preset and change the UI custom fields. The preset flow in this OpenEverest release is pick-and-use, while [creation from scratch remains available](https://openeverest.io/documentation/2.0.0-dev.4/administer/instance_presets.html#limitations).
- Repeatable automation or review: check in an `Instance` manifest. The provider ships an [official Instance YAML example](https://github.com/openeverest/provider-kserve/blob/v0.5.0/examples/instance-llm.yaml). Git then records the exact desired spec and its review history.

This is a workshop policy, not an OpenEverest API requirement.

### provider-kserve 0.5.0 field contract

| Instance field | Meaning, default, and validation in provider-kserve `0.5.0` |
|---|---|
| `spec.components.llmEngine.parameters.tensorParallelSize` | Maps to vLLM tensor parallel size. The UI default is `1` and its allowed range is 1 to 16. The provider requires every GPU model pod to have at least this many GPUs. |
| `spec.components.llmEngine.parameters.pipelineParallelSize` | Maps to vLLM pipeline parallel size. The UI default is `1` and its allowed range is 1 to 16. With `workerCount`, it equals `workerCount + 1`; the flag alone does not create worker pods. |
| `spec.components.llmEngine.parameters.dataParallelSize` | Maps to KServe data parallelism. The UI default is `1` and its allowed range is 1 to 16. Values greater than `1` map to both `parallelism.data` and `dataLocal`; `1` is treated as no-op. Data and pipeline sizes cannot both exceed `1`. |
| `spec.components.llmEngine.replicas` | Fixed KServe workload copies. The topology and UI default to `1`; the UI range is 0 to 32, and provider validation rejects negative values. When WVA autoscaling fields are set, the provider emits `scaling` instead of fixed `replicas`. |
| `spec.components.llmEngine.parameters.gpuCount` | The `nvidia.com/gpu` limit for each vLLM head and worker pod. On the GPU profile, an empty value preserves an existing GPU limit or defaults it to `1`. The UI range is 1 to 16. It is invalid on the CPU profile and cannot be lower than `tensorParallelSize`. |

Provider source evidence for the table:

- The [topology default](https://github.com/openeverest/provider-kserve/blob/v0.5.0/definition/topologies/llm/topology.yaml#L13-L17) sets one replica. The [LLM UI schema](https://github.com/openeverest/provider-kserve/blob/v0.5.0/definition/topologies/llm/topology.yaml#L84-L196) defines replica and parallelism fields, defaults, and ranges. Its [GPU field](https://github.com/openeverest/provider-kserve/blob/v0.5.0/definition/topologies/llm/topology.yaml#L275-L294) documents the effective 1-GPU default and the 1 to 16 UI range.
- The [component type definitions](https://github.com/openeverest/provider-kserve/blob/v0.5.0/definition/components/types.go#L94-L130) map the three parallel sizes and `gpuCount` to vLLM and KServe.
- The [provider validation](https://github.com/openeverest/provider-kserve/blob/v0.5.0/internal/provider/llminferenceservice.go#L97-L99) rejects simultaneous data and pipeline sizes greater than `1`. Its [GPU checks](https://github.com/openeverest/provider-kserve/blob/v0.5.0/internal/provider/llminferenceservice.go#L186-L193) apply to head and worker resources.
- The [`gpuCount` implementation](https://github.com/openeverest/provider-kserve/blob/v0.5.0/internal/provider/llminferenceservice.go#L288-L330) injects the GPU limit, supplies the effective default of `1`, and requires at least the tensor parallel size.
- The [KServe mapping](https://github.com/openeverest/provider-kserve/blob/v0.5.0/internal/provider/llminferenceservice.go#L638-L668) sends fixed replicas, tensor and pipeline sizes, and data sizes. It mirrors `dataParallelSize` into `dataLocal` and omits data parallelism when the value is `1`.
- KServe `0.21.0` defines [`replicas` as deployment replicas](https://github.com/kserve/kserve/blob/v0.21.0/pkg/apis/serving/v1alpha2/llm_inference_service_types.go#L116-L154) and gives each [parallelism size a minimum of `1`](https://github.com/kserve/kserve/blob/v0.21.0/pkg/apis/serving/v1alpha2/llm_inference_service_types.go#L733-L758).

### What the parallelism settings mean

Tensor parallelism splits one model replica across GPUs. Use it when a model needs several GPUs in one node.

Pipeline parallelism splits one model replica into model stages. For multi-node models, vLLM recommends tensor size equal to GPUs per node. Pipeline size equals node count.

Pipeline parallelism is also the documented option when a model fits on one node but its size does not divide evenly across the GPU count. It splits by layers and supports uneven splits.

Those rules come from vLLM `0.26.0` [single-model replica guidance](https://docs.vllm.ai/en/v0.26.0/serving/parallelism_scaling/#distributed-inference-strategies-for-a-single-model-replica). The same guide covers [uneven GPU splits](https://docs.vllm.ai/en/v0.26.0/serving/parallelism_scaling/#edge-case-uneven-gpu-splits).

Data parallelism replicates model weights across separate instances or GPUs so they can process different request batches. In vLLM, each data-parallel rank is a separate core-engine process with its own KV cache.

Requests still need routing across those engines. vLLM supports internal, hybrid, and external balancing. For external balancing of dense models, each server is fully independent and runs without `--data-parallel-*` flags.

The official vLLM `0.26.0` [data parallel guide](https://docs.vllm.ai/en/v0.26.0/serving/data_parallel_deployment/#data-parallel-deployment) defines the engine and memory model. Its [external balancing section](https://docs.vllm.ai/en/v0.26.0/serving/data_parallel_deployment/#external-load-balancing) defines the independent-server layout.

`replicas` is outside vLLM's in-engine parallelism. KServe creates that many workload copies, and provider-kserve passes the fixed count to KServe. Each copy runs another model server, so budget model-weight and KV-cache memory for every replica.

Do not treat data parallel size and Kubernetes replicas as synonyms. Data parallel size controls vLLM/KServe engine ranks inside the generated service. Replicas controls KServe workload copies around that layout.

### Capacity caveats for the presenter

- provider-kserve validates `gpuCount >= tensorParallelSize`. This is only the API floor, not the complete local runtime demand.
- Without worker pods, local pipeline parallelism needs `tensorParallelSize x pipelineParallelSize` GPUs in the head pod.
- With worker pods, each head and worker needs at least `tensorParallelSize` GPUs. An explicit `workerResources` GPU limit can differ from the head limit.
- Multi-node worker pods require LeaderWorkerSet. The chart [leaves it disabled](https://github.com/openeverest/provider-kserve/blob/v0.5.0/charts/provider-kserve/values.yaml#L660-L663) and pins the controller to [`0.8.0`](https://github.com/openeverest/provider-kserve/blob/v0.5.0/charts/provider-kserve/Chart.yaml#L75-L80).
- Local data parallelism needs `tensorParallelSize x dataParallelSize` GPUs in the head pod and a request-balancing path.
- Kubernetes replicas are full outer workload copies. Each replica needs another set of model weights and KV caches in accelerator memory.
- Keep the live workshop at the charted 1-GPU preset. Change parallelism only when the cluster has the matching GPUs, nodes, model fit, and routing.

## Primary sources

- OpenEverest stable `v1.17.0`: [release](https://github.com/openeverest/openeverest/releases/tag/v1.17.0).
- OpenEverest Developer Preview 4: [release](https://github.com/openeverest/openeverest/releases/tag/v2.0.0-dev.4).
- OpenEverest Developer Preview 2: [release](https://github.com/openeverest/openeverest/releases/tag/v2.0.0-dev.2).
- OpenEverest chart asset: [release](https://github.com/openeverest/helm-charts/releases/tag/openeverest-2.0.0-dev.4).
- OpenEverest official Helm index: [index](https://openeverest.github.io/helm-charts/index.yaml).
- Provider `v0.5.0` release: [release](https://github.com/openeverest/provider-kserve/releases/tag/v0.5.0).
- Provider compatibility and warning: [README](https://github.com/openeverest/provider-kserve/blob/v0.5.0/README.md#compatibility).
- Provider AI Gateway setup: [guide](https://github.com/openeverest/provider-kserve/blob/v0.5.0/docs/ai-gateway-setup.md).
- Provider TLS and `nip.io`: [guide](https://github.com/openeverest/provider-kserve/blob/v0.5.0/docs/ai-gateway-tls.md).
- Provider chart dependencies: [chart](https://github.com/openeverest/provider-kserve/blob/v0.5.0/charts/provider-kserve/Chart.yaml).
- Provider UI fields and presets: [values](https://github.com/openeverest/provider-kserve/blob/v0.5.0/charts/provider-kserve/values.yaml).
- Provider version bundle and vLLM image: [README](https://github.com/openeverest/provider-kserve/blob/v0.5.0/README.md#versions).
- Provider multi-node and replica guidance: [guide](https://github.com/openeverest/provider-kserve/blob/v0.5.0/docs/llm-multi-node.md).
- Official vLLM `0.26.0` parallelism and scaling: [guide](https://docs.vllm.ai/en/v0.26.0/serving/parallelism_scaling/).
- Official vLLM `0.26.0` data parallel deployment: [guide](https://docs.vllm.ai/en/v0.26.0/serving/data_parallel_deployment/).
- Plugin User Management `v0.2.0`: [release](https://github.com/openeverest/plugin-user-management/releases/tag/v0.2.0).
- Plugin User Management API-key contract: [README](https://github.com/openeverest/plugin-user-management/blob/v0.2.0/README.md).
- OpenEverest preset UI: [source](https://github.com/openeverest/openeverest/blob/v2.0.0-dev.4/ui/apps/everest/src/pages/database-form/preset-selection/preset-select-cards/preset-select-cards.messages.ts).
- provider-kserve `v0.1.0`: [release](https://github.com/openeverest/provider-kserve/releases/tag/v0.1.0).
- provider-kserve `v0.1.0` KServe pins: [chart](https://github.com/openeverest/provider-kserve/blob/v0.1.0/charts/provider-kserve/Chart.yaml).
- KServe `v0.21.0`: [release](https://github.com/kserve/kserve/releases/tag/v0.21.0).
- KServe `v0.20.0`: [release](https://github.com/kserve/kserve/releases/tag/v0.20.0).
- Kubernetes releases: [official page](https://kubernetes.io/releases/).
- Kubernetes 1.34 end of life: [patch releases](https://kubernetes.io/releases/patch-releases/#1-34).
- Minikube `v1.39.0`: [release](https://github.com/kubernetes/minikube/releases/tag/v1.39.0).
- Minikube tested range and default: [constants](https://github.com/kubernetes/minikube/blob/v1.39.0/pkg/minikube/constants/constants.go).
- cert-manager `v1.21.3`: [release](https://github.com/cert-manager/cert-manager/releases/tag/v1.21.3).
- Minikube NVIDIA GPU procedure: [official guide](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/).
- kube-prometheus-stack `92.16.1`: [release](https://github.com/prometheus-community/helm-charts/releases/tag/kube-prometheus-stack-92.16.1).
- kube-prometheus-stack chart metadata: [chart](https://github.com/prometheus-community/helm-charts/blob/kube-prometheus-stack-92.16.1/charts/kube-prometheus-stack/Chart.yaml).
- kube-prometheus-stack Prometheus pin: [values](https://github.com/prometheus-community/helm-charts/blob/kube-prometheus-stack-92.16.1/charts/kube-prometheus-stack/values.yaml).
- Prometheus stable `v3.15.1`: [release](https://github.com/prometheus/prometheus/releases/tag/v3.15.1).
- Prometheus preview `v3.16.0-rc.2`: [release](https://github.com/prometheus/prometheus/releases/tag/v3.16.0-rc.2).
- Grafana chart 14.2.0: [chart](https://github.com/grafana-community/helm-charts/blob/grafana-14.2.0/charts/grafana/Chart.yaml).
- Grafana stable `v13.3.0`: [release](https://github.com/grafana/grafana/releases/tag/v13.3.0).
- Valkey `v9.1.3`: [release](https://github.com/valkey-io/valkey/releases/tag/9.1.3).
- OpenAI Go `v3.91.0`: [release](https://github.com/openai/openai-go/releases/tag/v3.91.0).
