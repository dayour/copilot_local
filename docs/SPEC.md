# copilot_local adapter spec

## Goal

Provide a local Node ESM adapter for the GitHub Copilot CLI that host applications can embed without depending on Paperclip internals.

## Package exports

- `copilot-local-adapter`: runner, argument builder, adapter factory, parser, auth/login helpers, and model helpers.
- `copilot-local-adapter/parse`: `parseCopilotJsonl`, `parseCopilotEvent`, `isCopilotStaleSessionError`.
- `copilot-local-adapter/models`: `DEFAULT_COPILOT_LOCAL_MODEL`, `COPILOT_LOCAL_MODELS`, `listFallbackModels`, `listCopilotLocalModels`.
- `copilot-local-adapter/auth`: `validateCopilotToken`, `resolveCopilotToken`, `buildCopilotHeaders`, `isCopilotAuthError`, `discoverCopilotApiUrl`.
- `copilot-local-adapter/login`: `copilotLogin`.

## Execution contract

`runCopilotLocal(options)` resolves `cwd`, builds arguments with `buildCopilotArgs(options)`, spawns `options.command ?? "copilot"`, parses stdout with `parseCopilotJsonl`, and returns a structured result. If `resumeSessionId` is set and Copilot reports an invalid/expired/unknown session, it retries once without the resume flag and sets `clearSession: true`.

Base invocation:

```text
copilot -p <prompt> --output-format json --no-color -s --no-ask-user --allow-all-tools
```

`prompt` is required unless `interactive` supplies a prompt string. `createCwd: true` creates a missing working directory.

## Argument mapping

`buildCopilotArgs(options)` supports these runtime surfaces:

| Option | Copilot CLI mapping |
|---|---|
| `prompt` | `-p <prompt>` |
| `interactive` | `--interactive <prompt>` when true/string |
| `mode` | `--mode <value>` |
| `plan`, `autopilot` | `--plan`, `--autopilot` |
| `allowAllTools` | defaults to `--allow-all-tools`; false suppresses it |
| `model` | `--model <id>` |
| `context` | `--context <value>` |
| `resumeSessionId` | `--resume` or `--resume=<id>` |
| `sessionId` | `--session-id <id>` |
| `continueSession` | `--continue` |
| `name` | `--name <name>` |
| `effort` | `--effort <level>` |
| `reasoningEffort` | `--reasoning-effort <level>` |
| `stream` | `--stream on/off/<value>` |
| `attachments` | repeated `--attachment <path>` |
| `addDirs` | repeated `--add-dir <dir>` |
| `cwd` | repeated as `--add-dir <cwd>` unless `addCwd: false` |
| `allowAllPaths`, `allowAllUrls`, `disallowTempDir` | permission booleans |
| `allowTools`, `denyTools` | repeated `--allow-tool=<name>`, `--deny-tool=<name>` |
| `availableTools`, `excludedTools` | repeated `--available-tools=<name>`, `--excluded-tools=<name>` |
| `allowUrls`, `denyUrls` | repeated `--allow-url=<url>`, `--deny-url=<url>` |
| `additionalMcpConfigs` | repeated `--additional-mcp-config <path>` |
| `disableBuiltinMcps` | `--disable-builtin-mcps` |
| `disableMcpServers` | repeated `--disable-mcp-server <name>` |
| `enableAllGithubMcpTools` | `--enable-all-github-mcp-tools` |
| `addGithubMcpTools`, `addGithubMcpToolsets` | repeated GitHub MCP tool/toolset flags |
| `hostname`/`gheHost` | `--hostname <host>` |
| `extraArgs` | appended verbatim |

BYOK/provider options are mapped to environment variables rather than CLI flags: `providerBaseUrl`, `providerType`, `providerApiKey`, `providerBearerToken`, `providerWireApi`, `providerTransport`, `providerModelId`, `providerWireModel`, `providerMaxPromptTokens`, `providerMaxOutputTokens`, and `offline` become `COPILOT_PROVIDER_*`/`COPILOT_OFFLINE` values.

## Result contract

`runCopilotLocal` returns:

- `command`, `args`, `cwd`, `exitCode`, `signal`, `timedOut`, `stdout`, `stderr`.
- `sessionId`, `model`, `provider: "github-copilot"`, `summary`, `errorMessage`.
- `usage`, `premiumRequests`, `clearSession`.
- `resultJson` and `result`, both containing parser metadata.

