# Open Source Hub workshop teleprompter

Use this script for the 45-minute session.

Keep the [UI runbook](../ui/) and [terminal runbook](../terminal/) open beside it.

## Session promise

The session proves one claim:

> One OpenEverest Instance can become a cached, observable KServe LLM service with an OpenAI-compatible API.

## Problems and proof

| Problem | Workshop feature | Proof |
|---|---|---|
| LLM deployment needs many Kubernetes objects. | One OpenEverest `Instance`. | The UI submits one resource. Controllers create the rest. |
| Users must know model URIs and runtime details. | Provider model and runtime selectors. | The UI selects Qwen3 0.6B and GPU compute. |
| Pod replacement can repeat a large model download. | KServe LocalModel cache. | The replacement creates no new download Job. |
| A ready Pod can still hide request failures. | OpenAI API checks and vLLM metrics. | Chat succeeds and counters increase. |
| GPU model servers are hard to observe. | PodMonitor and Grafana dashboard. | Grafana shows tokens, requests, cache use, and latency. |

## 0:00 to 5:00: problem and architecture

Screen: Workshop architecture in the blog.

Say:

> Deploying an LLM on Kubernetes is not one Pod.

Say:

> We need GPU scheduling, a model server, storage, download logic, readiness, networking, status, and monitoring.

Say:

> Each part has a different API and a different failure mode.

> Today I will create one OpenEverest Instance through the UI.

Say:

> provider-kserve will translate that intent into KServe resources.

> KServe will create the workload, Service, model cache, and supporting storage.

Point to this path:

```text
OpenEverest Instance
  -> provider-kserve
  -> KServe LLMInferenceService
  -> LocalModel cache
  -> vLLM Pod
  -> NVIDIA GPU
  -> OpenAI-compatible API
```

Say:

> The controllers stay out of the request path.

> They create and repair the resources. The client sends requests directly to the model Service.

> This is a functional demonstration on one GPU. It is not a production benchmark.

Transition:

> Let us create the model without writing the serving Deployment by hand.

## 5:00 to 12:00: OpenEverest UI and model selector

Screen: OpenEverest Instances page.

Do: Click Create.

Say:

> I am creating an Instance in the default namespace.

> The selected provider is provider-kserve. The selected topology is LLM.

Do: Open the Model selector.

Say:

> This model list comes from the provider configuration.

> Operators can change the catalog through Helm values. The frontend does not contain a fixed list.

> I will select Qwen3 0.6B. It is public, small, and needs no Hugging Face token.

Do: Select Qwen3 0.6B and set the served name.

Say:

> The served name becomes the model value in OpenAI-compatible requests.

Do: Open Scaling & Parallelism.

Say:

> This lab has one GPU, so I will run one replica with one-way tensor parallelism.

Say:

> Autoscaling stays off because a second GPU Pod cannot fit on this node.

Do: Open Runtime and select GPU.

Say:

> The same provider exposes CPU and GPU profiles.

> The GPU profile requests one `nvidia.com/gpu` resource from Kubernetes.

Do: Open Model Cache and enable it.

Say:

> The next problem is model download time.

> A container image and a model checkpoint are different artifacts.

Say:

> LocalModel downloads one model copy to the selected node and reports its status.

Say:

> A replacement Pod can mount that copy instead of starting another download Job.

Do: Open Engine Tuning.

Say:

> I am limiting context length and concurrency to keep this workshop predictable.

> These values are demonstration limits. They are not performance recommendations.

Do: Open Routing and choose ClusterIP.

Say:

> The provider also exposes LoadBalancer, NodePort, and Envoy AI Gateway options.

> This session verifies ClusterIP through a local port-forward.

Do: Open Observability and enable vLLM Prometheus metrics.

Say:

> This asks the provider to create a PodMonitor for this model.

> Prometheus and Grafana are already installed. The provider does not install them.

Do: Add the Advanced cache identity configuration.

Say:

> The supplementary group lets the vLLM process read files written by the cache Job.

Transition:

> One form now contains the model, compute, cache, routing, and observability intent.

## 12:00 to 20:00: deploy and explain the controller chain

Screen: UI review page.

Say:

> I will submit one Instance now.

Do: Click Create.

Screen: Terminal resource watches.

Say:

> OpenEverest stores the Instance. provider-kserve watches it and creates a KServe LLMInferenceService.

Say:

> KServe creates the model cache request, download Job, storage, Deployment, Service, and serving Pod.

Point to each resource as it appears.

Say:

> The download Job is not the serving Pod.

> Its job is to place the model on node-local storage.

Say:

> The cache reports available copies separately from workload readiness.

When the Job completes, say:

> The cache now reports one available copy out of one requested copy.

Say:

> I wait for this state before I judge the serving Pod.

When the Pod becomes ready, say:

> vLLM mounted the cached model and loaded it on the GPU.

Say:

> The original Instance now reports Ready because status flows back through the provider.

Screen: OpenEverest `qwen-demo` status.

Say:

> The user returns to the same object that started the deployment.

Say:

> It now shows one desired replica, one ready replica, and the cache readiness message.

