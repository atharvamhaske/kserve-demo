# Workshop manifests

Use these manifests for platform setup or an automated rehearsal. The live model-creation path stays in the OpenEverest UI.

| File | Purpose | Apply during live demo? |
|---|---|---|
| `instancepreset-qwen-demo-gateway.yaml` | Publishes the `kserve-qwen-demo-gateway` preset card. | The install script applies it before the demo. |
| `qwen-demo-terminal.yaml` | Creates the complete `qwen-demo` Instance without the UI. | No. Use it only for automated rehearsal. |
| `instanceuser-chat-app.yaml` | Creates one `chat-app` API-key identity. | Use only if the Users tab did not create `chat-app`. |
| `demo-valkey.yaml` | Stores demo quota counters without persistence. | The install script applies it. |
| `selfsigned-clusterissuer.yaml` | Issues the local Minikube Gateway certificate. | The local HTTPS script applies it. |
| `application-env.example.yaml` | Shows how an application maps generated Secret values to environment variables. | Explain it after creating a user key. |

## Preset YAML versus Instance YAML

An `InstancePreset` publishes a reusable UI card. It creates no model workload by itself.

An `Instance` creates the model workload. The terminal manifest and the UI preset path both create `qwen-demo`.

Choose one path for that name. Do not apply `qwen-demo-terminal.yaml` after the UI creates `qwen-demo`.

The same ownership rule applies to `chat-app`. Create it in the Users tab for the live demo, or apply `instanceuser-chat-app.yaml` for automation. Do not do both.

Read [Model creation and parallelism guide](../model-configuration-guide.md) before changing GPU or parallelism fields.

Return to the [workshop runbook](../README.md).
