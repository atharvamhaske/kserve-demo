# Workshop scripts

Use `workshop.sh` as the only operator entry point.

```bash
./scripts/workshop.sh help
```

The numbered scripts implement each stage. Their numbers show the normal order, but presenters do not need to call them directly.

| Stage | Command | Result |
|---|---|---|
| Check | `./scripts/workshop.sh preflight` | Verifies the native Ubuntu NVIDIA host and required tools. |
| Create | `./scripts/workshop.sh cluster` | Creates Minikube and runs a CUDA smoke test. |
| Install | `./scripts/workshop.sh install` | Installs OpenEverest, KServe, Gateway components, monitoring, and the plugin. |
| Expose | `./scripts/workshop.sh https-local` | Creates the local self-signed `nip.io` endpoint. |
| Verify | `./scripts/workshop.sh verify` | Checks controllers, presets, HTTPS, and the authentication gate. |
| Present | `./scripts/workshop.sh ui` | Starts OpenEverest and Grafana port-forwards. |
| Remove | `CONFIRM_DELETE=all ./scripts/workshop.sh cleanup` | Deletes the workshop and restores the kernel setting. |

Keep `minikube tunnel` running in a second terminal during HTTPS and API demonstrations.

Read the [fast operator path](../README.md#fast-operator-path) for the complete sequence.
