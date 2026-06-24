# copilot_local adapter spec

## Goal

Provide a local adapter for GitHub Copilot CLI that can be embedded by host applications, including but not limited to Paperclip.

## Execution

The adapter invokes Copilot CLI non-interactively:

```text
copilot -p <prompt> --output-format json --no-color -s --no-ask-user --allow-all-tools
```

Optional flags:

- `--model <model>` for explicit model selection.
- `--resume=<sessionId>` for conversation continuity.
- `--effort <level>` when supported by the installed Copilot CLI.
- `--add-dir <dir>` to grant workspace access.

## JSONL event contract

Events are newline-delimited JSON. Most events use:

```json
{"type":"assistant.message_delta","data":{"deltaContent":"hello"},"id":"...","timestamp":"..."}
```

The terminal `result` event is special and carries summary metadata at the top level:

```json
{
  "type": "result",
  "sessionId": "uuid",
  "exitCode": 0,
  "usage": {
    "premiumRequests": 1,
    "totalApiDurationMs": 1000,
    "sessionDurationMs": 2000,
    "codeChanges": {
      "linesAdded": 0,
      "linesRemoved": 0,
      "filesModified": []
    }
  }
}
```

## Parsed output

The standalone adapter returns:

- `summary`: concatenated assistant message deltas and complete messages.
- `sessionId`: stable Copilot session id for future `--resume`.
- `usage`: token-like fields when emitted by Copilot.
- `premiumRequests`: GitHub Copilot billing/request unit.
- `model`: best-effort model hint.

## Authentication

Copilot CLI handles interactive auth through `copilot login`. The Paperclip-era adapter also supported GitHub token resolution for model discovery via:

- `COPILOT_GITHUB_TOKEN`
- `GH_TOKEN`
- `GITHUB_TOKEN`
- `gh auth token`

Classic `ghp_` PATs were intentionally rejected for Copilot API model discovery.

## Session lineage

The implementation was scoped and validated in session `c37b3db6-8e22-4598-9d81-567412f7647e`, with smoke validation against `D:\Github\copilot-sdk`.
