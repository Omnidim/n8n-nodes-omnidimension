# Changelog

All notable changes to this package are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-08-16

### Fixed

- The icon washed out on light backgrounds. Hosts that render the dark variant on a light surface, such as the n8n Creator Portal listing, showed only the cyan stroke. Both variants now sit on a solid brand tile so they stay legible whatever background they land on.

## [0.1.1] - 2026-08-16

### Added

- Webhook lifecycle methods on the trigger. Activating a workflow now checks that each configured agent really posts to this node's URL, and explains what to fix instead of failing silently.
- Themed light and dark icons for both nodes and the credential.

### Changed

- Errors from the API are wrapped in `NodeApiError` so n8n renders them properly.
- Development now targets `n8n-workflow` v2 and lints with `@n8n/eslint-plugin-community-nodes`, the ruleset n8n's submission scanner uses.

## [0.1.0] - 2026-08-09

### Added

- `OmniDimension` node with five resources: Agent (create, get, get many), Call (dispatch, get log, get many logs), Bulk Call (create, add contact, get, get many, get live status, pause, resume, reschedule, cancel), Knowledge Base (upload, get many), and Phone Number (get many).
- `OmniDimension Trigger` node that starts a workflow from the post-call webhook, with optional agent-ID and call-status filters.
- `OmniDimension API` credential holding a Bearer API key, verified against `GET /agents`.
- Dynamic dropdowns for agents, phone numbers, and campaigns, loaded from the authenticated account.
