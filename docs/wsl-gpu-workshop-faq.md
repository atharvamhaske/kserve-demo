# WSL GPU workshop FAQ

Use this document to prepare the talk, answer technical questions, and avoid claims that the lab did not prove. The repeatable procedure is in [the demo runbook](wsl-gpu-demo-runbook.md). The observations and failed paths are in [the lab findings](wsl-gpu-lab-findings.md).

## Evidence labels

- Verified in this lab: observed on the pinned WSL and Minikube setup.
- Repository behavior: implemented or configured in this repository, but not necessarily exercised in this lab.
- Upstream capability: documented by the upstream project, but not necessarily exercised here.
- Not verified: do not present it as a demo result.

## One-minute project explanation

OpenEverest gives users one `Instance` API and UI for different Kubernetes operators. This provider adds model serving through KServe. A user creates an `Instance` with the `llm` or `predictor` topology. The provider validates that request and creates a KServe `LLMInferenceService` or `InferenceService`. KServe then creates the Deployment, Pod, Service, and optional routing resources. The provider reads KServe and workload status and reports it on the `Instance`.

The provider and KServe controllers are control-plane components. They do not process each inference request. In the verified lab, a Mac request crossed an SSH tunnel and a `kubectl port-forward`, reached a ClusterIP Service, and then reached a vLLM Pod on the NVIDIA GPU. That direct Service path worked. The optional Envoy AI Gateway path has routing, API-key, quota, and TLS support in this repository, but the WSL lab has not exercised it.

## Architecture diagrams

### Control plane

```text
Presenter or OpenEverest UI
  -> OpenEverest Instance
  -> provider-kserve validation and reconciliation
  -> KServe LLMInferenceService or InferenceService
  -> KServe controller reconciliation
  -> Deployment, Pod, Service, and optional routing resources
  -> provider-kserve reads resource and workload status
  -> OpenEverest Instance status
```

The provider creates and updates KServe resources. KServe owns the model-serving workloads. Kubernetes controllers continuously reconcile desired state with current state.

### Verified data plane

```text
Mac curl
  -> SSH local forward
  -> Windows OpenSSH
  -> WSL kubectl port-forward
  -> Kubernetes ClusterIP Service
  -> KServe-managed vLLM Pod
  -> NVIDIA GPU
  -> response returns on the same path
```

Neither OpenEverest, provider-kserve, nor the KServe controller is in this per-request path.

### Optional gateway data plane, not verified in this WSL lab

```text
Client
  -> Envoy proxy Service and Gateway listener
  -> API-key authentication and model authorization
  -> AIGatewayRoute selects the request body model
  -> KServe InferencePool and endpoint picker
  -> vLLM Pod
```

This diagram describes repository behavior and upstream APIs. It is not a WSL lab result.

## Project and provider architecture
1. What problem does provider-kserve solve? It translates an OpenEverest `Instance` into KServe resources and reports workload status.
2. Is provider-kserve a model server? No. vLLM or a KServe runtime handles inference. The provider supplies reconciliation and configuration.
3. Can I install this chart without OpenEverest? No. It requires the OpenEverest CRDs, controller, and provider runtime.
4. Which topologies does the provider expose? `llm` creates an `LLMInferenceService`. `predictor` creates an `InferenceService`.
5. Does the provider manage Pods directly? No. KServe and Kubernetes create and manage the Deployments, Pods, and Services.
6. Where does desired configuration live? It starts in the `Instance`. Provider definitions supply schemas, versions, components, presets, and UI choices.
7. Where does readiness come from? The provider combines KServe status with workload readiness. The lab remained `Provisioning` without a ready Pod.

