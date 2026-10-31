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

The calendar file uses the venue-local time from the event listing. The supplied listing does not name a time zone.

## Abstract

Deploying an LLM on Kubernetes by hand is toil. This workshop flips that.

Apply one OpenEverest `Instance`. `provider-kserve` turns it into a KServe model server with an OpenAI-compatible API.

We will deploy Qwen3 0.6B on one NVIDIA GPU. We will cache the model on the node and call it through vLLM.

Then we will delete the serving Pod. The replacement Pod will reuse the cached model without another download Job.

## Speaker

Atharva Mhaske is a Backend and Infra Engineer at cld9.ai.

He is a Google Summer of Code 2026 mentee at OpenScienceLabs. He is also an OpenTelemetry community member and contributor.

His OpenTelemetry work focuses on Go compile-time instrumentation.

Atharva led and shipped the KServe provider for OpenEverest, a CNCF Sandbox project. The provider serves LLMs on Kubernetes.

He ran the OpenEverest booth at KubeCon India 2026 and speaks at CNCG Pune.

## The problem

A hand-built LLM deployment needs more than a Pod.

You need a model server, GPU scheduling, storage, model download, readiness, service discovery, credentials, status, and cleanup.

Each part has a different Kubernetes API. Each controller has a different failure mode.

The YAML grows before the first prompt reaches the model.

OpenEverest gives the user one resource. The provider translates that resource into the KServe objects that run the model.

## What we will build

```text
OpenEverest Instance
  -> provider-kserve
  -> KServe LLMInferenceService
  -> LocalModel cache
  -> vLLM Pod
  -> NVIDIA GPU
  -> OpenAI-compatible API
```

The demo uses these verified components:

| Component | Workshop value |
|---|---|
| Kubernetes | 1.35.0 on Minikube |
| OpenEverest | 2.0.0-dev.4 |
| KServe | 0.21.0 |
| Runtime | vLLM 0.26.0 |
| Model | `Qwen/Qwen3-0.6B` |
| GPU | NVIDIA RTX PRO 6000 Blackwell |
| Model cache | KServe LocalModel |
| API | `/v1/models` and `/v1/chat/completions` |

## The one resource

This `Instance` contains the user intent:

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: qwen-demo
spec:
  providerRef:
    name: provider-kserve
  topology:
    type: llm
  components:
    llmEngine:
      type: vllm
      replicas: 1
      parameters:
        modelURI: hf://Qwen/Qwen3-0.6B
        modelName: qwen3-0.6b
        computeProfile: gpu
        gpuCount: 1
        localModelCache:
          enabled: enabled
          modelSize: 3Gi
          nodeGroup: model-workers
```

The attendee does not create the serving Deployment, Service, cache PVC, local PV, or download Job by hand.

## What happens after apply

`provider-kserve` reads the `Instance` and creates a KServe `LLMInferenceService`.

KServe creates the LocalModel cache request. A download Job writes the model into node-local storage.

The cache reports one available copy. KServe mounts that copy into the vLLM Pod at `/mnt/models`.

vLLM loads Qwen3 from the mounted directory. It starts an OpenAI-compatible server on port 8000.

OpenEverest writes readiness and connection details back to the original `Instance`.

The final status is small and useful:

```yaml
status:
  components:
  - name: llmEngine
    readyReplicas: 1
    replicas: 1
  message: 'Model cache "qwen-demo": 1/1 nodes ready'
  phase: Ready
```

## Why cache the model

Container image reuse and model reuse are different.

The runtime image contains vLLM and its CUDA dependencies. The model cache contains the Qwen checkpoint and configuration.

A replacement Pod can reuse both. The demo checks that no new model download Job appears after Pod deletion.

Large model checkpoints make this distinction important.

## The request path

The workshop uses a direct port-forward to the workload Service.

```text
curl
  -> kubectl port-forward
  -> KServe workload Service
  -> vLLM Pod
  -> NVIDIA GPU
```

First, list the served models:

```bash
curl --fail-with-body http://localhost:8000/v1/models
```

Then send a chat request:

```bash
curl --fail-with-body http://localhost:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "qwen3-0.6b",
    "messages": [
      {
        "role": "user",
        "content": "Explain why model caching reduces cold-start latency."
      }
    ],
    "max_tokens": 96,
    "temperature": 0
  }'
```

The verified rehearsal recorded successful `2xx` responses for both API paths.

## Telemetry without another stack

vLLM publishes Prometheus metrics on `/metrics`.

The workshop reads them directly. It does not install Prometheus or Grafana during the 45-minute session.

The useful counters include prompt tokens, generated tokens, successful requests, time to first token, and full request latency.

The verified rehearsal processed three chat requests. It recorded 60 prompt tokens and 167 generated tokens.

`nvidia-smi` showed the vLLM engine using 20,172 MiB of GPU memory.

## The real edge in this demo

The model file path crosses three Linux identities.

The download Job writes the files. The LocalModel node agent inspects them. The vLLM container reads them.

The verified setup gives the cache group 1000. The serving Pod receives supplementary group 1000 through `fsGroup`.

Without that group, vLLM reports `/mnt/models` as an invalid local directory. The model exists, but the process cannot read it.

This is why the workshop waits for cache `1/1` before it checks the serving Pod.

## What the live demo proves

The following observed states complete the demo:

- Kubernetes reports one allocatable NVIDIA GPU.
- The CUDA smoke Pod prints `Test PASSED`.
- The LocalModel cache reports `1/1` copies.
- The OpenEverest `Instance` reports `Ready`.
- The vLLM Pod reads `/mnt/models/config.json`.
- `/v1/models` returns `qwen3-0.6b`.
- `/v1/chat/completions` returns a completion.
- vLLM metrics count the request.
- The replacement Pod gets a new UID.
- The replacement creates no new download Job.

## Follow the workshop

Start with the [Ubuntu GPU workshop prerequisites](ubuntu-gpu-workshop-prerequisites.md).

Open the [workshop presentation index](open-source-hub-workshop/) first.

The index links separate folders for the UI runbook, terminal runbook, and 45-minute teleprompter.

Use the [Ubuntu GPU LocalModel cache runbook](ubuntu-gpu-localmodel-runbook.md) for installation and cleanup.

Read [Ubuntu GPU LocalModel theory](ubuntu-gpu-localmodel-theory.md) for the controller, cache, request, and telemetry paths.

Read [Ubuntu GPU workshop decisions](ubuntu-gpu-workshop-decisions.md) for every version, identity, security, and cleanup choice.
When you record the final demo, use the [screenshot capture guide](one-click-llm-deployment-screenshot-guide.md).

## Bring to the session

Use a disposable native Ubuntu `x86_64` machine with one NVIDIA GPU.

Install Docker, the NVIDIA Container Toolkit, Minikube, kubectl, Helm, Git, Make, and Curl before the session.

Reserve at least 60 GiB of free disk space. First-time image pulls can take 30 to 90 minutes.

Do not use a shared production cluster.

## Calendar download

[Add to Calendar](assets/one-click-llm-deployment/one-click-llm-deployment.ics)

Final approval rests with the writer.
