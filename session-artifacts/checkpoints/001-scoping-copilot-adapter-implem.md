<overview>
The user wants Paperclip (a control plane for autonomous AI companies at D:\Github\paperclip) to gain a first-class GitHub Copilot CLI adapter as a new dedicated package. The approach is to scaffold `packages/adapters/copilot-local` using `copilot -p ... --output-format json` as the execution contract, register it across server/UI/CLI, and validate against D:\Github\copilot-sdk. The user just switched into fleet mode, asking for parallel agent dispatch to implement and validate the plan with engineering excellence (and clean up spaghetti as encountered).
</overview>

<history>
1. User asked to "review the codebase for the copilot (github) model provider"
   - I traced provider wiring: confirmed there is no dedicated Copilot/GitHub adapter in Paperclip
   - Found GitHub support is only implicit (via OpenCode/Codex multi-provider adapters)
   - Identified one concrete bug: server hard-fails OpenCode agent create/update/import unless live model discovery succeeds, blocking manual provider/model entry

2. User asked to "Let's add a first class model provider and validate it D:\Github\copilot-sdk"
   - I loaded the `create-agent-adapter` skill which provided full Paperclip adapter contract docs

3. I asked whether to add provider support inside existing adapters or create a new dedicated package
   - User chose: "A new dedicated adapter package"
   - User then provided the GitHub docs URL: https://docs.github.com/en/copilot/reference/ai-models/supported-models

4. I investigated the runtime contract:
   - Read Paperclip's GOAL.md, PRODUCT.md, SPEC-implementation.md, DEVELOPING.md, DATABASE.md
   - Read the three adapter registries (server, UI, CLI) — Paperclip has 8 built-in adapters: claude_local, codex_local, opencode_local, pi_local, cursor, gemini_local, openclaw_gateway, hermes_local
   - Probed Copilot CLI v1.0.32: confirmed `copilot -p "..." --output-format json --allow-all-tools` produces JSONL events, supports `--resume=<sessionId>`, `--model <name>`, `--add-dir`
   - Tested resume behavior: stable sessionId, even invalid UUIDs are accepted (creates new session with that UUID — no stale-session error needed)
   - Identified key JSONL event types: `session.mcp_servers_loaded`, `session.skills_loaded`, `session.tools_updated`, `user.message`, `assistant.turn_start`, `assistant.message` (with `toolRequests` array), `assistant.reasoning`, `tool.execution_start`, `tool.execution_complete`, `assistant.turn_end`, `result` (with sessionId, exitCode, usage.premiumRequests)
   - Fetched GitHub Copilot supported-models docs — markdown body has empty tables (data injected client-side), so adapter must ship a curated catalog
   - Discovered BYOK/custom-provider env vars: COPILOT_PROVIDER_BASE_URL, COPILOT_PROVIDER_TYPE, COPILOT_MODEL, etc.

5. I created the plan file at `C:\Users\dayour\.copilot\session-state\c37b3db6-8e22-4598-9d81-567412f7647e\plan.md` documenting the approach.

6. **Tools changed mid-conversation**: model switched from gpt-5.4 to claude-opus-4.7. New tools: `create`, `edit`, `grep`. Removed: `apply_patch`, `rg`. (The plan.md was created via the now-removed `apply_patch` tool — it should already exist on disk.)

7. User then issued the fleet-mode request: "review the plan and deploy a fleet of agents to implement and validate ~\.copilot\session-state\c37b3db6-8e22-4598-9d81-567412f7647e\plan.md engineering excellence, clean up spaghetti code if you come across it along the way"
   - Conversation was compacted before I could begin dispatch.
</history>

<work_done>
Files created:
- `C:\Users\dayour\.copilot\session-state\c37b3db6-8e22-4598-9d81-567412f7647e\plan.md` — captures problem, approach, todos, and notes for the Copilot adapter implementation

Investigations completed:
- [x] Confirmed no existing Copilot adapter in Paperclip; GitHub support is implicit only
- [x] Mapped the Paperclip 4-export adapter contract (`.`, `./server`, `./ui`, `./cli`)
- [x] Verified `copilot` CLI v1.0.32 runtime: JSONL output format, sessionId resume, --model flag
- [x] Confirmed D:\Github\copilot-sdk exists (looks like the GitHub Copilot SDK repo with dotnet/go/java/nodejs/python directories — usable as a smoke-test workspace)
- [x] Wrote plan.md

