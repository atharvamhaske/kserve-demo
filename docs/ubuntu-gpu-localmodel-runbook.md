# Ubuntu GPU LocalModel cache runbook
Use this runbook to test [provider-kserve PR #117](https://github.com/openeverest/provider-kserve/pull/117) on one native Ubuntu NVIDIA GPU host.
PR #117 is unreleased. Build its provider image and install its local chart from the contributor branch. Do not use released artifacts.
## 1. Confirm scope and risks
Use a disposable, single-user lab. LocalModel node-agent RBAC can read Secrets and ServiceAccounts and manage Jobs cluster-wide.
Known risks:
- The LocalModel APIs are `v1alpha1`.
- `modelSize` reserves capacity. It does not limit downloaded bytes.
- Cache disable and URI changes recreate the model workload.
- Chart disable with an enabled Instance cache is a known PR bug and does not cleanly recreate. Disable every cache first.
- Cache status does not gate Instance readiness.
- The PR wizard check is incomplete. This runbook uses YAML.
- Official pages show KServe v0.20. PR #117 pins v0.21.0 and tests LLMInferenceService matching.
This host has one NVIDIA H100 and 40 Mbps Wi-Fi. A 1.4 GiB transfer has a theoretical five-minute minimum. Seven to twelve minutes is realistic. A 7B or 8B model can take over one hour. This uses `Qwen/Qwen3-0.6B`, a 90-minute runtime-image gate, 30-minute model gates, and no MIG assumptions.
Gate: Continue only on a disposable cluster with no other users or workloads.
## 2. Set variables
Use one shell unless stated otherwise.
```bash
export PROFILE=everest-gpu INSTANCE=qwen-demo INSTANCE_NS=default
export PROVIDER_NS=provider-kserve EVEREST_NS=everest-system
export JOB_NS=kserve-localmodel-jobs NODE_GROUP=model-workers
export STORAGE_CLASS=local-model MODEL_URI=hf://Qwen/Qwen3-0.6B
export MODEL_NAME=qwen3-0.6b RUNTIME_IMAGE=ghcr.io/llm-d/llm-d-cuda:v0.9.0
export PROVIDER_REPO=https://github.com/atharvamhaske/provider-kserve.git
export PROVIDER_BRANCH=feat/localmodel-cache REPO_DIR="$HOME/src/provider-kserve-localmodel"
export IMAGE_REPO=provider-kserve-pr117
```
Gate: `printf '%s\n' "$PROFILE $INSTANCE $MODEL_URI"` prints the selected values.
## 3. Check Ubuntu, GPU, Docker, and NVIDIA toolkit
```bash
. /etc/os-release; printf 'OS=%s %s\n' "$ID" "$VERSION_ID"
uname -m; systemd-detect-virt || true
nvidia-smi
docker version
docker info --format '{{json .Runtimes}}'
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
```
This targets native Ubuntu on `x86_64`. Stop for `wsl`. If Docker GPU access fails, use the official NVIDIA guide below.
Gate: Host and container output list the H100. Docker shows a server and NVIDIA runtime support.
## 4. Create or reuse the GPU Minikube cluster
The official Minikube NVIDIA procedure requires `net.core.bpf_jit_harden=0` with the Docker driver.
```bash
export ORIGINAL_BPF_JIT_HARDEN=$(sysctl -n net.core.bpf_jit_harden)
printf 'Original net.core.bpf_jit_harden=%s\n' "$ORIGINAL_BPF_JIT_HARDEN"
```
Warning: Setting `0` reduces kernel hardening. Use it only for this lab. Cleanup restores the runtime value and creates no sysctl file.
```bash
if [ "$ORIGINAL_BPF_JIT_HARDEN" != 0 ]; then sudo sysctl -w net.core.bpf_jit_harden=0; fi
sudo sysctl net.core.bpf_jit_harden
command -v kubectl; command -v helm; command -v minikube
if minikube status -p "$PROFILE" >/dev/null 2>&1; then
  echo "Reusing running profile $PROFILE"
else
  minikube start -p "$PROFILE" --driver=docker --container-runtime=docker \
    --gpus=all --kubernetes-version=v1.35.0 --cpus=4 --memory=12288
fi
kubectl config use-context "$PROFILE"
kubectl get node "$PROFILE" -o wide
kubectl get node "$PROFILE" -o jsonpath='{.status.allocatable.nvidia\.com/gpu}{"\n"}'
kubectl run gpu-smoke --restart=Never \
  --image=nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0 \
  --overrides='{"spec":{"containers":[{"name":"gpu-smoke","image":"nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0","resources":{"limits":{"nvidia.com/gpu":1}}}]}}'
kubectl wait --for=jsonpath='{.status.phase}'=Succeeded pod/gpu-smoke --timeout=30m
kubectl logs gpu-smoke
```
Warning: The next command deletes only the completed smoke Pod.
```bash
kubectl delete pod gpu-smoke
```
Gate: The sysctl is `0`, node GPU capacity is positive, and the Pod prints `Test PASSED`.
## 5. Install missing platform components
```bash
helm repo add jetstack https://charts.jetstack.io
helm repo add openeverest https://openeverest.github.io/helm-charts/
helm repo update
if ! helm status cert-manager -n cert-manager --kube-context "$PROFILE" >/dev/null 2>&1; then
  helm upgrade --install cert-manager jetstack/cert-manager --kube-context "$PROFILE" \
    -n cert-manager --create-namespace --version v1.21.2 \
    --set crds.enabled=true --wait --timeout 30m
fi
if ! helm status everest -n "$EVEREST_NS" --kube-context "$PROFILE" >/dev/null 2>&1; then
  read -rsp 'OpenEverest admin password: ' UI_PASSWORD; printf '\n'
  helm upgrade --install everest openeverest/openeverest --kube-context "$PROFILE" \
    -n "$EVEREST_NS" --create-namespace --version 2.0.0-dev.4 \
    --set-literal "server.initialAdminPassword=$UI_PASSWORD" --set telemetry=false \
    --set upgrade.preflightChecks=false --set kube-state-metrics.enabled=false \
    --wait --timeout 30m
  unset UI_PASSWORD
fi
helm status cert-manager -n cert-manager --kube-context "$PROFILE"
helm status everest -n "$EVEREST_NS" --kube-context "$PROFILE"
```
Gate: Both releases report `STATUS: deployed`, and their Pods are ready.
## 6. Build and install PR #117
```bash
test ! -e "$REPO_DIR"; mkdir -p "$(dirname "$REPO_DIR")"
git clone --branch "$PROVIDER_BRANCH" --single-branch "$PROVIDER_REPO" "$REPO_DIR"
git -C "$REPO_DIR" checkout "$PROVIDER_BRANCH"
export PROVIDER_COMMIT=$(git -C "$REPO_DIR" rev-parse HEAD) IMAGE_TAG=$(git -C "$REPO_DIR" rev-parse --short HEAD)
eval "$(minikube -p "$PROFILE" docker-env)"
make -C "$REPO_DIR" docker-build IMG="$IMAGE_REPO:$IMAGE_TAG"
make -C "$REPO_DIR" helm-deps
kubectl get namespace "$JOB_NS" >/dev/null 2>&1 || kubectl create namespace "$JOB_NS"
```
`make helm-deps` updates local chart dependencies.
Warning: The next upgrade replaces provider and KServe controller resources. Run it only on this lab.
```bash
helm upgrade --install provider-kserve "$REPO_DIR/charts/provider-kserve" \
  --kube-context "$PROFILE" -n "$PROVIDER_NS" --create-namespace \
  --set image.repository="$IMAGE_REPO" --set image.tag="$IMAGE_TAG" \
  --set image.pullPolicy=Never --set kserveResources.kserve.localmodel.enabled=true \
  --set kserveResources.kserve.localmodel.jobNamespace="$JOB_NS" --wait --timeout 30m
```
Gate: Helm deploys the local chart. `printf '%s\n' "$PROVIDER_COMMIT"` records its commit.
## 7. Verify LocalModel components
```bash
kubectl get crd localmodelcaches.serving.kserve.io \
  localmodelnamespacecaches.serving.kserve.io \
  localmodelnodegroups.serving.kserve.io localmodelnodes.serving.kserve.io
kubectl -n "$PROVIDER_NS" rollout status deployment/kserve-localmodel-controller-manager --timeout=30m
kubectl -n "$PROVIDER_NS" rollout status daemonset/kserve-localmodelnode-agent --timeout=30m
kubectl get namespace "$JOB_NS"
kubectl -n "$PROVIDER_NS" get deployment provider-kserve \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="provider")].image}{"\n"}'
kubectl get provider provider-kserve
```
Gate: Four CRDs exist, both rollouts finish, the job namespace exists, and the image is `provider-kserve-pr117:$IMAGE_TAG`.
## 8. Prepare cache storage
```bash
export LOCAL_MODEL_HOST_PATH=$(kubectl -n "$PROVIDER_NS" get daemonset kserve-localmodelnode-agent \
  -o jsonpath='{.spec.template.spec.volumes[?(@.name=="models")].hostPath.path}')
printf 'LocalModel hostPath: %s\n' "$LOCAL_MODEL_HOST_PATH"
kubectl label node "$PROFILE" kserve/localmodel=worker --overwrite
kubectl -n "$PROVIDER_NS" rollout status daemonset/kserve-localmodelnode-agent --timeout=30m
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata: {name: ${STORAGE_CLASS}}
provisioner: kubernetes.io/no-provisioner
volumeBindingMode: WaitForFirstConsumer
---
apiVersion: serving.kserve.io/v1alpha1
kind: LocalModelNodeGroup
metadata: {name: ${NODE_GROUP}}
spec:
  storageLimit: 20Gi
  persistentVolumeClaimSpec: {accessModes: [ReadWriteOnce], resources: {requests: {storage: 20Gi}}, storageClassName: ${STORAGE_CLASS}}
  persistentVolumeSpec:
    accessModes: [ReadWriteOnce]
    capacity: {storage: 20Gi}
    storageClassName: ${STORAGE_CLASS}
    local: {path: ${LOCAL_MODEL_HOST_PATH}}
    nodeAffinity: {required: {nodeSelectorTerms: [{matchExpressions: [{key: kserve/localmodel, operator: In, values: [worker]}]}]}}
EOF
kubectl get localmodelnodegroup "$NODE_GROUP" -o yaml
```
Gate: The agent is ready. The node group has 20 GiB and the live DaemonSet host path.
## 9. Pre-pull runtime and create the Instance
Pre-pull vLLM so replacement timing excludes image transfer.
```bash
timeout 90m minikube -p "$PROFILE" image pull "$RUNTIME_IMAGE"
minikube -p "$PROFILE" ssh -- docker image inspect "$RUNTIME_IMAGE" --format '{{.RepoTags}} {{.Size}}'
kubectl -n "$INSTANCE_NS" apply -f - <<EOF
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata: {name: ${INSTANCE}}
spec:
  providerRef: {name: provider-kserve}
  topology: {type: llm}
  components:
    llmEngine:
      type: vllm
      replicas: 1
      resources: {limits: {cpu: "2", memory: 6Gi}}
      service: {serviceType: ClusterIP}
      parameters:
        modelURI: ${MODEL_URI}
        modelName: ${MODEL_NAME}
        computeProfile: gpu
        gpuCount: 1
        tensorParallelSize: 1
        localModelCache: {enabled: enabled, modelSize: 3Gi, nodeGroup: ${NODE_GROUP}}
        config: |
          template: {containers: [{name: main, args: [--enforce-eager, --max-model-len=2048, --max-num-seqs=1, --gpu-memory-utilization=0.2]}]}
EOF
```
Do not set `disableStorageInitializer`. In terminal 2, run `kubectl -n kserve-localmodel-jobs get jobs,pods,pvc -w`.
```bash
timeout 30m bash -c 'until [ "$(kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o jsonpath="{.status.copies.available}/{.status.copies.total}" 2>/dev/null)" = "1/1" ]; do sleep 10; done'
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o yaml
```
Gate: The image exists, a download Job completes, and cache copies report `1/1` without failures.
## 10. Verify admission and readiness
Wait for a Pod before assigning `MODEL_POD`.
```bash
timeout 30m bash -c 'until [ -n "$(kubectl -n "$INSTANCE_NS" get pod -l internal.serving.kserve.io/localmodel="$INSTANCE" -o jsonpath="{.items[0].metadata.name}" 2>/dev/null)" ]; do sleep 5; done'
export MODEL_POD=$(kubectl -n "$INSTANCE_NS" get pod -l internal.serving.kserve.io/localmodel="$INSTANCE" -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$JOB_NS" get jobs,pods,pvc -o wide
kubectl get pv; kubectl get localmodelnode -o yaml
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" \
  -o jsonpath='{.metadata.labels.internal\.serving\.kserve\.io/localmodel}{" "}{.metadata.labels.internal\.serving\.kserve\.io/localmodel-namespace}{"\n"}'
kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" \
  -o jsonpath='{.spec.volumes[*].persistentVolumeClaim.claimName}{"\n"}{.spec.initContainers[*].name}{"\n"}{.spec.containers[?(@.name=="main")].resources.limits.nvidia\.com/gpu}{"\n"}{.spec.containers[?(@.name=="main")].image}{"\n"}'
kubectl -n "$INSTANCE_NS" wait --for=condition=Ready pod/"$MODEL_POD" --timeout=30m
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- nvidia-smi
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" -o jsonpath='{.status.state}{" "}{.status.message}{"\n"}'
```
Gate: Labels name `qwen-demo` and `default`; PVC/PV exist; no `storage-initializer` exists; GPU limit is `1`; and Instance is ready.
## 11. Call both APIs
In terminal 2:
```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" port-forward svc/${INSTANCE}-kserve-workload-svc 8000:8000
```
```bash
curl --fail-with-body http://localhost:8000/v1/models
curl --fail-with-body http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-0.6b","messages":[{"role":"user","content":"Reply with one short sentence. /no_think"}],"chat_template_kwargs":{"enable_thinking":false},"max_tokens":64,"temperature":0.2}'
```
Gate: The model list contains `qwen3-0.6b`, and chat returns a completion.
## 12. Delete the Pod and prove reuse
```bash
kubectl -n "$JOB_NS" get jobs -o name | sort >"$HOME/pr117-jobs-before.txt"
export OLD_UID=$(kubectl -n "$INSTANCE_NS" get pod "$MODEL_POD" -o jsonpath='{.metadata.uid}')
export REUSE_START=$(date +%s)
```
Warning: The next command deletes the serving Pod. Inference is unavailable during replacement.
```bash
kubectl -n "$INSTANCE_NS" delete pod "$MODEL_POD" --wait=true
timeout 30m bash -c 'until pod=$(kubectl -n "$INSTANCE_NS" get pod -l internal.serving.kserve.io/localmodel="$INSTANCE" -o jsonpath="{.items[0].metadata.name}" 2>/dev/null); [ -n "$pod" ] && [ "$(kubectl -n "$INSTANCE_NS" get pod "$pod" -o jsonpath="{.metadata.uid}" 2>/dev/null)" != "$OLD_UID" ]; do sleep 5; done'
export MODEL_POD=$(kubectl -n "$INSTANCE_NS" get pod -l internal.serving.kserve.io/localmodel="$INSTANCE" -o jsonpath='{.items[0].metadata.name}')
kubectl -n "$INSTANCE_NS" wait --for=condition=Ready pod/"$MODEL_POD" --timeout=30m
export REUSE_END=$(date +%s)
printf 'Replacement readiness: %s seconds\n' "$((REUSE_END-REUSE_START))"
kubectl -n "$JOB_NS" get jobs -o name | sort >"$HOME/pr117-jobs-after.txt"
diff -u "$HOME/pr117-jobs-before.txt" "$HOME/pr117-jobs-after.txt"
```
Gate: UID changes, `diff` is empty, readiness is measured, and chat still works.
## 13. Disable, re-enable, and clean up
Warning: Both cache changes recreate the workload and interrupt inference.
```bash
kubectl -n "$INSTANCE_NS" patch instance "$INSTANCE" --type=merge \
  -p '{"spec":{"components":{"llmEngine":{"parameters":{"localModelCache":{"enabled":"disabled"}}}}}}'
kubectl -n "$INSTANCE_NS" get instance,llminferenceservice,localmodelnamespacecache -w
```
Stop when cache and labels are absent and the uncached Instance is ready. Then re-enable:
```bash
kubectl -n "$INSTANCE_NS" patch instance "$INSTANCE" --type=merge \
  -p '{"spec":{"components":{"llmEngine":{"parameters":{"localModelCache":{"enabled":"enabled"}}}}}}'
timeout 30m bash -c 'until [ "$(kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o jsonpath="{.status.copies.available}/{.status.copies.total}" 2>/dev/null)" = "1/1" ]; do sleep 10; done'
```
Gate: Copies return to `1/1`, labels return, and Instance is ready.
Warning: The next block deletes test resources and restores host hardening. Keep the node group until the cache is gone.
```bash
kubectl -n "$INSTANCE_NS" delete instance "$INSTANCE"
while kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" >/dev/null 2>&1; do sleep 5; done
while kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" >/dev/null 2>&1; do sleep 5; done
kubectl delete localmodelnodegroup "$NODE_GROUP"
kubectl label node "$PROFILE" kserve/localmodel-
kubectl delete storageclass "$STORAGE_CLASS"
if [ "$ORIGINAL_BPF_JIT_HARDEN" != 0 ]; then sudo sysctl -w net.core.bpf_jit_harden="$ORIGINAL_BPF_JIT_HARDEN"; fi
```
Gate: Instance, service, cache, and node group are absent. The sysctl equals its original value.
Warning: This optional command permanently deletes the cluster, images, and data.
```bash
minikube delete -p "$PROFILE"
```
## Troubleshooting
| Symptom | Check | Action |
|---|---|---|
| No GPU | Host, Docker, sysctl, node capacity | Fix before recreating Minikube. Do not assume MIG. |
| Repeated Jobs | DaemonSet `hostPath`, group `local.path` | Recreate with the live path. Check write access. |
| Download `OOMKilled` | Download Pod | Confirm chart limit `4Gi`. Increase host memory. |
| Cache at `0/1` | Jobs, PVC/PV, node, controllers | Fix labels, binding, disk, permissions, or access. Allow 30 minutes. |
| Provider rejects Instance | Instance and provider logs | Use `enabled`, `3Gi`, valid group, no `disableStorageInitializer`, and chart flag. |
| Model Pod fails | Pod and `main` logs | Check image, GPU, memory, PVC, and arguments. |
| Chart disable stalls | Instance, service, cache, provider | Re-enable. Disable every Instance cache before chart disable. |
| Ready while preparing | `.status.message`, `.status.copies` | Require `available == total`. |
## Evidence bundle
Run before cleanup. Save output with Job lists and replacement readiness.
```bash
printf 'provider_commit=%s bpf_original=%s\n' "$PROVIDER_COMMIT" "$ORIGINAL_BPF_JIT_HARDEN"
minikube version; kubectl version; helm list -A
kubectl get nodes -o wide; kubectl get crd | grep localmodel
kubectl -n "$PROVIDER_NS" get deployment,daemonset,pod -o wide
kubectl -n "$PROVIDER_NS" get deployment provider-kserve -o jsonpath='{.spec.template.spec.containers[?(@.name=="provider")].image}{"\n"}'
kubectl get localmodelnodegroup,localmodelnode,pv -o wide
kubectl -n "$JOB_NS" get jobs,pods,pvc -o wide
kubectl -n "$INSTANCE_NS" get instance,llminferenceservice,localmodelnamespacecache,pod,svc -o wide
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o yaml
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" -o yaml
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" -o yaml
kubectl -n "$PROVIDER_NS" logs deployment/provider-kserve --tail=200
kubectl -n "$PROVIDER_NS" logs deployment/kserve-localmodel-controller-manager --tail=200
kubectl -n "$PROVIDER_NS" logs daemonset/kserve-localmodelnode-agent --tail=200
```
## Primary sources
- [PR #117](https://github.com/openeverest/provider-kserve/pull/117), [branch](https://github.com/atharvamhaske/provider-kserve/tree/feat/localmodel-cache), and [issue #108](https://github.com/openeverest/provider-kserve/issues/108)
- [KServe LocalModel](https://kserve.github.io/website/docs/model-serving/generative-inference/modelcache/localmodel) and [installation](https://kserve.github.io/website/docs/install/localmodel-install)
- [NVIDIA toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html), [sample](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/sample-workload.html), [Minikube NVIDIA tutorial](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/), and [start guide](https://minikube.sigs.k8s.io/docs/start/)
