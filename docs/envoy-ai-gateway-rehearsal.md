# Local Envoy AI Gateway rehearsal

Use this guide after the direct Qwen model path in [wsl-gpu-demo-runbook.md](wsl-gpu-demo-runbook.md) is ready.

Status: not yet verified in the WSL lab. Do not present gateway behavior as a completed result until every success gate below passes.

This rehearsal uses plain HTTP over localhost. It tests routing and API-key policy. It does not test public ingress, TLS, certificate issuance, or token quotas.

## What changes

The provider chart installs and configures:

- Envoy Gateway.
- Envoy AI Gateway, now also named Agent Router upstream.
- One shared Kubernetes `Gateway`.
- An Envoy proxy Service.
- A model-specific `AIGatewayRoute`.
- A generated API key and authorization policy.

The existing model Pod remains the backend. The gateway becomes a new request path in front of it.

```text
curl
  -> localhost port-forward
  -> Envoy proxy Service
  -> API-key authentication
  -> model authorization
  -> AIGatewayRoute
  -> KServe InferencePool
  -> vLLM Pod
  -> NVIDIA GPU
```

## Safety boundaries

- Keep the direct Service path working until the gateway path passes.
- Use `allowInsecureHTTP=true` only for this localhost rehearsal.
- Do not expose the HTTP listener to another machine or network.
- Do not print, commit, record, or screen-share the generated API key.
- Do not claim quota enforcement without Redis or Valkey.
- Do not claim TLS without a successful HTTPS test.

## 1. Set variables

Run these commands in WSL:

```bash
export PROFILE=everest-gpu
export PROVIDER_NS=provider-kserve
export INSTANCE_NS=default
export INSTANCE=qwen-demo
```

If the working Instance still uses another name or namespace, change only `INSTANCE` and `INSTANCE_NS`.

## 2. Confirm the direct model is healthy

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get instance "$INSTANCE"
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get pods
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get service "${INSTANCE}-kserve-workload-svc"
```

Stop if the Instance is not ready or the model Pod is not `1/1 Running`.

## 3. Check for an existing Envoy Gateway

```bash
helm list --all-namespaces
kubectl --context "$PROFILE" get gatewayclass
```

Do not install a second Envoy Gateway if one already controls `gateway.envoyproxy.io/gatewayclass-controller`. Two controllers with the same controller name can fight over Gateway resources.

The remaining commands assume that this cluster has no existing Envoy Gateway installation.

## 4. Save the current Helm values

```bash
helm --kube-context "$PROFILE" get values provider-kserve \
  --namespace "$PROVIDER_NS" \
  --all > /tmp/provider-kserve-before-gateway.yaml
```

This file can help compare or restore chart settings. It may contain environment-specific values, so do not commit it.

## 5. Install matching Gateway API CRDs

The provider chart pins Envoy Gateway v1.9.2, which uses Gateway API v1.6 CRDs.

```bash
rm -rf /tmp/envoy-gateway
mkdir -p /tmp/envoy-gateway
helm pull oci://docker.io/envoyproxy/gateway-helm \
  --version v1.9.2 \
  --untar \
  --destination /tmp/envoy-gateway
```

```bash
kubectl --context "$PROFILE" apply --server-side \
  -f /tmp/envoy-gateway/gateway-helm/charts/crds/crds/gatewayapi-crds.yaml
```

Verify the core CRDs:

```bash
kubectl --context "$PROFILE" get crd gateways.gateway.networking.k8s.io
kubectl --context "$PROFILE" get crd gatewayclasses.gateway.networking.k8s.io
kubectl --context "$PROFILE" get crd httproutes.gateway.networking.k8s.io
```

## 6. Enable the bundled gateway controllers

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
  --wait \
  --timeout 20m
```

This keeps API-key authentication enabled. It allows the keys over HTTP only because this request path stays on localhost.

## 7. Verify the gateway control plane

```bash
kubectl --context "$PROFILE" -n "$PROVIDER_NS" get pods
kubectl --context "$PROFILE" get gatewayclass
kubectl --context "$PROFILE" -n "$PROVIDER_NS" get gateway provider-kserve-ai-gateway
```

The Gateway must report `Accepted=True` and `Programmed=True` before continuing.

Inspect the generated proxy Service across namespaces:

```bash
kubectl --context "$PROFILE" get service --all-namespaces \
  -l gateway.envoyproxy.io/owning-gateway-name=provider-kserve-ai-gateway
```

## 8. Enable gateway access for the model

In the OpenEverest UI, set External access to `EnvoyAIGateway` when creating the Instance.

For an existing working Instance, apply the same setting through the API:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" patch instance "$INSTANCE" \
  --type merge \
  -p '{"spec":{"topology":{"parameters":{"externalAccess":"EnvoyAIGateway"}}}}'
```

Watch the Instance:

```bash
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get instance "$INSTANCE" -w
```

Stop the watch with `Ctrl+C` after it returns to ready.

Verify the generated route and connection Secret:

```bash
kubectl --context "$PROFILE" get aigatewayroute --all-namespaces
kubectl --context "$PROFILE" -n "$INSTANCE_NS" get secret "${INSTANCE}-conn"
```

## 9. Forward the Envoy proxy

Find the generated Service without hardcoding its generated name:

```bash
export GATEWAY_NS="$(kubectl --context "$PROFILE" get service --all-namespaces \
  -l gateway.envoyproxy.io/owning-gateway-name=provider-kserve-ai-gateway \
  -o jsonpath='{.items[0].metadata.namespace}')"
```

```bash
export GATEWAY_SVC="$(kubectl --context "$PROFILE" get service --all-namespaces \
  -l gateway.envoyproxy.io/owning-gateway-name=provider-kserve-ai-gateway \
  -o jsonpath='{.items[0].metadata.name}')"
