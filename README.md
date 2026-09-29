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

## SDK-backed provider for Paperclip

`createCopilotSdkAdapter()` is an opt-in alternative to the existing CLI-shelling
`createCopilotLocalAdapter()`. It uses `@github/copilot-sdk` and its bundled CLI
server; no direct requests to a model vendor or Copilot REST API are made by
this provider. Paperclip can call `listModels(hints)` and `run(options)` on the
returned `{ type: "copilot_local", defaultModel, listModels, run }` object.

```js
import { createCopilotSdkAdapter } from "copilot-local-adapter/sdkProvider";

const adapter = createCopilotSdkAdapter();
const models = await adapter.listModels(); // [{ id, name, label, capabilities, policy?, billing?, ... }]
const result = await adapter.run({
  prompt: "Continue the assigned Paperclip task",
  cwd: "D:\\work\\project",
  model: models[0].id,
  resumeSessionId: savedSessionId, // optional; stale IDs start a new session
  onStdout: (jsonl) => onLog("stdout", jsonl)
});
// Persist result.sessionParams (sessionId + cwd); result.clearSession signals a stale-session retry.
```

`listCopilotSdkModels(options)` uses `CopilotClient.listModels()` rather than a
hardcoded list; it removes duplicates, embedding models and policy-disabled
models (pass `includeDisabled: true` to keep disabled entries). It preserves SDK
capabilities, reasoning efforts, policy and billing, and adds a `label` for
Paperclip's model picker. Model discovery errors propagate rather than
advertising unavailable static models. A custom BYOK provider should supply
its own `clientOptions.onListModels` catalog: the subscription model list does
not describe models on an arbitrary provider endpoint.

`runCopilotSdk(options)` accepts native SDK `sessionConfig` fields plus top-level
`model`, `reasoningEffort`, `provider`, `tools`, `mcpServers`, `customAgents`,
`agent`, `availableTools`, `excludedTools`, `skillDirectories`, `streaming`,
`onPermissionRequest`, `cwd`, `prompt`, `resumeSessionId`, `timeoutMs`, and
`onEvent`. Existing Paperclip BYOK shorthand `byokBaseUrl`/`byokApiKey` (or
`providerBaseUrl`/`providerApiKey`/`providerType`/`providerWireApi`) becomes
a native SDK `ProviderConfig`. **BYOK requires an explicit model ID**; the
SDK will not infer the remote provider's model. Tool permissions default to
approve-once for parity with the CLI adapter's `--allow-all-tools`; use
`allowAllTools: false` or supply `onPermissionRequest` to restrict them.
`onStdout` receives SDK events serialized as JSONL, and `run` returns the
existing `sessionId`, `sessionParams` (`{ sessionId, cwd }`), `model`, `provider`, `summary`, `usage`, `clearSession`,
`errorMessage`, `resultJson` fields, plus `biller` (`subscription`/`byok`).
It does not emit a CLI `result` event, does not expose a child-process PID or
support the CLI-only `extraArgs`/`--add-dir` flags. Its client is started and
stopped per call unless an already-managed `client` is supplied. `cwd` sets
both the SDK runtime's `workingDirectory` and the session working directory.
Top-level `cliPath` selects the SDK's stdio runtime executable via
`RuntimeConnection.forStdio({ path: cliPath })`; it cannot be combined with
`clientOptions.connection`. `clientOptions` accepts native SDK options such
as `gitHubToken`, `workingDirectory`, `connection`, and `onListModels`.
`buildCopilotSdkClientOptions(options)` exposes this client-option translation
without starting a runtime.
For an opt-in live SDK tool-calling check (requires Copilot authentication and
an available model), run `node .\test\sdk-tool.smoke.js` from this package root.
Set `COPILOT_SMOKE_MODEL` to a model ID if the default selection is unavailable.
The check registers only a harmless fixed-token tool, verifies its invocation
and completion events and the final assistant response, and does not use a
Paperclip workspace.
The archived `paperclip-adapter/` snapshot still runs the CLI directly; its
model/execute routes must be wired to these exports by the Paperclip host to
select SDK execution.
For initial validation in a Paperclip checkout, use the adapter as a workspace
package/builtin and wire those routes there. The archived package depends on
`@paperclipai/adapter-utils: workspace:*` and its development exports point to
TypeScript source, so it is not a drop-in external npm plugin without separately
building/packaging it and resolving that workspace dependency. Once the SDK
route works in Paperclip, the same interface can be shipped as a local plugin.

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
