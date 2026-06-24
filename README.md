# copilot_local

Standalone export of the GitHub Copilot CLI adapter originally built in Copilot session `c37b3db6-8e22-4598-9d81-567412f7647e` for Paperclip.

This folder contains two things:

1. A standalone Node ESM adapter in `src/` and `bin/` that can run `copilot -p ... --output-format json` outside Paperclip.
2. A reconstructed Paperclip adapter snapshot in `paperclip-adapter/`, plus UI integration and session artifacts for reference.

## Quick start

```powershell
cd D:\Github\copilot_local
npm run check
node .\bin\copilot-local.js --cwd D:\Github\copilot-sdk --model claude-opus-4.7 --prompt "Reply with the single word: hello"
```

## Runtime contract

The standalone runner shells out to the GitHub Copilot CLI:

```text
copilot -p <prompt> --output-format json --no-color -s --no-ask-user --allow-all-tools [--model <id>] [--resume=<sessionId>] [--add-dir <cwd>]
```

It parses JSONL events and returns:

- `sessionId` from the terminal `result` event
- assistant text summary from `assistant.message_delta` and `assistant.message`
- `usage.outputTokens` from assistant messages when present
- `premiumRequests` from `result.usage.premiumRequests`
- effective model hints from `session.tools_updated` or tool completion events

## Layout

| Path | Purpose |
|---|---|
| `src/` | Standalone adapter wrapper, parser, and model catalog with no Paperclip imports. |
| `bin/copilot-local.js` | Small CLI for smoke tests and direct usage. |
| `paperclip-adapter/` | Snapshot of `D:\Github\paperclip\packages\adapters\copilot-local`, excluding `node_modules`. |
| `paperclip-ui-integration/` | Snapshot of `D:\Github\paperclip\ui\src\adapters\copilot-local`. |
| `session-artifacts/` | Recovered plan, checkpoints, JSONL fixture, and smoke script from session `c37b3db6...`. |
| `docs/` | Reconstructed spec and integration notes. |

## Live Paperclip status

At export time, neither local Paperclip instance exposed a Copilot adapter in `/api/adapters`; `copilot_local` was present as source/history, but not currently registered in the running servers.
