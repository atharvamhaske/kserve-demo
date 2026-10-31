# Workshop configuration

`workshop.env` pins release versions, cluster names, namespaces, and the demo model name.

The checked-in manifests and Helm values expect these namespace values:

```bash
EVEREST_NS=everest-system
INSTANCE_NS=default
MONITORING_NS=monitoring-demo
```

The scripts fail if those fixed names change. Keep passwords, API keys, and cloud credentials out of this file.

To test another configuration file without editing the default, set:

```bash
export WORKSHOP_CONFIG=/absolute/path/to/workshop.env
```

Return to the [workshop runbook](../README.md).
