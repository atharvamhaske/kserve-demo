# Open Source Hub UI runbook

Use this runbook for the browser part of the 45-minute workshop.

Keep terminal work in the [terminal runbook](../terminal/).

## What the UI demonstration proves

The audience sees one OpenEverest form create a working LLM service.

The form selects the model, compute profile, cache, routing, and observability settings.

OpenEverest stores that intent in one `Instance`. The provider and KServe create the Kubernetes resources.

## Browser tabs

Open these tabs before the session:

| Tab | Address | Purpose |
|---|---|---|
| OpenEverest | `http://localhost:8080` | Create and inspect the model Instance. |
| Grafana | `http://localhost:3000` | Show vLLM request and latency metrics. |
| Workshop blog | Repository workshop page | Show the architecture and event links. |

Log in before recording. Do not show either login screen or password.

## Start on the Instances page

Open the OpenEverest Instances page.

Confirm that `qwen-demo` does not exist.

Click Create.

Select:

| Field | Value |
|---|---|
| Namespace | `default` |
| Name | `qwen-demo` |
| Provider | `provider-kserve` |
| Topology | `llm` |

Pause before the next section.

Explain that the provider supplies the topology and form schema.

## Select the model

Open Basic Information.

Click the Model selector.

Keep the model list open for several seconds. Point to the Hugging Face and OCI model choices.

Select `Qwen3 0.6B`.

Set:

| Field | Value |
|---|---|
| Image pull secret | Empty |
| Served Model Name | `qwen3-0.6b` |
| vLLM Runtime Version | Keep the provided default |

Explain that operators control the catalog through provider Helm values.

The frontend does not contain a fixed model list.

## Configure scaling

Open Scaling & Parallelism.

Set:

| Field | Value |
|---|---|
| Replicas | `1` |
| Autoscaling | Off |
| Tensor parallel size | `1` |
| Pipeline parallel size | `1` |
| Data parallel size | `1` |
| Expert parallelism | Disabled |
| Multi-node workers | Off |

Explain that this lab has one GPU. A second GPU Pod cannot run on this node.

Do not enable autoscaling during the workshop.

## Select the runtime

Open Runtime.

Set:

| Field | Value |
|---|---|
| Compute Profile | GPU |
| GPUs per pod | `1` |
| CPU | `2` |
| Memory | `6` GiB |
| CPU KV Cache Space | Empty |

Pause on Compute Profile.

Show the CPU and GPU choices. Keep GPU selected.

Explain that the compute profile changes the runtime configuration. It does not change the model catalog.

## Enable LocalModel caching

Open Model Cache.

Set:

| Field | Value |
|---|---|
| Enable model cache | Enabled |
| Model size | `3` GiB |
| LocalModelNodeGroup | `model-workers` |
| Download service account | Empty |

Explain the problem before the feature.

Without a node cache, a replacement Pod can download the model again.

LocalModel stores one copy on the selected node. A replacement Pod mounts the existing copy.

## Tune the engine

Open Engine Tuning. Open Context & batching.

Set:

| Field | Value |
|---|---|
| Max context length | `2048` |
| Max concurrent sequences | `1` |
| GPU memory utilization | `0.2` |

Keep precision and quantization on their defaults.

Explain that these values make the demonstration predictable. They are not benchmark recommendations.

## Select routing

Open Routing.

Set External access to `ClusterIP`.

Leave Tokens per User per Hour empty.

Open the selector and point to these choices:

- ClusterIP.
- LoadBalancer.
- NodePort.
- Envoy AI Gateway.

Keep ClusterIP selected.

State that this workshop verifies the direct Service path. It does not verify the Envoy AI Gateway path.

## Enable metrics

Open Observability.

Set:

| Field | Value |
|---|---|
| vLLM Prometheus metrics | On |
| Distributed tracing | Off |
| OTLP exporter endpoint | Empty |

Explain that the metrics toggle requests one `PodMonitor` for this model.

Prometheus Operator must already exist. The provider does not install Prometheus or Grafana.

## Add the cache identity

Open Advanced configuration.

Enter:

```yaml
template:
  securityContext:
    fsGroup: 1000
  containers:
    - name: main
      args:
        - --enforce-eager
```

Explain that the supplementary group lets vLLM read the cached model files.

Do not duplicate context length, sequence count, or GPU memory flags here. The Engine Tuning selectors set them.

## Review and create

Review these visible values:

- Model is `Qwen3 0.6B`.
- Compute Profile is GPU.
- GPUs per pod is `1`.
- Model cache is enabled.
- External access is ClusterIP.
- Prometheus metrics are on.

Take the model-selector screenshot before deployment.

Click Create.

Move to the terminal watch. Do not wait on a blank browser page.

## Inspect the ready Instance

Return to OpenEverest after the terminal reports cache `1/1` and Pod `1/1`.

Open `qwen-demo`.

Show:

- Phase `Ready`.
- One desired replica.
- One ready replica.
- Provider `provider-kserve`.
- Cache readiness in the status message.
- Connection details availability.

Do not open the connection Secret during recording.

## Show Grafana

Open the Grafana tab.

Click Dashboards, then Browse.

Open the dashboard with UID `provider-kserve-vllm`.

Set the time range to Last 5 minutes.

Set refresh to 5 seconds.

Show these panels:

- Token throughput.
- Running requests.
- Waiting requests.
- Time to first token.
- End-to-end latency.
- KV-cache use.
- Successful requests.
- Preemptions.

Ask the terminal operator to send one chat request.

Click Refresh after the request completes.

Point to the changed request and token counters.

## Show optional selectors

Return to OpenEverest after the cache reuse proof.

Start another Instance form. Do not submit it.

Point to these optional controls:

- CPU and GPU compute profiles.
- OCI model images in the Model selector.
- KEDA and HPA autoscaling actuators.
- LoRA adapters.
- Envoy AI Gateway routing.
- Distributed tracing.
- Multi-node workers.
- Prefill and decode disaggregation.

State that these are provider capabilities. Do not call them verified workshop results.

Close the unsaved form.

## UI failure rule

If Create returns an error, stop the UI path.

Show the prepared terminal proof or backup recording. Do not debug the form in front of the audience.

Capture the browser error after the session. Keep the failed object for investigation.

## Completion gate

Completion requires these visible results:

- A catalog-backed model selector.
- One submitted `Instance`.
- Ready status in OpenEverest.
- A populated vLLM dashboard after a real request.
- Optional controls without unsupported claims.

Final approval rests with the writer.
