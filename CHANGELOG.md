# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-09

### Added

- `OmniDimension` node with five resources: Agent (create, get, get many), Call (dispatch, get log, get many logs), Bulk Call (create, add contact, get, get many, get live status, pause, resume, reschedule, cancel), Knowledge Base (upload, get many), and Phone Number (get many).
- `OmniDimension Trigger` node that starts a workflow from the post-call webhook, with optional agent-ID and call-status filters.
- `OmniDimension API` credential holding a Bearer API key, verified against `GET /agents`.
- Dynamic dropdowns for agents, phone numbers, and campaigns, loaded from the authenticated account.
