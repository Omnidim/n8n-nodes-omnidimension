# n8n-nodes-omnidimension

n8n community node for [OmniDimension](https://omnidim.io) — voice AI agents that make and receive phone calls.

## Nodes

**OmniDimension** (action node)

| Resource | Operations |
|---|---|
| Agent | Get Many, Get, Create |
| Call | Dispatch, Get Log, Get Many Logs |
| Knowledge Base | Get Many, Upload (PDF) |
| Phone Number | Get Many |

Agent and From-Number fields are dynamic dropdowns loaded from your account.

**OmniDimension Trigger** — starts a workflow when a call completes. Copy the node's webhook URL into your agent's **Post-Call tab → Webhook** in the OmniDimension dashboard. Optional agent-ID filter on the node.

## Credentials

One credential: your OmniDimension API key, from [omnidim.io/api-management](https://omnidim.io/api-management). Create a key named "n8n" so you can revoke it independently of other integrations. The credential test calls `GET /agents`.

## Install

Community nodes panel in n8n: **Settings → Community Nodes → Install** → `n8n-nodes-omnidimension`.

## Local development

```bash
npm install
npm run build

# link into a local n8n
npm link
mkdir -p ~/.n8n/custom && cd ~/.n8n/custom
npm init -y >/dev/null 2>&1 || true
npm link n8n-nodes-omnidimension

# run n8n
npx n8n
```

Open http://localhost:5678, search "omni" in the node picker.

## Publishing

Verified community nodes must be published to npm **via GitHub Actions with provenance** (required since May 1, 2026) — see `.github/workflows/publish.yml`. Then submit at [creators.n8n.io](https://creators.n8n.io/nodes).

## API reference

Base URL `https://backend.omnidim.io/api/v1`, Bearer auth. Full docs at [docs.omnidim.io](https://docs.omnidim.io).
