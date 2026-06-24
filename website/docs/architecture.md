---
sidebar_position: 2
---

# Architecture

## Layout

| Path | Purpose |
|------|---------|
| `src/` | Standalone adapter: wrapper, JSONL parser, model catalog |
| `bin/copilot-local.js` | CLI entry point for smoke tests and direct usage |
| `paperclip-adapter/` | Snapshot of the Paperclip adapter package |
| `paperclip-ui-integration/` | Snapshot of Paperclip UI integration |
| `session-artifacts/` | Recovered plan, checkpoints, JSONL fixture from the original session |
| `docs/` | Spec and integration notes |
| `website/` | This Docusaurus site |

## Module Exports

```js
import { runCopilotLocal } from 'copilot-local-adapter';       // main runner
import { parseCopilotJsonl } from 'copilot-local-adapter/parse'; // JSONL parser
import { MODELS } from 'copilot-local-adapter/models';           // model catalog
```

## Runtime Flow

1. Caller invokes `runCopilotLocal({ prompt, cwd, model?, sessionId? })`
2. Adapter spawns `copilot` CLI subprocess with JSONL output
3. Parser streams JSONL lines, emitting typed events
4. On process exit, returns structured result with session ID, text, usage stats