## Kubernetes and KServe
8. Why use a custom resource instead of a Deployment? It keeps model, runtime, scaling, routing, and status in one declarative API.
9. What did KServe create in the lab? Verified: an `LLMInferenceService`, Deployment, port 8000 Service, and GPU-backed Pod.
10. What is KServe Standard mode here? It uses normal Kubernetes Deployments and Services without Knative. KServe formerly called it RawDeployment.
11. Does this setup scale to zero? No. The lab used one replica. These provider scaling paths require a minimum of one.
12. Why request `nvidia.com/gpu: 1`? The NVIDIA device plugin advertises that extended resource for Kubernetes scheduling.
13. Is `kubectl port-forward` ingress? No. It is temporary debug access and does not prove ingress or gateway behavior.
14. Can controller status and Pod readiness disagree? Yes, briefly. The lab saw KServe report ready before the workload Pod was ready.

## Model, runtime, and GPU
15. Which model and runtime worked? Verified: `Qwen/Qwen3-0.6B` on vLLM 0.26.0 in `ghcr.io/llm-d/llm-d-cuda:v0.9.0`.
16. Why use Qwen3 0.6B? It shortens compatibility work but still proves GPU-backed model loading and inference.
17. Which WSL settings worked? `VLLM_USE_V2_MODEL_RUNNER=0`, `TRITON_LIBCUDA_PATH=/usr/local/cuda-13.0/compat`, and `--enforce-eager`.
18. Which capacity limits worked? Maximum model length 2048, maximum sequences 1, and GPU memory utilization 0.7.
19. Why disable the V2 runner? vLLM 0.26.0 failed in `UvaBuffer` because UVA was unavailable. The V1 runner passed that point.
20. Why use `--enforce-eager`? It avoided the observed Torch Inductor and CUDA Graph path. It reduces performance and is a lab workaround.
21. Why must `TRITON_LIBCUDA_PATH` name a directory? Triton uses it as a linker search directory. A library filename made an invalid `-L` argument.
22. Does a model in VRAM prove server readiness? No. A later Triton link failure can still block the API server.
23. Did the lab test Qwen's full context? No. The demo capped maximum model length at 2048.
24. Does the result prove model quality or throughput? No. It proves one completion, not quality, latency, concurrency, throughput, or cost.

## WSL and remote access
25. Why not install a Linux NVIDIA driver in WSL? NVIDIA directs WSL users to use the Windows driver exposed inside WSL.
26. Which GPU layers did the lab prove? WSL visibility, Docker CUDA work, Kubernetes GPU allocation, and model-container GPU use.
27. Why use Docker Engine inside WSL? It supported remote work without physical access to Docker Desktop settings.
28. Why use a separate Docker CLI configuration? The inherited Windows credential helper failed over SSH. An isolated WSL configuration avoided it.
29. Why are there two forwards? `kubectl port-forward` exposes the Service in WSL. SSH carries that port to the presenter machine.
30. Is this remote path production security? No. It is not public ingress, TLS termination, identity, or a production network design.

### Minikube, kind, or kubeadm?

provider-kserve is Kubernetes-distribution agnostic. GPU runtime setup and `LoadBalancer` handling are not.

| Choice | Fit for this demo |
|---|---|
| Minikube with Docker | Recommended. Its documented `--gpus=all` path is verified in this WSL lab. |
| kind | GPU passthrough is possible but brittle. It is not a first-class equivalent to Minikube GPU support. |
| kubeadm | More production-like on native Linux. It needs containerd, CNI, NVIDIA runtime and device plugin, control-plane taint handling, and a LoadBalancer implementation. |

Keep Minikube for the workshop. Evaluate kubeadm only in a separate native-Linux environment.

