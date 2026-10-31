# Model creation and parallelism guide

Use this guide when an attendee asks why the demo uses a preset, when YAML is better, or what the parallelism fields mean.

## Best path for the live demo

Create `qwen-demo` from the `kserve-qwen-demo-gateway` preset card in the OpenEverest UI.

This is the best live path because it is visual, short, and repeatable. The preset fixes every value that the rest of the demo expects:

- Qwen3 0.6B.
- One GPU.
- One model replica.
- All parallel sizes set to `1`.
- Envoy AI Gateway access.
- A 300-token hourly quota per API key.
- vLLM metrics.

Do not build the live model from YAML. Do not submit a second Start from scratch form. Both paths create the same Kubernetes `Instance` name and can confuse the audience.

Use this presenter sequence:

1. Create `qwen-demo` from the preset card.
2. While the model loads, show the preset manifest and explain the defaults.
3. Open Start from scratch in a second unsaved form to explain the fields.
4. Close that form without selecting Create.
5. Show the checked-in `Instance` YAML as the automation alternative.

## Choose the correct creation method

| Method | Use it when | Avoid it when |
|---|---|---|
| UI preset card | You need a safe live demo or an approved standard configuration. | You need to change fields that the preset locks. |
| UI Start from scratch | You are exploring one model or teaching each field. | A team must reproduce and review the same configuration. |
| `InstancePreset` YAML | A platform owner wants to publish a reusable card in the UI. | You need to create a running model immediately. A preset alone creates no workload. |
| `Instance` YAML | You need GitOps, CI, code review, exact rehearsal, or advanced configuration. | The audience needs to see the UI workflow as the main story. |

The short answer for attendees is:

> Use a preset for a repeated approved setup. Use Start from scratch for exploration. Use an `Instance` manifest for automation and review.

## The two YAML files have different jobs

`manifests/instancepreset-qwen-demo-gateway.yaml` publishes the reusable UI card. It does not deploy a model.

`manifests/qwen-demo-terminal.yaml` creates the model `Instance`. It is the terminal alternative to selecting Create in the UI.

The UI resolves the selected preset and submits a complete `Instance.spec`. The resulting `Instance` does not depend on a runtime `presetRef`.

```text
InstancePreset YAML
        |
        v
OpenEverest preset card
        |
        | resolves the complete spec
        v
Instance qwen-demo
        |
        v
provider-kserve -> KServe -> vLLM
```

The Instance annotation records which preset supplied the values. Changing the preset after Instance creation does not rewrite that Instance.

## One owner for each Instance

Choose one owner for `qwen-demo`:

- the OpenEverest UI for the live workshop, or
- the checked-in `Instance` YAML for an automated rehearsal.

Do not create the same name through both paths. Do not place the Instance under GitOps and then make lasting UI edits. The GitOps controller will restore its declared YAML.

## Parallelism starts with the problem

Parallelism is not a quality setting. It solves a model-fit or throughput problem.

| Problem | First choice |
|---|---|
| The model fits on one GPU. | Keep every parallel size at `1`. |
| One model is too large for one GPU but fits on one multi-GPU node. | Use tensor parallelism. |
| One model is too large for one node. | Use tensor parallelism per node and pipeline parallelism across nodes. |
| Layer sizes split poorly across the available GPUs. | Consider pipeline parallelism with tensor size `1`. |
| One model copy fits, but traffic needs more capacity. | Add full replicas or tested autoscaling. |
| An advanced dense or MoE deployment needs coordinated engine ranks. | Evaluate data parallelism and its routing requirements. |
| A Mixture-of-Experts model needs expert sharding. | Evaluate expert parallelism with data parallelism. |

For this workshop, the model fits on one GPU. Keep `gpuCount`, tensor size, pipeline size, data size, and replicas at `1`.

## Field-by-field explanation

### GPUs per pod

`gpuCount` sets the `nvidia.com/gpu` limit for each vLLM head and worker pod.

On the GPU profile, provider-kserve defaults it to `1`. Provider validation checks only that `gpuCount` is at least `tensorParallelSize`.

That check is a minimum API rule, not complete runtime sizing. A single pod also needs GPUs for local pipeline or data ranks.

### Tensor parallel size

Tensor parallelism splits one model stage across GPUs. The GPUs exchange data during model execution.

Use it when one model does not fit on one GPU but fits on the GPUs in one node. Fast GPU interconnects matter because communication is frequent.

Example: `gpuCount: 4` and `tensorParallelSize: 4` use four GPUs for one model stage.

### Pipeline parallel size

Pipeline parallelism splits model layers into stages. The stages can run as local processes in one pod or across head-and-worker pods.

Without workers, all stages run in the head pod. That pod needs at least `tensorParallelSize x pipelineParallelSize` GPUs.

For provider-kserve multi-node serving, set both fields:

```yaml
pipelineParallelSize: 2
workerCount: 1
```

The pipeline size must equal `workerCount + 1`. Each pod runs one stage and needs at least `tensorParallelSize` GPUs.

Worker pods also require the LeaderWorkerSet controller. The checked-in workshop values leave `lws.enabled` off because the live model uses one pod.