Transition:

> A green status is useful, but the model must answer a real request.

## 20:00 to 25:00: OpenAI-compatible API

Screen: Terminal with `/v1/models`.

Say:

> vLLM exposes an OpenAI-compatible API on port 8000.

> The model list must contain the served name from the UI.

Do: Run `/v1/models`.

Point to `qwen3-0.6b`.

Say:

> Existing OpenAI clients can use this endpoint with a different base URL.

Do: Send the chat request.

Say while it runs:

> This request crosses the Kubernetes Service and reaches the vLLM Pod on the NVIDIA GPU.

When it returns, say:

> The API returned an assistant completion. This proves more than Pod readiness.

> It proves that routing, model naming, model loading, and inference work together.

Transition:

> Now we need evidence about what happened inside the model server.

## 25:00 to 32:00: Grafana and vLLM metrics

Screen: Terminal metrics, then Grafana.

Say:

> vLLM exposes Prometheus metrics on `/metrics`.

> The provider-created PodMonitor tells Prometheus which Pod and port to scrape.

Do: Show positive request and token counters.

Say:

> We can see prompt tokens, generated tokens, successful requests, and latency observations.

Do: Show `nvidia-smi`.

Say:

> The vLLM engine is the process using GPU memory.

Screen: Grafana vLLM dashboard.

Say:

> Grafana reads the same Prometheus data over time.

Say:

> The useful panels are request rate, token throughput, queue depth, time to first token, and end-to-end latency.

Do: Set Last 5 minutes and refresh every 5 seconds.

Point to changed panels.

Say:

> A ready Kubernetes Pod does not prove healthy inference.

> Request counters and latency show whether clients are receiving useful work.

Transition:

> The last proof tests the feature that saves the most restart time.

## 32:00 to 38:00: delete the Pod and prove cache reuse

Screen: Terminal with old Pod UID and Job list.

Say:

> I will delete only the serving Pod.

> Kubernetes will create a replacement because the Deployment still wants one replica.

Say:

> I recorded the Pod UID and the list of model download Jobs.

Do: Delete the serving Pod.

Say while waiting:

> The replacement still needs to start vLLM and load weights into GPU memory.

> No new model download Job must start.

When ready, say:

> The new Pod has a different UID, so this is a real replacement.

Do: Show the empty Job diff.

Say:

> The Job list did not change. KServe reused the existing LocalModel copy.

Do: Send another chat request.

Say:

> The replacement also serves a real request. Cache reuse did not trade away correctness.

Transition:

> We used a small set of options today. The provider schema exposes more.

## 38:00 to 42:00: optional UI selectors

Screen: New unsaved OpenEverest Instance form.

Say:

> I will show these controls without enabling them.

Point to CPU and GPU profiles.

Say:

> Teams can select CPU for small development models or GPU for accelerated serving.

Point to OCI models.

Say:

> The catalog can include Hugging Face models and OCI model images.

Point to autoscaling.

Say:

> KEDA and HPA actuators are available, but this one-GPU lab cannot demonstrate a second replica.

Point to LoRA adapters.

Say:

> Operators can publish compatible adapters through the provider catalog.

Point to routing and tracing.

Say:

> Envoy AI Gateway and distributed tracing need additional infrastructure and separate verification.

Point to multi-node and disaggregation.

Say:

> Large deployments can split work across GPUs or separate prefill from decode.

> This workshop does not claim those paths as verified results.

Close the form without submitting it.

## 42:00 to 45:00: questions

Screen: Architecture diagram or ready Instance.

Say:

> We started with one OpenEverest Instance.

Say:

> The provider produced KServe resources, LocalModel cached the checkpoint, vLLM served the API, and Grafana showed request behavior.

Say:

> The Pod replacement reused the model without another download Job.

Use these short answers:

| Question | Answer |
|---|---|
| Is this production-ready? | No. The provider is pre-alpha and needs production validation. |
| Is port-forwarding ingress? | No. It is a local debug and workshop access path. |
| Does one GPU support two replicas? | No. Kubernetes allocates the full GPU resource to one Pod. |
| Does Ready prove inference works? | No. The workshop also sends a real chat request. |
| Does the provider install Prometheus? | No. It creates a PodMonitor when the CRD exists. |
| Does cache reuse remove all startup time? | No. vLLM still loads weights into GPU memory. |
| Is the Envoy AI Gateway verified here? | No. This session verifies the direct ClusterIP Service path. |
| Can I add another model? | Yes. Operators edit the provider model catalog through Helm values. |

Close with:

> The useful abstraction is not one-click magic.

> It is one declared contract with visible controllers, resources, status, and metrics underneath it.

Say:

> The repository contains the full runbooks, decisions, theory, and cleanup procedure.

> Thank you. I am ready for questions.

## Time recovery

If deployment runs late, skip the optional selector section.

If the model is not ready by minute 18, switch to the backup recording.

If Grafana is unavailable, show direct `/metrics` output.

If the API request fails, show the prepared successful response and model logs. State that the live path failed.

Do not hide a live failure or claim an unobserved result.

Final approval rests with the writer.
