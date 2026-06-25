---
sidebar_position: 2
---

# Architecture

## Layout

| Path | Purpose |
|------|---------|
| `src/index.js` | Runner, argument builder, adapter factory, and root exports |
| `src/parse.js` | JSONL event parser and stale-session detector |
| `src/auth.js` | Copilot token validation, token resolution, headers, auth error detection, endpoint discovery |
| `src/login.js` | `copilot login` wrapper |
| `src/models.js` | Dynamic Copilot model discovery plus fallback catalog |
| `bin/copilot-local.js` | CLI entry point for run/login/models |
| `test/` | Node built-in test runner coverage |
| `docs/` | Full runtime contract and integration notes |

## Module Exports

```js
import {
  runCopilotLocal,
  buildCopilotArgs,
  createCopilotLocalAdapter,
  parseCopilotJsonl,
  listCopilotLocalModels,
  listFallbackModels,
  validateCopilotToken,
  copilotLogin
} from 'copilot-local-adapter';

import { parseCopilotJsonl } from 'copilot-local-adapter/parse';
import { listCopilotLocalModels } from 'copilot-local-adapter/models';
import { validateCopilotToken } from 'copilot-local-adapter/auth';
import { copilotLogin } from 'copilot-local-adapter/login';
```

## Runtime Flow

1. Caller invokes the CLI or `runCopilotLocal({ prompt, cwd, model, ... })`.
2. `buildCopilotArgs` converts sessions, permissions, MCP, attachments, reasoning, model, hostname, and provider options into Copilot CLI args/env.
3. The adapter spawns the local `copilot` binary with JSON output enabled.
4. `parseCopilotJsonl` normalizes JSONL events into text, metadata, usage, tools, sessions, skills, MCP servers, result durations, and code changes.
5. If a resumed session is stale, the runner retries once without `--resume` and asks the caller to clear the saved session id.
6. The caller receives command metadata plus parsed result fields.
