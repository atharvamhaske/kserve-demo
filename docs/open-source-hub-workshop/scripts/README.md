# Workshop scripts

Use `workshop.sh` as the only operator entry point.

```bash
./scripts/workshop.sh help
```

The numbered scripts implement each stage. Their numbers show the normal order, but presenters do not need to call them directly.

| Stage | Command | Result |
|---|---|---|
| Bootstrap | `./scripts/workshop.sh bootstrap` | Installs pinned kubectl, Minikube, Helm, and Go binaries, then runs preflight. |
| Check | `./scripts/workshop.sh preflight` | Verifies the native Ubuntu NVIDIA host and required tools. |
| Create | `./scripts/workshop.sh cluster` | Creates Minikube and runs a CUDA smoke test. |
| Install | `./scripts/workshop.sh install` | Installs OpenEverest, KServe, Gateway components, monitoring, and the plugin. |
| Expose | `./scripts/workshop.sh https-local` | Creates the local self-signed `nip.io` endpoint. |
| Fresh install | `./scripts/workshop.sh fresh` | Runs bootstrap, cluster creation, and platform installation. |
| Verify | `./scripts/workshop.sh verify` | Checks controllers, presets, HTTPS, and the authentication gate. |
| Present | `./scripts/workshop.sh ui` | Starts OpenEverest and Grafana port-forwards. |
| Remove | `CONFIRM_DELETE=all ./scripts/workshop.sh cleanup` | Deletes the workshop and restores the kernel setting. |

Keep `minikube tunnel` running in a second terminal during HTTPS and API demonstrations.

The bootstrap targets Ubuntu 24.04 LTS on `x86_64`. Install the NVIDIA driver, Docker Engine, and NVIDIA Container Toolkit before running it. The script checks those host components but does not change them.

The workshop uses Minikube and does not install kind.

Read the [fast operator path](../README.md#fast-operator-path) for the complete sequence.

Read [UI connection instructions](../README.md#connect-from-the-gpu-host-terminal) before opening OpenEverest or Grafana from another machine. Use the [troubleshooting FAQ](../troubleshooting-faq.md) when a command or connection fails.