## Envoy AI Gateway, routing, authentication, quotas, and TLS
31. Did this lab use Envoy AI Gateway? No. The successful request used the direct KServe workload Service.
32. What gateway behavior does the repository implement? A shared Gateway, routes, per-Instance keys, model authorization, metering, and optional quotas.
33. How does the gateway select an LLM? An `AIGatewayRoute` matches the OpenAI `model` value and targets a KServe `InferencePool`.
34. Are API keys verified here? No. Code generates a key and fail-closed `SecurityPolicy`, but the WSL path did not test them.
35. What should 401 and 403 mean? Repository docs define 401 for a missing or unknown key and 403 for a disallowed model.
36. Are token quotas active by default? No. Enforcement requires an external Redis-compatible or Valkey service.
37. Was TLS verified? No. The chart supports cert-manager Gateway TLS, but this lab did not issue or use a certificate.
38. Does gateway TLS encrypt backend traffic? No. It terminates the client connection. Backend TLS requires separate configuration.
39. Did the lab verify public access? No. It used ClusterIP Services, localhost forwarding, and SSH.

## Operations and debugging
40. What is the readiness proof gate? Require a ready `Instance`, a `1/1 Running` model Pod, and a successful real request.
41. What should I inspect when startup stalls? Pod phase, init state, ordered events, model logs, and the generated `LLMInferenceService`.
42. Does `PodInitializing` mean inference is running? No. Image pull, storage initialization, or model download can still be active.
43. Is `Insufficient nvidia.com/gpu` always permanent? No. The old Pod can hold the GPU until it terminates.
44. Why avoid a cold start on stage? The runtime image is large, and replacement Pods redownloaded models from ephemeral storage.
45. How do I prove GPU use? Run `nvidia-smi` in the ready model container and pair it with a successful request.
46. What does an unknown-model error prove? Application validation while the Pod stays healthy, not gateway authorization on the direct path.

## Production readiness
47. Is this production-ready? No. The repository labels OpenEverest v2 and this provider pre-alpha, with no supported upgrade path.
48. What production work remains? Validate HA, caching, capacity, upgrades, recovery, security, monitoring, SLOs, and supported hardware under load.

## Demo limitations
49. Does the lab prove multi-replica or multi-node serving? No. It used one Pod and one GPU.
50. Does it prove restart or upgrade safety? No. No failure-recovery or upgrade campaign was performed.
51. Did it verify streaming output? No. The final lab record proves a completed non-streaming chat response.
52. What narrow claim is defensible? The pinned stack served one Qwen3 0.6B completion through a direct Service.

## Hostile or skeptical questions
53. Is this only a complicated Deployment wrapper? It adds a shared API, validation, KServe resources, status translation, and optional routing.
54. Why trust four WSL workarounds? Do not generalize them. Revalidate each one when vLLM, CUDA, or the image changes.
55. Are you hiding gateway failures with port-forwarding? No. The gateway was outside the verified path, and the talk states that boundary.
56. Does eager mode make the demo misleading? Only if presented as a benchmark. This is a functional demo with no performance claim.
57. Why use a pre-alpha provider? Use it for evaluation and contribution, not as an unsupported production dependency.
58. Does one answer prove reliability? No. Reliability needs repetition, fault injection, load tests, monitoring, and recovery evidence.

## Verified and unverified matrix

| Claim | Status | Evidence or boundary |
|---|---|---|
| WSL exposes the NVIDIA GPU | Verified in this lab | `nvidia-smi` listed the GPU |
| Docker can execute CUDA | Verified in this lab | NVIDIA vector-add printed `Test PASSED` |
| Kubernetes can allocate and execute on the GPU | Verified in this lab | A Pod requested one GPU and completed vector-add |
| OpenEverest and provider-kserve reconcile the model | Verified in this lab | The Instance produced KServe and workload resources |
| Qwen3 0.6B loads through vLLM 0.26.0 | Verified in this lab | Model load and GPU memory use were observed |
| Direct `/v1/models` and chat completion work | Verified in this lab | Requests succeeded through the workload Service port-forward |
| Streaming chat works | Not verified | Present only as a runbook step |
| Envoy AI Gateway routing works on this WSL cluster | Not verified | Repository and upstream capability only |
| API-key 401 and model-authorization 403 work here | Not verified | Rehearsal below still needs execution |
| Token quotas return 429 | Not verified | Requires Redis or Valkey, which the lab did not configure |
| TLS and certificate issuance work | Not verified | No HTTPS listener or certificate was exercised |
| Public ingress, DNS, or LoadBalancer access works | Not verified | The lab used local forwards and ClusterIP |
| Scale-to-zero works | Not verified and not supported by these provider paths | Minimum replica count is at least one |
| HA, multi-node serving, load capacity, and upgrades work | Not verified | One node, one Pod, one GPU, no load test |
| Persistent model cache survives Pod replacement | Not verified | Observed model storage was ephemeral |

