# Workshop configuration

`workshop.env` pins release versions, cluster names, namespaces, and the demo model name.

The host-tool pins are:

```bash
KUBECTL_VERSION=v1.36.6
MINIKUBE_VERSION=v1.39.0
HELM_VERSION=v3.22.1
GO_VERSION=1.26.10
```

The checked-in manifests and Helm values expect these namespace values:

```bash
EVEREST_NS=everest-system
INSTANCE_NS=default
MONITORING_NS=monitoring-demo
```

The scripts fail if the fixed namespace names change. Keep passwords, API keys, cloud credentials, and host addresses out of this file.

To use a reviewed copy on the GPU host:

```bash
cp config/workshop.env "$HOME/workshop.env"
export WORKSHOP_CONFIG="$HOME/workshop.env"
```

From a presenter-machine checkout of `docs/open-source-hub-workshop`, upload the file:

```bash
scp config/workshop.env "$GPU_HOST:~/workshop.env"
```

Set `WORKSHOP_CONFIG` on the GPU host before running `bootstrap`, `fresh`, or another workshop command. The default remains `config/workshop.env`.

Return to the [workshop runbook](../README.md).
