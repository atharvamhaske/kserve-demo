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
| KServe | `0.21.0` | KServe charts `kserve-crd`, `kserve-llmisvc-crd`, `kserve-resources`, `kserve-llmisvc-resources`, and `kserve-runtime-configs`, all at `v0.21.0` | This is the KServe version required by provider 0.5.x. The provider chart installs the KServe CRDs and controllers, so the workshop must not install a second KServe release. |
| Kubernetes | `v1.36.6` | Minikube `--kubernetes-version=v1.36.6` | Kubernetes `v1.37.1` is the newest stable release, but provider 0.5.x supports only Kubernetes 1.30 through 1.36. `v1.36.6` is the newest patch in the newest compatible minor. |
| Minikube | `v1.39.0` | `minikube-linux-amd64` | This is the latest stable Minikube release. It supports Kubernetes 1.36 and 1.37, but its default is 1.37, so the workshop must pass the Kubernetes pin explicitly. |
| cert-manager | `v1.21.3` | `jetstack/cert-manager` | This is the latest stable release. Install it separately before provider-kserve so the admission webhook is ready. |
| kube-prometheus-stack | `92.16.1` | `prometheus-community/kube-prometheus-stack`, asset `kube-prometheus-stack-92.16.1.tgz` | This is the latest chart release. Its Kubernetes constraint is `>=1.25.0-0`, which includes 1.36.6. |
| Prometheus | `v3.15.1` | `quay.io/prometheus/prometheus:v3.15.1-distroless` | This is the image pinned by kube-prometheus-stack 92.16.1 and the latest stable Prometheus release. `v3.16.0-rc.2` is a preview and must not replace it. |
| Grafana | `13.3.0` | Grafana dependency chart `14.2.0`, image `docker.io/grafana/grafana:13.3.0-distroless` | kube-prometheus-stack 92.16.1 pins Grafana chart 14.2.0, whose `appVersion` is 13.3.0. This matches the latest stable Grafana release. |
| Valkey | `9.1.3` | `valkey/valkey:9.1.3-alpine` | This is the latest stable Valkey release. The workshop uses one disposable instance for token-quota counters. |
| OpenAI Go client | `v3.91.0` | `github.com/openai/openai-go/v3` | This is the latest non-prerelease client. It requires Go 1.26 or later. |

Install cert-manager before provider-kserve. A separate release avoids the same-release admission webhook race documented by provider-kserve.

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
| OpenEverest | `v1.17.0` stable and `v2.0.0-dev.4` preview | Stable v1.17.0 uses the v1 architecture and cannot satisfy provider 0.5.x's v2 requirement. The workshop must use the preview on a fresh cluster. The preview release states that it is not for production and has no upgrade path from v1 or the prior preview. |
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

Yes. OpenEverest must use a Developer Preview with provider-kserve `0.1.0`.

OpenEverest stable `v1.17.0` is not compatible.

The provider table maps `0.1.x` to OpenEverest `>=2.0.0-dev.2`, KServe `0.20.0`, and Kubernetes 1.30 through 1.34.

Use OpenEverest `2.0.0-dev.2` for an exact historical pairing.

Do not pair provider 0.1.0 with Developer Preview 3 or 4. Those releases changed the provider-facing schemas.

Providers built for the prior preview will not reconcile correctly.

The complete historical set is therefore OpenEverest `2.0.0-dev.2`, provider-kserve `0.1.0`, KServe `0.20.0`, Kubernetes `v1.34.12`, and Minikube `v1.39.0`. It is not the recommended workshop set. Kubernetes 1.34 reached end of life on 2026-10-27, and provider 0.1.0 cannot move to a supported Kubernetes minor within its declared range.

Provider 0.1.0 artifacts are `oci://ghcr.io/openeverest/charts/provider-kserve --version 0.1.0`, `provider-kserve-0.1.0.tgz`, and `ghcr.io/openeverest/provider-kserve:0.1.0`. Its chart pins the KServe `v0.20.0` CRD, controller, and runtime-config charts.

## Primary sources

- OpenEverest stable `v1.17.0`: [release](https://github.com/openeverest/openeverest/releases/tag/v1.17.0).
- OpenEverest Developer Preview 4: [release](https://github.com/openeverest/openeverest/releases/tag/v2.0.0-dev.4).
- OpenEverest Developer Preview 2: [release](https://github.com/openeverest/openeverest/releases/tag/v2.0.0-dev.2).
- OpenEverest chart asset: [release](https://github.com/openeverest/helm-charts/releases/tag/openeverest-2.0.0-dev.4).
- OpenEverest official Helm index: [index](https://openeverest.github.io/helm-charts/index.yaml).
- provider-kserve `v0.5.0`: [release](https://github.com/openeverest/provider-kserve/releases/tag/v0.5.0).
- provider-kserve compatibility and warning: [README](https://github.com/openeverest/provider-kserve/blob/v0.5.0/README.md#compatibility).
- provider-kserve AI Gateway setup: [guide](https://github.com/openeverest/provider-kserve/blob/v0.5.0/docs/ai-gateway-setup.md).
- provider-kserve TLS and `nip.io`: [guide](https://github.com/openeverest/provider-kserve/blob/v0.5.0/docs/ai-gateway-tls.md).
- provider-kserve chart dependencies: [chart](https://github.com/openeverest/provider-kserve/blob/v0.5.0/charts/provider-kserve/Chart.yaml).
- provider-kserve UI fields and presets: [values](https://github.com/openeverest/provider-kserve/blob/v0.5.0/charts/provider-kserve/values.yaml).
- plugin-user-management `v0.2.0`: [release](https://github.com/openeverest/plugin-user-management/releases/tag/v0.2.0).
- plugin-user-management API-key contract: [README](https://github.com/openeverest/plugin-user-management/blob/v0.2.0/README.md).
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
