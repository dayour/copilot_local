---
sidebar_position: 1
slug: /intro
---

# copilot_local

Standalone GitHub Copilot CLI adapter -- run `copilot -p ...` outside Paperclip and parse JSONL events into structured results.

## Quick Start

```bash
cd copilot_local
npm run check
node ./bin/copilot-local.js --cwd <your-repo> --model claude-opus-4.7 --prompt "Reply with hello"
```

## What It Does

The adapter shells out to the GitHub Copilot CLI:

```
copilot -p <prompt> --output-format json --no-color -s --no-ask-user --allow-all-tools [--model <id>] [--resume=<sessionId>] [--add-dir <cwd>]
```

It parses JSONL events and returns:

- `sessionId` from the terminal `result` event
- Assistant text from `assistant.message_delta` / `assistant.message`
- `usage.outputTokens` from assistant messages
- `premiumRequests` from `result.usage.premiumRequests`
- Effective model hints from `session.tools_updated` or tool completion events
