# Ubuntu GPU LocalModel cache runbook
Use this runbook to test [provider-kserve PR #117](https://github.com/openeverest/provider-kserve/pull/117) on one native Ubuntu NVIDIA GPU host.

PR #117 is unreleased. Build its provider image and install its local chart from the contributor branch. Do not use released artifacts.

Complete the [Ubuntu GPU workshop prerequisites](ubuntu-gpu-workshop-prerequisites.md) before this runbook.

## 1. Confirm scope and risks

Use a disposable, single-user lab. The LocalModel node-agent RBAC can read Secrets and ServiceAccounts and manage Jobs cluster-wide.

Known risks:

- The LocalModel APIs are `v1alpha1`.
- `modelSize` reserves capacity. It does not limit downloaded bytes.
- Cache disable and URI changes recreate the model workload.
- Chart disable with an enabled Instance cache is a known PR bug. Disable every cache first.
- The provider currently creates the LLM workload before cache readiness. This runbook waits for cache `1/1` before it evaluates serving readiness.
- KServe v0.21.0 does not render the advertised node-agent user. This runbook applies an explicit UID and group.
- KServe does not propagate the download group to serving Pods. This runbook adds `fsGroup: 1000`.
- The PR wizard check is incomplete. This runbook uses YAML.

The verified host has one RTX PRO 6000 Blackwell GPU. The runbook uses `Qwen/Qwen3-0.6B`, a 90-minute runtime-image gate, and 30-minute model gates.

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
```

This runbook targets native Ubuntu on `x86_64`. Stop if `systemd-detect-virt` reports `wsl`.

Gate: Host and container output list the same NVIDIA GPU. At least 60 GiB disk space is free.
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
## 7. Verify and fix LocalModel component identities

KServe v0.21.0 declares a node-agent `runAsUser` value but does not render it. Apply the explicit cache identity after every Helm upgrade.

```bash
kubectl get crd localmodelcaches.serving.kserve.io \
  localmodelnamespacecaches.serving.kserve.io \
  localmodelnodegroups.serving.kserve.io localmodelnodes.serving.kserve.io
kubectl -n "$PROVIDER_NS" rollout status deployment/kserve-localmodel-controller-manager --timeout=30m
kubectl -n "$PROVIDER_NS" patch daemonset kserve-localmodelnode-agent --type=merge \
  -p '{"spec":{"template":{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":1000,"runAsGroup":1000,"fsGroup":1000,"seccompProfile":{"type":"RuntimeDefault"}}}}}}'
kubectl get namespace "$JOB_NS"
kubectl -n "$PROVIDER_NS" get deployment provider-kserve \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="provider")].image}{"\n"}'
kubectl -n "$PROVIDER_NS" get daemonset kserve-localmodelnode-agent \
  -o jsonpath='{.spec.template.spec.securityContext}{"\n"}'
kubectl get provider provider-kserve
```

Gate: Four CRDs exist. The node-agent security context contains UID, GID, and fsGroup `1000`.
## 8. Prepare cache storage

Get the exact host path from the live DaemonSet. Prepare it before the node-agent starts.

```bash
export LOCAL_MODEL_HOST_PATH=$(kubectl -n "$PROVIDER_NS" get daemonset kserve-localmodelnode-agent \
  -o jsonpath='{.spec.template.spec.volumes[?(@.name=="models")].hostPath.path}')
printf 'LocalModel hostPath: %s\n' "$LOCAL_MODEL_HOST_PATH"
minikube -p "$PROFILE" ssh -- \
  "sudo install -d -o root -g 1000 -m 2775 '$LOCAL_MODEL_HOST_PATH' '$LOCAL_MODEL_HOST_PATH/models'"
kubectl label node "$PROFILE" kserve/localmodel=worker --overwrite
kubectl -n "$PROVIDER_NS" rollout status daemonset/kserve-localmodelnode-agent --timeout=30m
minikube -p "$PROFILE" ssh -- \
  "ls -ldn '$LOCAL_MODEL_HOST_PATH' '$LOCAL_MODEL_HOST_PATH/models'"
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

Gate: The directories are `root:1000`, group-writable, and setgid. The node agent is ready.
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
          template:
            securityContext:
              fsGroup: 1000
            containers:
              - name: main
                args:
                  - --enforce-eager
                  - --max-model-len=2048
                  - --max-num-seqs=1
                  - --gpu-memory-utilization=0.2
EOF
```

Do not set `disableStorageInitializer`. In terminal 2, run this watch:

```bash
kubectl -n "$JOB_NS" get jobs,pods,pvc -w
```

Wait for the cache before you evaluate model readiness:

```bash
timeout 30m bash -c 'until [ "$(kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o jsonpath="{.status.copies.available}/{.status.copies.total}" 2>/dev/null)" = "1/1" ]; do sleep 10; done'
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o yaml
```

Gate: The download Job completes. Cache copies report `1/1` with no failed copy.
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
  -o jsonpath='{.spec.securityContext}{"\n"}{.spec.volumes[*].persistentVolumeClaim.claimName}{"\n"}{.spec.initContainers[*].name}{"\n"}{.spec.containers[?(@.name=="main")].resources.limits.nvidia\.com/gpu}{"\n"}{.spec.containers[?(@.name=="main")].image}{"\n"}'
kubectl -n "$INSTANCE_NS" wait --for=condition=Ready pod/"$MODEL_POD" --timeout=30m
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- nvidia-smi
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- \
  sh -c 'id; test -r /mnt/models/config.json; echo model-config-readable'
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" \
  -o jsonpath='{.status.phase}{" "}{.status.message}{"\n"}'
```

