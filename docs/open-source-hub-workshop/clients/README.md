# Workshop API clients

The `go/` directory contains the checked-in OpenAI-compatible Go client.

Both curl and Go use the same values from the OpenEverest API-key dialog:

| Environment variable | OpenEverest field |
|---|---|
| `OPENAI_API_KEY` | API key |
| `OPENAI_BASE_URL` | Base URL ending in `/v1` |
| `OPENAI_MODEL` | Model |

For local self-signed HTTPS, also export the certificate paths written by the workshop script:

```bash
export CURL_CA_BUNDLE="$GATEWAY_CERT"
export SSL_CERT_FILE="$GATEWAY_CERT"
```

Run the Go client from the workshop directory:

```bash
go run ./clients/go
```

Never check a generated API key into this directory. Mount the generated Kubernetes Secret for deployed applications.

Read the runbook sections for [curl](../README.md#8-call-the-model-with-curl), [Go](../README.md#9-call-the-model-from-go), and [Secret mounting](../README.md#10-mount-credentials-in-an-application).
