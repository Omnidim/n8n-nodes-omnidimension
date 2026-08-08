# Security policy

## Reporting a vulnerability

Email `security@omnidim.io` with a description, reproduction steps, and the affected version. We aim to acknowledge within two business days and to issue a fix or mitigation within thirty days for confirmed issues.

Please do not file public issues for security reports.

## Handling credentials

This node authenticates with a Bearer API key stored in an n8n credential, which n8n encrypts at rest. Create a dedicated key named "n8n" at [omnidim.io/api-management](https://omnidim.io/api-management) so it can be revoked without affecting your other integrations.

The API key grants full access to your OmniDimension account. Never paste it into a workflow parameter, an expression, or a Code node, where it would be stored unencrypted in the workflow definition and visible in execution logs.

## Webhook trigger

The OmniDimension Trigger node accepts unauthenticated POST requests at its webhook URL, and post-call deliveries are not currently signed. Treat the webhook URL as a secret, and use the node's Agent IDs filter so unexpected payloads do not start workflows. Signature verification will be added once the OmniDimension webhook subscription API ships.

## Supported versions

Only the latest minor version receives security fixes.