Not yet done:
- [ ] Created todos in SQL (no tables exist yet)
- [ ] Scaffolded `packages/adapters/copilot-local`
- [ ] Implemented server execute/parse/test/sessionCodec
- [ ] Implemented UI parse-stdout/build-config/ConfigFields
- [ ] Implemented CLI formatter
- [ ] Registered in three registries (server/ui/cli)
- [ ] Wrote tests
- [ ] Ran `pnpm test`, `pnpm -r typecheck`, `pnpm build`
- [ ] Validated with smoke run in D:\Github\copilot-sdk
</work_done>

<technical_details>
**Copilot CLI runtime contract** (validated empirically on Windows with v1.0.32):
- Command: `copilot -p "<prompt>" --output-format json --allow-all-tools --no-custom-instructions [--model <model>] [--resume=<sessionId>] [--add-dir <dir>]`
- Note: `--allow-all-tools` is REQUIRED for non-interactive mode (per `--help`)
- JSONL events have shape `{"type": "...", "data": {...}, "id", "timestamp", "parentId", "ephemeral?: true}`
- Final `result` event: `{"type":"result","sessionId":"<uuid>","exitCode":0,"usage":{"premiumRequests":N,"totalApiDurationMs":N,"sessionDurationMs":N,"codeChanges":{...}}}`
- `assistant.message` carries `content` (text) and `toolRequests` array; reasoning is in `reasoningOpaque` (encrypted, ignore for display)
- `tool.execution_start` / `tool.execution_complete` events include `toolName`, `arguments`, and `result.content`
- Cost model: `usage.premiumRequests` (NOT token counts) — this is significant because Paperclip's cost_events table expects `input_tokens`, `output_tokens`, `cost_cents`. Adapter should report premium requests as a proxy or compute approximate tokens.

**Resume behavior**: `--resume=<uuid>` works for both real and arbitrary UUIDs — invalid IDs create a new session with that UUID rather than erroring. Means the unknown-session retry pattern from claude/codex adapters is unnecessary.

**Default model**: gpt-5.4 (when no --model specified); explicit options include `gpt-5.2`, `gpt-5.3-codex`, `claude-sonnet-4.5`, `claude-sonnet-4.6`, `claude-opus-4.7`, `gpt-5-mini`, `gpt-4.1`, `gemini-3.1-pro`, `goldeneye`, etc. (per docs and `/model` command).

**Authentication**: GitHub OAuth via `copilot login` OR `GH_TOKEN`/`GITHUB_TOKEN` env var with PAT having "Copilot Requests" permission. BYOK mode via `COPILOT_PROVIDER_BASE_URL`.

**Paperclip adapter conventions** (from skill + registry inspection):
- Type names: snake_case → use `copilot_local`
- Package name: `@paperclipai/adapter-copilot-local`
- Must implement `ServerAdapterModule`, `UIAdapterModule`, `CLIAdapterModule`
- `testEnvironment` returns structured checks (info/warn/error → pass/warn/fail)
- Session resume must be cwd-aware to avoid cross-project contamination
- Skills injection: claude-local uses tmpdir+symlink+`--add-dir`; this pattern works for Copilot too (it supports `--add-dir`)
- Built-in registration goes in `server/src/adapters/registry.ts`, `ui/src/adapters/registry.ts`, `cli/src/adapters/registry.ts`

**Spaghetti to flag** (found during review):
- `server/src/routes/agents.ts:571-585` and `server/src/services/company-portability.ts:2773-2786` hard-fail on OpenCode model availability — blocks manual model entry
- `ui/src/adapters/registry.ts` has heavy override-lifecycle gymnastics (lines 142-256) that may not need new patterns for a built-in adapter

**Workspace details**:
- Windows paths required (backslashes)
- Vite build hangs on NTFS — use `node node_modules/vite/bin/vite.js build` instead
- Test commands: `pnpm test` (vitest only, default), `pnpm test:e2e`, `pnpm test:release-smoke`
- Full verify: `pnpm -r typecheck && pnpm test:run && pnpm build`

**Validation target**: D:\Github\copilot-sdk contains assets/, dotnet/, docs/, go/, java/, nodejs/, python/, scripts/, test/ — appears to be the GitHub Copilot SDK repo. Suitable as a non-trivial smoke workspace.

**Open question**: How to map `usage.premiumRequests` to Paperclip's token-based cost_events schema? Options: (1) report premiumRequests as a cost annotation only, (2) approximate tokens from sessionDurationMs, (3) leave tokens as 0 and use a custom field. Recommend option (1) — store premium requests in `resultJson` and leave cost_cents/tokens at 0 since GitHub bills by request, not tokens.
</technical_details>