Before using `workerCount`, install the provider's compatible LeaderWorkerSet `v0.8.0` path. Follow the [provider multi-node guide](https://github.com/openeverest/provider-kserve/blob/v0.5.0/docs/llm-multi-node.md) for a fresh install or an existing cluster.

A common multi-node layout uses tensor size equal to GPUs per node and pipeline size equal to node count.

### Data parallel size

Data parallelism creates separate vLLM engine ranks with replicated model weights. The ranks process independent request batches and keep separate KV caches.

provider-kserve `0.5.0` maps the global and local data sizes to the same value. The head pod needs at least `tensorParallelSize x dataParallelSize` GPUs.

Example: data size `2` with tensor size `2` needs four GPUs in that pod. Requests still need balancing across the data ranks.

provider-kserve does not allow data and pipeline parallel sizes to both exceed `1`.

Keep data parallel size at `1` in this workshop. Use it only after a separate capacity, routing, and failure test.

### Expert parallelism

Expert parallelism shards Mixture-of-Experts expert layers. It does not help this dense Qwen3 0.6B workshop model.

provider-kserve exposes it as `expertParallel`. It is an advanced choice, usually combined with data parallelism for MoE models.

### Replicas

`replicas` creates complete KServe workload copies. Each copy loads another set of model weights and has another KV cache.

A multi-node head-and-worker ring counts as one replica. Setting replicas to `2` creates two complete rings.

Use replicas for more traffic after one model copy is healthy. Do not use replicas to make one oversized model fit.

### Autoscaling

`minReplicas` and `maxReplicas` enable workload autoscaling and replace the fixed `replicas` setting.

provider-kserve `0.5.0` does not scale this workload to zero. Autoscaling also needs a tested metrics and actuator path.

Keep autoscaling off during the live demo.

### Prefill and decode disaggregation

Prefill and decode disaggregation creates separate workloads for prompt processing and token generation. It is not a replacement for tensor or pipeline parallelism.

Keep it off during this workshop. Add it only for a measured production workload with separate prefill and decode capacity needs.

## GPU planning examples

These examples keep prefill disaggregation off. Worker pods inherit the head GPU limit unless the table states otherwise.

| Layout | Settings | GPU demand for one model copy |
|---|---|---:|
| Workshop | `gpuCount=1`, `TP=1`, `PP=1`, `DP=1`, no workers | 1 GPU |
| One-node tensor parallel | `gpuCount=4`, `TP=4`, `PP=1`, `DP=1` | 4 GPUs |
| One-pod local pipeline | `gpuCount=4`, `TP=1`, `PP=4`, `DP=1`, no workers | 4 GPUs |
| One-pod local data parallel | `gpuCount=4`, `TP=2`, `PP=1`, `DP=2` | 4 GPUs |
| Two nodes with four GPUs each | `gpuCount=4`, `TP=4`, `PP=2`, `workerCount=1`, LWS enabled | 8 GPUs |
| Two replicas of the two-node layout | Same ring with `replicas=2` | 16 GPUs |

Use these local-layout rules:

```text
local pipeline GPUs = tensorParallelSize x pipelineParallelSize
local data GPUs = tensorParallelSize x dataParallelSize
```

For a head-and-worker layout with inherited GPU limits:

```text
pods per replica = 1 + workerCount
GPUs per replica = gpuCount x (1 + workerCount)
total static GPUs = replicas x GPUs per replica
```

If `workerResources` overrides the worker GPU limit, sum the head and worker limits instead:

```text
GPUs per replica = head GPU limit + (workerCount x worker GPU limit)
```

provider-kserve validates the tensor minimum but not every local product. Verify that each pod requests enough GPUs before applying a custom layout.

## What to say when attendees ask

### Why not use the default `kserve-qwen-gpu` preset?

It uses ClusterIP access. The workshop preset enables Envoy AI Gateway, HTTPS, per-application keys, quotas, and metrics.

### Why not create the model from YAML during the demo?

YAML is better for automation, but it hides the product workflow. The UI preset shows the audience what an application owner sees.

### Is the preset only a shortcut?

It is also a policy object. A platform owner can publish approved values as a reusable card and remove choices from the live path.

### Can I change the preset after the Instance exists?

You can change the preset for future creations. Existing Instances keep the complete spec that the UI submitted.

### Does more parallelism make responses better?

No. Parallelism changes model placement and request capacity. It does not improve model quality.

### When do I use tensor parallelism?

Use it when one model copy needs several GPUs in one node. Keep it at `1` when the model fits on one GPU.

### When do I use pipeline parallelism?

Use it when one model must span nodes or when a layer split works better than tensor sharding. Multi-node workers require matching pipeline fields and LeaderWorkerSet.

### When do I use data parallelism or replicas?

Use them for more request capacity, not model fit. Start with replicas because the Kubernetes ownership and failure boundary are easier to explain.

Use data parallelism only when the vLLM engine layout, routing, and model architecture justify it.

### What changes first in production?

Measure model fit, KV-cache capacity, queue depth, first-token latency, token throughput, GPU memory, and failure recovery. Then choose the smallest layout that meets the measured need.

## Source evidence

See [release-sources.md](release-sources.md#workshop-configuration-choices-and-vllm-parallelism) for pinned OpenEverest, provider-kserve, KServe, and vLLM sources.
