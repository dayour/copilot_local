---
sidebar_position: 1
slug: /intro
---

# copilot_local

Standalone GitHub Copilot CLI adapter: run `copilot -p ...` from Node or a small CLI, then parse Copilot JSONL into structured results.

## Quick Start

```bash
npm run check
npm test
node ./bin/copilot-local.js --cwd <your-repo> --model gpt-5.4 --prompt "Reply with hello"
```

:::tip[Prerequisite]
Install and authenticate the GitHub Copilot CLI first. You can use `copilot login` or `node ./bin/copilot-local.js login`.
:::

:::caution
The API enables `--allow-all-tools` by default for non-interactive runs. Set `allowAllTools: false` and pass explicit allow/deny lists when embedding it in stricter hosts.
:::

## What It Provides

- CLI commands for `run`, `login`, and `models`.
- `runCopilotLocal` and `buildCopilotArgs` for host integrations.
- A JSONL parser that preserves messages, reasoning, tools, sessions, skills, MCP servers, user messages, intents, turns, result durations, code changes, and unknown future events.
- Auth helpers for token validation, GitHub CLI token resolution, Copilot headers, auth error detection, and API endpoint discovery.
- Dynamic model discovery with a static fallback catalog.

## Runtime Surfaces

`buildCopilotArgs` maps prompt/session options, model and reasoning flags, permissions, attachments, MCP settings, GitHub Enterprise hostnames, and BYOK provider environment variables. `runCopilotLocal` retries stale resumed sessions once and reports `clearSession: true` when callers should discard the old session id.