<important_files>
- `C:\Users\dayour\.copilot\session-state\c37b3db6-8e22-4598-9d81-567412f7647e\plan.md`
   - The implementation plan to execute
   - Contains problem, approach, todos, and key technical notes
- `D:\Github\paperclip\packages\adapters\opencode-local\` (REFERENCE)
   - Cleanest existing template for a new local CLI adapter
   - Mirror its structure: `package.json`, `src/index.ts`, `src/server/{index,execute,parse,test,models}.ts`, `src/ui/{index,parse-stdout,build-config}.ts`, `src/cli/{index,format-event}.ts`
- `D:\Github\paperclip\packages\adapter-utils\src\types.ts` (REFERENCE)
   - All adapter interfaces and types
- `D:\Github\paperclip\server\src\adapters\registry.ts` (TO MODIFY)
   - Lines 1-247 — add Copilot adapter import and `copilotLocalAdapter` registration
- `D:\Github\paperclip\ui\src\adapters\registry.ts` (TO MODIFY)
   - Add `copilotLocalUIAdapter` import and registration in `registerBuiltInUIAdapters` (lines 48-65)
- `D:\Github\paperclip\cli\src\adapters\registry.ts` (TO MODIFY)
   - Add `copilotLocalCLIAdapter` to the map (lines 47-59)
- `D:\Github\paperclip\packages\adapters\claude-local\src\server\execute.ts` (REFERENCE)
   - Best pattern for skills injection via tmpdir+symlink+`--add-dir`
- `D:\Github\paperclip\AGENTS.md` (CONSTRAINT)
   - Engineering rules: company-scoped, sync contracts across db/shared/server/ui, preserve invariants
- `D:\Github\copilot-sdk\` (VALIDATION TARGET)
   - User-specified smoke-test workspace
</important_files>

<next_steps>
Remaining work (decompose into todos and dispatch in parallel):

1. **Scaffold package** (todo: `scaffold-package`)
   - Create `packages/adapters/copilot-local/package.json`, `tsconfig.json`, directory structure
   - Create root `src/index.ts` with `type="copilot_local"`, `label="GitHub Copilot (local)"`, `models[]` (curated list), `agentConfigurationDoc`

2. **Server module** (todo: `server-module`, depends on scaffold)
   - `src/server/execute.ts` — spawn `copilot -p`, parse JSONL, handle session resume cwd-aware
   - `src/server/parse.ts` — JSONL event parser, extract sessionId/usage/summary
   - `src/server/test.ts` — `testEnvironment` checking command resolvable, GH_TOKEN/login state, --add-dir support
   - `src/server/models.ts` — built-in catalog (gpt-5.4, gpt-5.2, gpt-5.3-codex, gpt-5-mini, claude-sonnet-4.5/4.6, claude-opus-4.7, gemini-3.1-pro, etc.)
   - `src/server/index.ts` — exports including `sessionCodec`

3. **UI module** (todo: `ui-module`, depends on scaffold)
   - `src/ui/parse-stdout.ts` — JSONL → TranscriptEntry[] (init/assistant/tool_call/tool_result/result/stderr)
   - `src/ui/build-config.ts` — CreateConfigValues → adapterConfig
   - `ui/src/adapters/copilot-local/config-fields.tsx` + `index.ts` in main UI

4. **CLI module** (todo: `cli-module`, depends on scaffold)
   - `src/cli/format-event.ts` — colored terminal output for `paperclipai run --watch`

5. **Registration** (todo: `register`, depends on server/ui/cli modules)
   - Edit three registries, add to BUILTIN_ADAPTER_TYPES

6. **Tests** (todo: `tests`, depends on registration)
   - Parser tests, session codec round-trip, env diagnostics, build-config

7. **Validation** (todo: `validate`, depends on tests)
   - `pnpm install && pnpm -r typecheck && pnpm test:run && pnpm build`
   - Smoke run: create test agent pointing at D:\Github\copilot-sdk, invoke a heartbeat

8. **Spaghetti cleanup** (todo: `cleanup`, opportunistic)
   - Document or fix the OpenCode hard-fail-on-discovery issue spotted in agents.ts:571 and company-portability.ts:2773 (only if directly relevant; otherwise note as follow-up)

Immediate next steps after compaction:
1. Verify plan.md exists at the session-state path
2. Insert todos into SQL `todos` table with the dependencies above
3. Dispatch fleet: 4 parallel background agents for scaffold (sync, fast) → then server/ui/cli in parallel → then registration → then tests/validation in parallel
4. After all return, verify SQL status, run final `pnpm -r typecheck && pnpm test:run` myself, perform smoke validation against D:\Github\copilot-sdk
</next_steps>