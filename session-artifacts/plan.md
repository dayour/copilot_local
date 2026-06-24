Problem: add a built-in dedicated Paperclip adapter for GitHub Copilot CLI, register it across server/UI/CLI, and validate that it can run against D:\Github\copilot-sdk.

Approach:
- Create a new adapter package at packages/adapters/copilot-local modeled after the existing local CLI adapters.
- Use `copilot -p ... --output-format json` as the execution contract, persist `sessionId` for `--resume`, and parse Copilot JSONL events for summaries, tool activity, and final result metadata.
- Treat this as a GitHub-native provider: provider will be `github`, model remains optional but supported via `--model`, and the UI will expose a curated model list plus manual entry.
- Add environment diagnostics around command availability and a lightweight hello probe so the board can validate setup before use.
- Register the adapter in server, UI, and CLI registries, then run focused tests plus a validation smoke run using D:\Github\copilot-sdk as cwd.

Todos:
- Investigate existing adapter patterns and scaffold the new copilot-local package structure.
- Implement server execution, JSONL parsing, session codec, environment test, and model metadata.
- Wire the adapter into Paperclip registries and UI config surfaces.
- Add tests for parser/session/config behavior and validate with repo test/typecheck/build plus a Copilot smoke run in D:\Github\copilot-sdk.

Notes:
- GitHub Copilot CLI exposes a usable non-interactive JSONL interface and stable `sessionId` resume behavior, so this adapter can follow the same long-run session model as other local adapters.
- `copilot --resume=<uuid>` safely resumes an existing session and can also seed a new session with that UUID, so stale-session retry logic may be simpler than in other adapters.
- The official supported-models docs do not expose a machine-readable populated table in the fetched markdown body, so the adapter should ship a conservative built-in model list and still allow manual model entry.

JSONL contract (validated against `copilot` v1.0.32 in D:\Github\copilot-sdk on 2026-04-19):
- Required flags: `-p "<prompt>"`, `--allow-all` (or `--allow-all-tools`), `--output-format json`, `--no-color`, `--log-level error`. Recommended: `--no-auto-update`, `--add-dir <cwd>`.
- Event envelope: `{ type, data, id, timestamp, parentId, ephemeral? }`.
- Notable types:
  - `session.mcp_server_status_changed`, `session.mcp_servers_loaded`, `session.skills_loaded`, `session.tools_updated` (`data.model` carries effective model id).
  - `user.message`, `assistant.turn_start`, `assistant.message_delta` (streaming chunks), `assistant.message` (final per-turn message — has `content`, `toolRequests[]`, `outputTokens`, `requestId`), `assistant.turn_end`.
  - `result` (terminal): `{ type: "result", timestamp, sessionId, exitCode, usage: { premiumRequests, totalApiDurationMs, sessionDurationMs, codeChanges: { linesAdded, linesRemoved, filesModified[] } } }`.
- Token accounting: only `outputTokens` per assistant turn is reported; no `inputTokens` field. Cost surrogate is `usage.premiumRequests` (Copilot's billing unit) — surface via `costUsd: null` and a custom `summary`/usage line.
- `--resume=<uuid>` accepts a 7+ hex char prefix; full UUID is what `result.sessionId` returns. Adapter should persist that as `sessionParams.sessionId` and pass `--resume=<id>` on subsequent wakes.
- Auth: Copilot CLI uses GitHub OAuth (run `copilot` once interactively if `gh auth login` hasn't been completed). No env-var API key path.
