# copilot_local

Standalone GitHub Copilot CLI adapter reconstructed from the Paperclip `copilot_local` work. It provides a small Node ESM API, a CLI wrapper, JSONL parsing, auth helpers, login support, and model discovery/fallbacks without Paperclip runtime dependencies.

## Quick start

```powershell
cd D:\Github\copilot_local
npm run check
npm test
node .\bin\copilot-local.js --cwd D:\your\repo --model gpt-5.4 --prompt "Reply with hello"
```

The adapter shells out to an installed GitHub Copilot CLI. Authenticate first with `copilot login` or `node .\bin\copilot-local.js login`.

## Runtime contract

`runCopilotLocal(options)` builds a non-interactive Copilot CLI invocation and parses JSONL stdout:

```text
copilot -p <prompt> --output-format json --no-color -s --no-ask-user --allow-all-tools
```

The base command is extended by `buildCopilotArgs(options)`:

- Prompt/session: `prompt`, `interactive`, `resumeSessionId`, `sessionId`, `continueSession`, `name`, stale-session retry for `resumeSessionId`.
- Model/reasoning/context: `model`, `effort`, `reasoningEffort`, `context`, `mode`, `plan`, `autopilot`, `stream`.
- Paths/attachments: `cwd`, automatic `--add-dir <cwd>` unless `addCwd: false`, `addDirs`, `attachments`, `allowAllPaths`, `disallowTempDir`.
- Permissions/URLs/tools: `allowAllTools` defaults to true; `allowTools`, `denyTools`, `availableTools`, `excludedTools`, `allowUrls`, `denyUrls`, `allowAllUrls` map to runtime policy flags.
- MCP/GitHub host: `additionalMcpConfigs`, `disableBuiltinMcps`, `disableMcpServers`, `enableAllGithubMcpTools`, `addGithubMcpTools`, `addGithubMcpToolsets`, `hostname`/`gheHost`.
- BYOK/provider env: `providerBaseUrl`, `providerType`, `providerApiKey`, `providerBearerToken`, `providerWireApi`, `providerTransport`, `providerModelId`, `providerWireModel`, `providerMaxPromptTokens`, `providerMaxOutputTokens`, and `offline` are converted to `COPILOT_PROVIDER_*`/`COPILOT_OFFLINE` environment variables.

`runCopilotLocal` returns command metadata plus parsed output: `sessionId`, `model`, `summary`, `errorMessage`, `usage`, `premiumRequests`, `clearSession`, `stdout`, `stderr`, `resultJson`, and `result`.

## Public surfaces

```js
import {
  runCopilotLocal,
  buildCopilotArgs,
  createCopilotLocalAdapter,
  parseCopilotJsonl,
  listCopilotLocalModels,
  listFallbackModels,
  validateCopilotToken,
  resolveCopilotToken,
  buildCopilotHeaders,
  isCopilotAuthError,
  discoverCopilotApiUrl,
  copilotLogin
} from 'copilot-local-adapter';

import { parseCopilotJsonl } from 'copilot-local-adapter/parse';
import { listCopilotLocalModels } from 'copilot-local-adapter/models';
import { validateCopilotToken } from 'copilot-local-adapter/auth';
import { copilotLogin } from 'copilot-local-adapter/login';
```

The package also exposes `./parse`, `./models`, `./auth`, and `./login` subpaths.

## Parser metadata

`parseCopilotJsonl(stdout)` keeps backward-compatible fields and adds structured metadata:

- Text and usage: `summary`, `usage.inputTokens`, `usage.outputTokens`, `usage.cachedInputTokens`, `premiumRequests`, `model`.
- Event collections: `events`, `messages`, `reasoning`, `tools`, `sessions`, `skills`, `mcpServers`, `userMessages`, `intents`, `turns`, `unknownEvents`.
- Result metadata: `exitCode`, `codeChanges`, `totalApiDurationMs`, `sessionDurationMs`, `sessionId`, `errorMessage`.

Unknown event types are preserved in `unknownEvents` so callers can inspect future Copilot CLI output without losing data.

## Auth, login, and models

`src/auth.js` provides token validation and model-discovery helpers. Classic `ghp_` PATs are rejected for Copilot API use. Tokens can be resolved from `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`, or `gh auth token`, and `isCopilotAuthError` recognizes common 401/403/login/subscription failures.

`copilotLogin(options)` runs `copilot login` and is also exported as `loginCopilotLocal`, `login`, `runLogin`, and `runCopilotLogin` for CLI compatibility.

`listCopilotLocalModels(hints)` attempts Copilot API model discovery when a usable token exists; otherwise it returns `listFallbackModels()`. The fallback catalog is exported as `COPILOT_LOCAL_MODELS`, with `DEFAULT_COPILOT_LOCAL_MODEL` set to `gpt-5.4`.

## CLI

```powershell
node .\bin\copilot-local.js --prompt "hello" --model gpt-5.4
node .\bin\copilot-local.js login --ghe-host ghe.example.com
node .\bin\copilot-local.js models --json
```

The CLI mirrors the API flags for sessions, permissions, MCP, GitHub Enterprise hosts, attachments, and BYOK provider settings. JSON output redacts secret-like fields.

## Layout

| Path | Purpose |
|---|---|
| `src/` | Standalone runner, parser, auth/login helpers, and model discovery. |
| `bin/copilot-local.js` | CLI entry point. |
| `test/` | Node built-in test runner coverage. |
| `paperclip-adapter/` | Snapshot of the original Paperclip adapter package. |
| `paperclip-ui-integration/` | Snapshot of Paperclip UI integration. |
| `session-artifacts/` | Recovered plan, checkpoints, JSONL fixture, and smoke script. |
| `docs/` | Contract and integration notes. |
| `website/` | Docusaurus documentation site. |