```

Confirm both values are non-empty:

```bash
printf 'Gateway namespace: %s\nGateway service: %s\n' "$GATEWAY_NS" "$GATEWAY_SVC"
```

Keep this terminal running:

```bash
kubectl --context "$PROFILE" -n "$GATEWAY_NS" \
  port-forward "service/$GATEWAY_SVC" 18080:80
```

## 10. Load connection values safely

Open a second WSL terminal and set the variables again:

```bash
export PROFILE=everest-gpu
export INSTANCE_NS=default
export INSTANCE=qwen-demo
```

Load the key and model into shell variables. Do not echo `API_KEY`.

```bash
export API_KEY="$(kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get secret "${INSTANCE}-conn" \
  -o jsonpath='{.data.password}' | base64 --decode)"
```

```bash
export MODEL="$(kubectl --context "$PROFILE" -n "$INSTANCE_NS" \
  get secret "${INSTANCE}-conn" \
  -o jsonpath='{.data.model}' | base64 --decode)"
```

```bash
export GATEWAY_URL=http://127.0.0.1:18080/v1
printf 'Model: %s\nGateway URL: %s\n' "$MODEL" "$GATEWAY_URL"
```

## 11. Test an authenticated request

```bash
curl --fail-with-body "$GATEWAY_URL/chat/completions" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with: gateway ok /no_think\"}],\"chat_template_kwargs\":{\"enable_thinking\":false},\"max_tokens\":32}"
```

Success requires a completed response from the expected model.

## 12. Test authentication failure

Send the same request without a key:

```bash
curl -sS -o /dev/null -w 'missing key: %{http_code}\n' \
  "$GATEWAY_URL/chat/completions" \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
```

Expected:

```text
missing key: 401
```

## 13. Test model authorization failure

Use the valid key with a model that the key does not authorize:

```bash
curl -sS -o /dev/null -w 'wrong model: %{http_code}\n' \
  "$GATEWAY_URL/chat/completions" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"model":"not-authorized","messages":[{"role":"user","content":"Hello"}]}'
```

Expected:

```text
wrong model: 403
```

Clear the credential variable after testing:

```bash
unset API_KEY
```

## Success gate

The local gateway path is verified only when all results pass:

1. Gateway reports accepted and programmed.
2. Model Instance remains ready.
3. Authenticated chat completion succeeds.
4. Missing key returns HTTP 401.
5. Valid key with an unauthorized model returns HTTP 403.
6. Direct model Pod remains `1/1 Running`.

## What this does not prove

| Capability | Why it remains unverified |
|---|---|
| Public ingress | The proxy is reached through `kubectl port-forward`. |
| TLS | This rehearsal uses plain HTTP on localhost. |
| Certificate issuance | No ACME or private issuer is configured. |
| Token quota enforcement | Redis or Valkey is not configured. |
| High availability | The lab has one node, one gateway stack, and one model Pod. |
| Performance | No latency, throughput, concurrency, or load benchmark is run. |
| Network isolation | The direct workload Service remains reachable inside the cluster. |

## Common failures

### Helm refuses insecure authentication

Error:

```text
aiGateway.auth requires HTTPS
```

For this localhost-only rehearsal, confirm the upgrade contains:

```text
--set aiGateway.auth.allowInsecureHTTP=true
```

Do not use that setting on a shared endpoint.

### Gateway API resource type is missing

Install the matching Gateway API CRDs from step 5 before upgrading the provider chart.

### Two Envoy Gateway controllers compete

Do not enable the bundled `envoy-gateway` chart when another Envoy Gateway already uses the same controller name. Configure the existing controller with the extension-manager settings from provider-kserve instead.

### Gateway is not programmed

Inspect:

```bash
kubectl --context "$PROFILE" -n "$PROVIDER_NS" describe gateway provider-kserve-ai-gateway
kubectl --context "$PROFILE" -n "$PROVIDER_NS" get pods
```

Read conditions and events in time order. Do not repeatedly restart controllers without identifying the failed condition.

### Proxy Service lookup returns nothing

The Gateway has not finished programming, or the owning-Gateway label differs. List candidate Services:

```bash
kubectl --context "$PROFILE" get service --all-namespaces
```

### Connection Secret is missing

Confirm the Instance uses `externalAccess: EnvoyAIGateway`, then inspect its status and provider logs.

### Authenticated request returns 401

Reload the key from the current `${INSTANCE}-conn` Secret. The key may have rotated, or the shell may hold an old value.

### Authenticated request returns 403

Confirm the JSON `model` exactly matches the model from the connection Secret. Model names must be unique across the shared Gateway.

### Request returns 429

Quota enforcement requires a configured Redis or Valkey backend. If one exists, inspect the key and model quota before changing the model workload.

## Production differences

For production:

- Disable insecure HTTP.
- Configure HTTPS on the shared Gateway.
- Enable cert-manager Gateway API support.
- Use a DNS name and production-appropriate issuer.
- Use a real LoadBalancer implementation.
- Configure Redis or Valkey before claiming quotas.
- Define NetworkPolicies if the gateway must be the only request path.
- Validate key rotation, recovery, upgrades, monitoring, and load behavior.

## Sources

- [provider-kserve](https://github.com/openeverest/provider-kserve)
- [provider-kserve AI Gateway setup](https://github.com/openeverest/provider-kserve/blob/main/docs/ai-gateway-setup.md)
- [Envoy AI Gateway](https://aigateway.envoyproxy.io/)
- [Envoy Gateway](https://gateway.envoyproxy.io/)
- [Kubernetes Gateway API](https://gateway-api.sigs.k8s.io/)
