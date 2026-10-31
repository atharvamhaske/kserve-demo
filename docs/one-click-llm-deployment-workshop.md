# One-Click LLM Deployment on Kubernetes

## Hands-on with OpenEverest and KServe

| Event | Details |
|---|---|
| Date | November 6, 2026 |
| Time | 1:30 PM to 2:15 PM |
| Venue | Open Source Hub |
| Format | Hands-on workshop |
| Speaker | Atharva Mhaske |

## Add this workshop to your calendar

[Add to Calendar](assets/one-click-llm-deployment/one-click-llm-deployment.ics)

The calendar file uses the venue-local time from the event listing. The listing does not name a time zone.

## Abstract

An LLM deployment needs more than one container.

Kubernetes must schedule a GPU, start a model server, expose a Service, report status, and publish metrics.

In this workshop, we create one OpenEverest `Instance` through the UI.

`provider-kserve` turns that intent into a KServe `LLMInferenceService`. KServe creates the vLLM workload and Service.

We call Qwen3 0.6B through an OpenAI-compatible API. Then we inspect vLLM metrics in Prometheus and Grafana.

This workshop uses direct model delivery and adds no persistent model-delivery component.

## The problem

Without a platform contract, users must understand several APIs:

- Kubernetes GPU resources.
- KServe serving resources.
- vLLM runtime flags.
- Model locations and names.
- Services and routing.
- Prometheus discovery.
- Health and readiness status.

OpenEverest presents these choices in one provider-backed form.

The abstraction does not hide Kubernetes. Every generated resource remains visible through `kubectl`.

## Architecture

```text
OpenEverest UI
  -> OpenEverest Instance
  -> provider-kserve 0.5.0
  -> KServe LLMInferenceService 0.21.0
  -> Deployment, Service, and vLLM Pod
  -> NVIDIA GPU
  -> OpenAI-compatible API
  -> PodMonitor, Prometheus, and Grafana
```

The controllers create and repair resources. They are not in the inference request path.

## Current workshop releases

| Component | Version |
|---|---:|
| OpenEverest | `2.0.0-dev.4` Developer Preview |
| provider-kserve | `0.5.0` |
| KServe | `0.21.0` |
| Kubernetes | `v1.36.6` |
| Minikube | `v1.39.0` |
| cert-manager | `v1.21.3` |
| kube-prometheus-stack | `92.16.1` |
| Prometheus | `v3.15.1` |
| Grafana | `13.3.0` |

OpenEverest stable v1.17.0 does not support provider-kserve 0.5.0.

The workshop uses the newest compatible OpenEverest v2 Developer Preview on a fresh cluster.

Minikube 1.39 defaults to Kubernetes 1.37. The provider supports Kubernetes through 1.36, so the runbook pins 1.36.6.

## UI deployment

The live workflow starts on the OpenEverest Instances page.

We select:

| Field | Value |
|---|---|
| Provider | `provider-kserve` |
| Topology | `llm` |
| Model | `Qwen3 0.6B` |
| Served model name | `qwen3-0.6b` |
| Compute profile | GPU |
| GPUs per Pod | `1` |
| Replicas | `1` |
| External access | ClusterIP |
| Prometheus metrics | On |

The provider supplies the model catalog and form schema.

Operators can change the catalog through provider Helm values. The frontend does not contain a fixed model list.

## What one Instance creates

The UI stores one `Instance` resource.

The provider creates an `LLMInferenceService`. KServe creates the Deployment, Service, storage initializer, and vLLM Pod.

The storage initializer downloads the public Qwen model for the Pod.

The provider reports workload status back to the original `Instance`.

The same form also exposes CPU serving, autoscaling, OCI model images, LoRA, tool calling, reasoning, AI Gateway routing, tracing, and multi-node workers.

Those optional paths need separate infrastructure or verification. The workshop does not call them verified results.

## OpenAI-compatible API

After the Pod becomes ready, the workshop calls:

```text
GET /v1/models
POST /v1/chat/completions
```

The model list must contain `qwen3-0.6b`.

The chat response proves that routing, model delivery, vLLM startup, and GPU inference work together.

## Monitoring

When the Prometheus Operator CRD exists, provider-kserve creates one `PodMonitor`.

Prometheus scrapes vLLM on port 8000. Grafana shows:

- Prompt and generated token throughput.
- Running and waiting requests.
- Time to first token.
- End-to-end request latency.
- Successful requests.
- Preemptions.

A ready Pod does not prove useful inference. The workshop checks the API and request metrics.

## Live schedule

| Time | Content |
|---|---|
| 0 to 5 minutes | Problem, architecture, and one-resource idea |
| 5 to 12 minutes | OpenEverest UI and model selector |
| 12 to 20 minutes | Deploy and explain the controller chain |
| 20 to 25 minutes | OpenAI-compatible API request |
| 25 to 32 minutes | Grafana and vLLM metrics |
| 32 to 38 minutes | Inspect generated Kubernetes resources |
| 38 to 42 minutes | Show optional UI selectors |
| 42 to 45 minutes | Questions |

## What the demonstration proves

- The host and container runtime can use the NVIDIA GPU.
- Kubernetes advertises the GPU.
- The released provider registers with OpenEverest.
- The UI creates one `Instance`.
- KServe creates a ready vLLM workload.
- `/v1/models` returns `qwen3-0.6b`.
- Chat completion returns assistant text.
- Prometheus scrapes the vLLM Pod.
- Grafana shows the completed request.

This is a functional workshop result. It is not a performance benchmark or production-readiness claim.

## Follow the workshop

Use the [all-in-one runbook](open-source-hub-workshop/) for every command, UI step, speaker cue, recovery check, and cleanup action.

Read the [release sources](open-source-hub-workshop/release-sources.md) for compatibility evidence.

Use the [screenshot guide](one-click-llm-deployment-screenshot-guide.md) during the final rehearsal.

## Speaker

Atharva Mhaske is a Backend and Infra Engineer at cld9.ai.

He is a Google Summer of Code 2026 mentee at OpenScienceLabs. He is also an OpenTelemetry community member and contributor.

Final approval rests with the writer.