## Local Minikube Envoy AI Gateway rehearsal

Status: not verified in the WSL lab. Run this as a separate rehearsal before making any gateway claim. It uses insecure HTTP only on a local port-forward. It does not test TLS, public ingress, or quotas.

The current repository pins Envoy Gateway v1.9.2. Install its matching Gateway API v1.6 CRDs first:

```bash
mkdir -p /tmp/envoy-gateway
helm pull oci://docker.io/envoyproxy/gateway-helm \
  --version v1.9.2 --untar -d /tmp/envoy-gateway
kubectl --context "$PROFILE" apply --server-side \
  -f /tmp/envoy-gateway/gateway-helm/charts/crds/crds/gatewayapi-crds.yaml
```

Upgrade the installed chart 0.4.3 and enable the bundled gateway controllers:

```bash
helm upgrade provider-kserve \
  oci://ghcr.io/openeverest/charts/provider-kserve \
  --kube-context "$PROFILE" \
  --namespace "$PROVIDER_NS" \
  --version 0.4.3 \
  --reuse-values \
  --set envoy-gateway.enabled=true \
  --set envoy-ai-gateway.enabled=true \
  --set aiGateway.enabled=true \
  --set aiGateway.gatewayService.type=ClusterIP \
  --set aiGateway.auth.allowInsecureHTTP=true \
  --wait --timeout 20m
```

`allowInsecureHTTP=true` is only for this localhost rehearsal. Do not use it for a shared or production endpoint.

Select `EnvoyAIGateway` for the existing model without changing its verified runtime settings:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" patch instance "$INSTANCE" \
  --type merge \
  -p '{"spec":{"topology":{"parameters":{"externalAccess":"EnvoyAIGateway"}}}}'
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get instance "$INSTANCE" -w
```

Find the generated Envoy proxy Service and forward it. Keep this command running:

```bash
GATEWAY_SVC="$(kubectl --context "$PROFILE" -n "$PROVIDER_NS" get service \
  -l gateway.envoyproxy.io/owning-gateway-name=provider-kserve-ai-gateway \
  -o jsonpath='{.items[0].metadata.name}')"
kubectl --context "$PROFILE" -n "$PROVIDER_NS" \
  port-forward "service/$GATEWAY_SVC" 18080:80
```

In another WSL terminal, read the generated connection values without printing them:

```bash
API_KEY="$(kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get secret "${INSTANCE}-conn" -o jsonpath='{.data.password}' | base64 --decode)"
MODEL="$(kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get secret "${INSTANCE}-conn" -o jsonpath='{.data.model}' | base64 --decode)"
```

Test a successful authenticated request:

```bash
curl --fail-with-body http://localhost:18080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with: gateway ok\"}],\"max_tokens\":16}"
```

Test the authentication and authorization boundaries. The expected codes are 401 and 403:

```bash
curl -sS -o /dev/null -w 'missing key: %{http_code}\n' \
  http://localhost:18080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"

curl -sS -o /dev/null -w 'wrong model: %{http_code}\n' \
  http://localhost:18080/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model":"not-authorized","messages":[{"role":"user","content":"Hello"}]}'