## JSONL parser contract

`parseCopilotJsonl(stdout)` accepts newline-delimited JSON events. Invalid lines and objects without `type` are ignored. Every recognized event is also preserved in `events` with `type`, `data`, `raw`, and common metadata (`id`, `timestamp`, `parentId`, `ephemeral` when present).

Returned fields:

- Backward-compatible fields: `sessionId`, `exitCode`, `summary`, `errorMessage`, `usage`, `premiumRequests`, `model`.
- Structured event collections: `events`, `messages`, `reasoning`, `tools`, `sessions`, `skills`, `mcpServers`, `userMessages`, `intents`, `turns`, `unknownEvents`.
- Result details: `codeChanges`, `totalApiDurationMs`, `sessionDurationMs`.

Recognized event behavior:

- `assistant.message_delta`: appends `data.deltaContent`/`data.content` to `summary` and records a delta message.
- `assistant.message`: appends `data.content`, records tool requests, and accumulates `data.outputTokens`.
- `assistant.usage`: accumulates input/output/cached token counters and captures model hints.
- `assistant.reasoning` and `assistant.reasoning_delta`: populate `reasoning`.
- Tool execution events: populate `tools` with start/partial/complete phases, tool ids, names, arguments, results, errors, and success state.
- `session.tools_updated`: records available tools and model hints.
- `session.skills_loaded`: normalizes skills into `skills`.
- `session.mcp_servers_loaded`: normalizes MCP servers into `mcpServers`.
- `user.message`, `assistant.intent`, `assistant.turn_start`, `assistant.turn_end`: populate their dedicated collections.
- `result`: updates terminal `sessionId`, `exitCode`, `premiumRequests`, `codeChanges`, `totalApiDurationMs`, `sessionDurationMs`, and model hints.
- `error`: appends normalized error messages.
- Any other type goes to `unknownEvents`.

`isCopilotStaleSessionError(stdout, stderr)` matches invalid, missing, expired, or unknown session messages for retry decisions.

## Authentication and login

`validateCopilotToken(token)` rejects empty tokens and classic `ghp_` PATs because those are not valid for Copilot API model discovery. `resolveCopilotToken` checks `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, and `GITHUB_TOKEN` for the default host unless forced, then falls back to `gh auth token` with optional GitHub Enterprise hostname support. `buildCopilotHeaders` returns Copilot API-compatible headers. `isCopilotAuthError` recognizes common 401/403, bad credentials, login required, token expired/invalid, authentication failed, and Copilot subscription errors.

`discoverCopilotApiUrl(token, gheHost)` calls the Copilot internal user endpoint, caches successful endpoint discovery briefly, and returns `null` on validation, network, or response failures.

`copilotLogin(options)` runs `copilot login`, optionally with a normalized `--host`, streams stdout/stderr callbacks, enforces a timeout, and returns `{ success, output, errorMessage, exitCode, signal }`. The root export also aliases it as `loginCopilotLocal`, `login`, `runLogin`, and `runCopilotLogin` for older loaders.

## Models

`COPILOT_LOCAL_MODELS` is the static fallback catalog. `DEFAULT_COPILOT_LOCAL_MODEL` is `gpt-5.4`. `listFallbackModels()` returns a fresh array copy. `listCopilotLocalModels(hints)` resolves a token, discovers the Copilot API base URL when possible, calls `/models`, filters embeddings, normalizes labels, and falls back to `listFallbackModels()` on missing credentials or any API failure.

## CLI contract

`bin/copilot-local.js` supports:

- `run`/default: executes a prompt and prints normalized JSON unless `--raw` is used.
- `login`: loads login support and prints login result JSON.
- `models`/`list-models`: lists dynamic or fallback models.

The CLI accepts the same runtime groups as the API: prompt/session, model/reasoning/context, permissions/tools/URLs, paths/attachments, MCP, GitHub Enterprise host, BYOK provider environment, timeout, command override, and `--env KEY=VALUE`. Secret-like output fields are redacted in JSON.

## Validation

The repository is validated with Node built-in tooling and no test dependencies:

```powershell
npm run check
npm test
```
