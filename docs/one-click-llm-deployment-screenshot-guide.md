# Workshop screenshot capture guide

Use this guide during the final Open Source Hub rehearsal.

Do not capture passwords, API-key values, SSH commands, public host addresses, Secrets, or kubeconfig data.

## Prepare the capture directory

```bash
mkdir -p docs/assets/one-click-llm-deployment/screenshots
```

Use the same browser zoom, terminal font, and window size for every capture.

## Capture 1: GPU preflight

Run:

```bash
nvidia-smi
docker run --rm --gpus all ubuntu:24.04 nvidia-smi
```

Capture only GPU name, driver, CUDA version, and matching container output.

Save as:

```text
docs/assets/one-click-llm-deployment/screenshots/01-gpu-preflight.png
```

## Capture 2: installed platform

Run after `./scripts/workshop.sh verify`:

```bash
helm list --all-namespaces
kubectl get provider provider-kserve
kubectl get plugins.extensions.openeverest.io plugin-user-management
kubectl get instancepreset
```

Show five Helm releases, the provider, the plugin, and three presets.

Save as `02-installed-platform.png`.

## Capture 3: workshop preset

Open Instances, select Create, then select `provider-kserve` if the drawer appears.

Capture the Basic Info step with these preset cards visible:

- `kserve-smollm-cpu`
- `kserve-qwen-gpu`
- `kserve-qwen-demo-gateway`

Select `kserve-qwen-demo-gateway`. Show Namespace `default`, Display name `qwen-demo`, and locked Topology `llm`.

Save as `03-workshop-preset.png`.

## Capture 4: manual configuration explanation

Open a second unsaved Start from scratch form. Select Configure more options.

Show the Scaling & Parallelism section first. Explain that tensor, pipeline, and data sizes stay at `1` because the model fits one GPU. The demo keeps replicas at `1` because it needs one model copy.

Scroll to Routing and capture:

- External access: Envoy AI Gateway
- Tokens per User per Hour: 300

Do not submit this second form. It explains the custom UI path without creating a competing `qwen-demo` Instance.

Save as `04-routing-selectors.png`.

## Capture 5: ready model and HTTPS details

Open the ready `qwen-demo` Instance and its Connection details.

Show Base URL and Model. Hide the API-key value.

The Base URL must use `https://` and a `nip.io` hostname.

Save as `05-model-connection.png`.

## Capture 6: Users tab

Open the Users tab before creating consumer keys.

Show:

- API keys heading
- `qwen-demo` System user
- Create API key button

Save as `06-users-system-key.png`.

## Capture 7: Create API key dialog

Select Create API key.

Set:

- Name: `chat-app`
- Role: `invoke`

Capture the form before selecting Create.

Save as `07-create-api-key.png`.

## Capture 8: generated client values

After creation, capture the success dialog.

Show the field labels:

- Name
- API key
- Base URL
- Model

Redact the API-key value. Keep the Base URL and Model visible.

Save as `08-api-key-credentials.png`.

## Capture 9: curl and Go consumers

Run the authenticated curl call and the checked-in Go client.

Capture:

- the HTTPS Base URL without its key;
- one assistant response from curl;
- one assistant response from Go.

Save as `09-api-consumers.png`.

## Capture 10: separate quotas

Use `chat-app` until it returns `429`. Call the model with `batch-job` immediately afterward.

Show:

```text
chat-app: HTTP 429
batch-job: HTTP 200
```

Do not show either key.

Save as `10-separate-quotas.png`.

## Capture 11: key lifecycle

Rotate `chat-app` and test the old key. Delete `batch-job` and test its key.

Show only status results:

```text
old chat-app key: HTTP 401
new chat-app key: HTTP 200
deleted batch-job key: HTTP 401
```

Save as `11-key-lifecycle.png`.

## Capture 12: per-key Grafana metrics

Open the Envoy AI Gateway dashboard or Grafana Explore.

Use:

```promql
sum by (openeverest_key_id, gen_ai_token_type) (
  increase(gen_ai_client_token_usage_sum{gen_ai_token_type="total"}[1h])
)
```

Show the `openeverest_key_id` series and the matching non-secret key ID from the terminal.

Save as `12-per-key-metrics.png`.

## Capture 13: generated resources

Run:

```bash
kubectl -n default get \
  instance,instanceuser,llminferenceservice,pod,svc,podmonitor
kubectl -n everest-system get gateway,certificate
```

Show the resource chain without Secret data.

Save as `13-generated-resources.png`.

## Crop and size

Keep each image smaller than 1.5 MB. Keep text readable at GitHub page width.

Crop unused browser chrome and empty terminal space. Preserve headings and field labels.

## Final check

```bash
find docs/assets/one-click-llm-deployment/screenshots \
  -maxdepth 1 \
  -type f \
  -name '*.png' \
  -print | sort
```

Expected result: 13 PNG files.

Final visual approval rests with the workshop owner.