unset API_KEY MODEL
```

Do not mark the gateway as verified unless the authenticated request succeeds and both negative tests return the expected codes. Quota testing also needs Redis or Valkey. TLS needs a separate HTTPS rehearsal with cert-manager.

## Live-demo checklist

Before the session:
- Use the pinned versions in the [runbook](wsl-gpu-demo-runbook.md).
- Keep the Qwen3 0.6B Pod warm. Confirm `Ready`, `1/1 Running`, `/v1/models`, one chat request, and in-container `nvidia-smi`.
- Open the UI and both forwarding sessions before screen sharing.
- Keep terminals free of credentials and host details. Record a backup video and non-secret screenshots.
- Do not add the gateway rehearsal to the live claim until it passes separately.

On stage:
1. Show the ready OpenEverest Instance.
2. Show the `LLMInferenceService`, Deployment, Pod, and Service.
3. Show `nvidia-smi` in the model container.
4. Run one short chat completion.
5. Show an unknown-model error while the Pod remains healthy.
6. Name every forwarding layer accurately from the data-plane diagram.

## Fallback talking points
- UI unavailable: show the same `Instance` and status with `kubectl`.
- SSH forwarding fails: use the diagram and recording. Do not change the cluster on stage.
- Pod restarts: explain image pull, model download, UVA, eager mode, and Triton linking from the findings.
- Cold pull is slow: explain that the runtime image is much larger than the 0.6B checkpoint.
- Gateway question: show the repository design and unverified rehearsal. Do not call it a lab result.
- Performance question: the lab did not run a benchmark.

## Primary sources
Repository evidence:
- [provider-kserve README](https://github.com/openeverest/provider-kserve/blob/main/README.md), [provider reconciliation](https://github.com/openeverest/provider-kserve/blob/main/internal/provider/provider.go), [gateway routing and quotas](https://github.com/openeverest/provider-kserve/blob/main/internal/provider/aigateway.go), and [gateway authentication](https://github.com/openeverest/provider-kserve/blob/main/internal/provider/gatewayauth.go)
- [Chart values](https://github.com/openeverest/provider-kserve/blob/main/charts/provider-kserve/values.yaml), [chart dependencies](https://github.com/openeverest/provider-kserve/blob/main/charts/provider-kserve/Chart.yaml), [demo runbook](wsl-gpu-demo-runbook.md), and [lab findings](wsl-gpu-lab-findings.md)

Official upstream documentation:
- [OpenEverest provider model](https://openeverest.io/documentation/2.0.0-dev.2/extend/providers.html)
- KServe [control plane](https://kserve.github.io/website/docs/concepts/architecture/control-plane), [LLMInferenceService](https://kserve.github.io/website/docs/model-serving/generative-inference/llmisvc/llmisvc-configuration), and [Standard autoscaling](https://kserve.github.io/website/docs/model-serving/predictive-inference/autoscaling/hpa-autoscaler)
- Kubernetes [GPU scheduling](https://kubernetes.io/docs/tasks/manage-gpus/scheduling-gpus/), [Services](https://kubernetes.io/docs/reference/networking/virtual-ips/), and [port-forwarding](https://kubernetes.io/docs/tasks/access-application-cluster/)
- NVIDIA [CUDA on WSL](https://docs.nvidia.com/cuda/wsl-user-guide/index.html) and [Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
- [Minikube NVIDIA GPU guide](https://minikube.sigs.k8s.io/docs/tutorials/nvidia/)
- Cluster alternatives: [kind configuration](https://kind.sigs.k8s.io/docs/user/configuration/) and [kubeadm cluster creation](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/)
- vLLM 0.26.0 [configuration](https://docs.vllm.ai/en/v0.26.0/api/vllm/config/) and [environment variables](https://docs.vllm.ai/en/v0.26.0/configuration/env_vars/)
- [Qwen3 0.6B model card](https://huggingface.co/Qwen/Qwen3-0.6B)
- Envoy AI Gateway [API](https://aigateway.envoyproxy.io/docs/latest/api/) and [traffic capabilities](https://aigateway.envoyproxy.io/docs/0.4/capabilities/traffic/)
- [cert-manager Gateway API usage](https://cert-manager.io/docs/usage/gateway/)
