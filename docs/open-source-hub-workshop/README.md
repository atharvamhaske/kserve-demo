# Open Source Hub workshop

Start here for the 45-minute OpenEverest and KServe demonstration.

Each presentation role has a separate folder and one clear entry page.

## Choose the correct document

| Need | Document | Keep it on |
|---|---|---|
| Browser clicks and visible UI values | [UI runbook](ui/) | Presenter laptop |
| Commands, watches, API calls, and recovery | [Terminal runbook](terminal/) | GPU host |
| Spoken explanation, timing, and transitions | [Teleprompter](teleprompter/) | Private presenter screen |

## Recommended screen layout

Use three visible areas:

1. Main display: OpenEverest, terminal output, or Grafana.
2. Operator display: Terminal runbook and five GPU host terminals.
3. Presenter display: Teleprompter and session timer.

Do not display passwords, SSH commands, public addresses, Secrets, or kubeconfig data.

## Run order

| Time | Content | Primary document |
|---|---|---|
| 0 to 5 minutes | Problem, architecture, and one-resource idea | Teleprompter |
| 5 to 12 minutes | OpenEverest UI and model selector | UI runbook |
| 12 to 20 minutes | Deploy and explain the controller chain | Terminal runbook |
| 20 to 25 minutes | OpenAI-compatible API request | Terminal runbook |
| 25 to 32 minutes | Grafana and vLLM metrics | UI and terminal runbooks |
| 32 to 38 minutes | Delete Pod and prove cache reuse | Terminal runbook |
| 38 to 42 minutes | Show optional UI selectors | UI runbook |
| 42 to 45 minutes | Questions | Teleprompter |

## Supporting documents

Use these documents before and after the live presentation:

- [Workshop prerequisites](../ubuntu-gpu-workshop-prerequisites.md).
- [Full Ubuntu GPU installation and cleanup runbook](../ubuntu-gpu-localmodel-runbook.md).
- [Controller and LocalModel theory](../ubuntu-gpu-localmodel-theory.md).
- [Monitoring installation and dashboard procedure](../kubernetes-and-vllm-observability.md).
- [Screenshot capture guide](../one-click-llm-deployment-screenshot-guide.md).
- [Workshop decisions](../ubuntu-gpu-workshop-decisions.md).
- [Published workshop page](../one-click-llm-deployment-workshop.md).

## Folder map

```text
open-source-hub-workshop/
  README.md
  ui/
    README.md
  terminal/
    README.md
  teleprompter/
    README.md
```

Open this page first. Then open one document from each role folder.

Final approval rests with the writer.