Gate: The Pod has fsGroup `1000`, the model config is readable, and the Instance phase is `Ready`.

## 11. Call both APIs and show telemetry

In terminal 2:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" port-forward svc/${INSTANCE}-kserve-workload-svc 8000:8000
```

In terminal 1:

```bash
curl --fail-with-body http://localhost:8000/v1/models
curl --fail-with-body http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3-0.6b","messages":[{"role":"user","content":"In two short sentences, explain why model caching reduces cold-start latency."}],"chat_template_kwargs":{"enable_thinking":false},"max_tokens":96,"temperature":0}'
curl --fail-with-body http://localhost:8000/metrics | \
  grep -E '^(vllm:(num_requests_running|num_requests_waiting|kv_cache_usage_perc|prompt_tokens_total|generation_tokens_total|request_success_total|time_to_first_token_seconds_(count|sum)|e2e_request_latency_seconds_(count|sum))|http_requests_total)'
nvidia-smi
```

Gate: The model list contains `qwen3-0.6b`, chat returns a completion, and metrics contain the request.
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
| No GPU | Host, Docker, sysctl, node capacity | Fix the host before you recreate Minikube. |
| Repeated Jobs | DaemonSet `hostPath`, node group `local.path` | Use the same path. Check parent directory access. |
| Download reports `Permission denied` | Cache path owner and mode | Repeat step 8. The parent must be `root:1000` and group-writable. |
| Download is `OOMKilled` | Download Pod | Confirm the chart memory limit is `4Gi`. |
| Cache remains `0/1` | Jobs, PVC, PV, node, controllers | Check labels, binding, disk, permissions, and model access. |
| Cache remains failed after a successful Job | Node-agent logs and identity | Repeat step 7. A Helm upgrade can remove the live patch. |
| vLLM reports invalid `/mnt/models` | `id` and `test -r /mnt/models/config.json` | Confirm the serving Pod has fsGroup `1000`. |
| Provider rejects the Instance | Instance and provider logs | Use `enabled`, `3Gi`, a valid group, and no `disableStorageInitializer`. |
| Model Pod fails after cache `1/1` | Pod events and `main` logs | Check the runtime image, GPU, memory, PVC, and arguments. |
| Chart disable stalls | Instance, service, cache, provider | Re-enable the chart. Disable every Instance cache first. |
| Instance starts while cache prepares | `.status.message`, `.status.copies` | Wait for `available == total` before evaluating serving readiness. |
## Evidence bundle
Run before cleanup. Save output with Job lists and replacement readiness.
```bash
printf 'provider_commit=%s bpf_original=%s\n' "$PROVIDER_COMMIT" "$ORIGINAL_BPF_JIT_HARDEN"
minikube version; kubectl version; helm list -A
kubectl get nodes -o wide; kubectl get crd | grep localmodel
kubectl -n "$PROVIDER_NS" get deployment,daemonset,pod -o wide
kubectl -n "$PROVIDER_NS" get daemonset kserve-localmodelnode-agent \
  -o jsonpath='{.spec.template.spec.securityContext}{"\n"}'
kubectl -n "$PROVIDER_NS" get deployment provider-kserve \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="provider")].image}{"\n"}'
kubectl get localmodelnodegroup,localmodelnode,pv -o wide
kubectl -n "$JOB_NS" get jobs,pods,pvc -o wide
kubectl -n "$INSTANCE_NS" get instance,llminferenceservice,localmodelnamespacecache,pod,svc -o wide
kubectl -n "$INSTANCE_NS" get localmodelnamespacecache "$INSTANCE" -o yaml
kubectl -n "$INSTANCE_NS" get llminferenceservice "$INSTANCE" -o yaml
kubectl -n "$INSTANCE_NS" get instance "$INSTANCE" -o yaml
kubectl -n "$INSTANCE_NS" logs "$MODEL_POD" -c main --tail=300
kubectl -n "$INSTANCE_NS" exec "$MODEL_POD" -c main -- curl -fsS http://127.0.0.1:8000/metrics
kubectl -n "$PROVIDER_NS" logs deployment/provider-kserve --tail=200
kubectl -n "$PROVIDER_NS" logs deployment/kserve-localmodel-controller-manager --tail=200
kubectl -n "$PROVIDER_NS" logs daemonset/kserve-localmodelnode-agent --tail=200
```

## Primary sources
- [PR #117](https://github.com/openeverest/provider-kserve/pull/117), [branch](https://github.com/atharvamhaske/provider-kserve/tree/feat/localmodel-cache), and [issue #108](https://github.com/openeverest/provider-kserve/issues/108)
- [KServe LocalModel](https://kserve.github.io/website/docs/model-serving/generative-inference/modelcache/localmodel) and [installation](https://kserve.github.io/website/docs/install/localmodel-install)
- [NVIDIA toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html), [sample](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/sample-workload.html), [Minikube NVIDIA tutorial](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/), and [start guide](https://minikube.sigs.k8s.io/docs/start/)
