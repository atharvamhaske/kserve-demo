# Workshop Helm values

These files configure installed charts. They do not create the `qwen-demo` model.

| File | Controls |
|---|---|
| `provider-kserve.yaml` | KServe metrics, Envoy Gateway, Envoy AI Gateway, authentication, rate-limit storage, and LoadBalancer access. |
| `monitoring.yaml` | Prometheus and Grafana settings required by the demo. |

The scripts add TLS hostname and issuer values during the HTTPS stage. Keep secrets out of these files.

Use [manifests/instancepreset-qwen-demo-gateway.yaml](../manifests/instancepreset-qwen-demo-gateway.yaml) to change the reusable model preset.

Read [Model creation and parallelism guide](../model-configuration-guide.md) before changing model layout fields.
