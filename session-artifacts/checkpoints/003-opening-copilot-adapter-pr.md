<overview>
User wants a first-class GitHub Copilot model provider for Paperclip (D:\Github\paperclip), built and validated against the local copilot-sdk repo (D:\Github\copilot-sdk). The `copilot_local` adapter has been built, registered, smoke-tested, and is now powering 9 live agents in the user's running Paperclip instance. Final task: review all changes, switch `gh auth` to `dayour`, and open a PR from `dayour`'s fork to upstream `paperclipai/paperclip` ("From Clippy, for Paperclip, for Clippy").
</overview>

<history>
1. User asked to review codebase for any existing GitHub Copilot model provider → none existed.

2. User asked to "add a first class model provider and validate it D:\Github\copilot-sdk" with link to GitHub Copilot supported-models docs.
   - Empirically validated `copilot` CLI v1.0.32 contract: `-p`, `--output-format json`, `--allow-all-tools` mandatory; `--resume <uuid>`; `usage.premiumRequests` instead of token cost; default model `gpt-5.4`; auth via `GH_TOKEN`/`GITHUB_TOKEN` or `copilot login`.

3. User: "Fleet deployed: review the plan and deploy a fleet of agents to implement and validate plan.md"
   - Single Opus 4.7 background agent created the package + UI files + 3 registry edits.
   - `pnpm install` → typecheck (server/ui/cli + package) all green; 4 new parser tests pass; full `pnpm test` 1342 pass with 0 copilot regressions; smoke `execute()` against D:\Github\copilot-sdk green twice (initial + --resume).

4. User: "did you add copilot sdk as a model provider like I asked?"
   - Admitted I built CLI-spawn, not the JSON-RPC `@github/copilot-sdk` SDK. User chose: keep CLI-spawn approach.

5. User: "Fix these so that Opus 4.7 is working properly http://127.0.0.1:3100/CLI/inbox/mine"
   - Diagnosed: server on port 3100 was the published `paperclipai` v2026.416.0 (npx cache at `C:\.tools\.npm\_npx\…\paperclipai`), which has no `copilot_local` adapter — that's why the dropdown was empty.
   - User chose: force-stamp migrations as already applied to preserve all data.
   - 54 of 58 Drizzle migration file hashes had drifted between v2026.416.0 and HEAD. Wrote `force-stamp-migrations.mjs` to compute new SHA256s from local files and overwrite `drizzle.__drizzle_migrations.hash` in journal order. Verified `inspectMigrations` → upToDate.
   - Started local CLI via `pnpm exec tsx cli/src/index.ts run` against the same `~/.paperclip/instances/default` data dir.
   - Verified: API returns all 11 Copilot models including `claude-opus-4.7`. Cleaned up the throwaway scripts.

6. User: "Use darbot-browser-mcp to fix these, make sure they use the copilot sdk model provider — ClippyEng run failed: Command not found in PATH: codex"
   - darbot-browser-mcp not available in this session; used Paperclip API directly.
   - All 9 agents already on `copilot_local`. The "codex not found" error was from stale failed runs (04:52, 04:54) before the agent was switched at 04:55. The current run (eaa1a80e-…) is alive and doing real work.
   - User accepted bumping Clippy + ClippyEng from `gpt-5.4` to `claude-opus-4.7`. Both PATCHed successfully.

7. User: "review the changes we made, then gh auth switch to dayour and create a pull request. From Clippy, for Paperclip for Clippy."
   - `gh auth switch -u dayour` worked but token was expired (Bad credentials).
   - User re-authenticated; `gh auth status` now shows `dayour` active with full repo/workflow scopes.
   - Reviewed `git status` and `git diff --stat HEAD`: 28 modified + 5 untracked files, +396/-46 lines. Inspected suspicious-looking diffs (NewIssueDialog, claude-local refactor, OnboardingWizard, AgentConfigForm, agent-config-primitives, InviteLanding, docs, server tests, shared constants, adapter-display-registry, use-adapter-capabilities, agents.ts, claude-local model-id.ts) — all confirmed coherent with the copilot_local addition (registry entries, UI labels/icons, instructions-bundle path key, test coverage, doc link, plus a small claude-local extraction of `normalizeClaudeModelId` to a new shared file).
   - Compaction triggered before forking/branching/pushing/PR creation.
</history>

<work_done>
Files created (Copilot adapter, complete and tested):
- `packages/adapters/copilot-local/package.json` (4-export: ., ./server, ./ui, ./cli)
- `packages/adapters/copilot-local/tsconfig.json`
- `packages/adapters/copilot-local/vitest.config.ts`
- `packages/adapters/copilot-local/src/index.ts` — type, label, 11-model curated catalog (gpt-5.4 default + claude-opus-4.7), agentConfigurationDoc, exports `DEFAULT_COPILOT_LOCAL_MODEL`
- `packages/adapters/copilot-local/src/server/{index,execute,parse,test}.ts` + `parse.test.ts` (4 tests pass)
- `packages/adapters/copilot-local/src/ui/{index,parse-stdout,build-config}.ts`
- `packages/adapters/copilot-local/src/cli/{index,format-event}.ts`
- `ui/src/adapters/copilot-local/{index.ts,config-fields.tsx}`
- `docs/adapters/copilot-local.md`
- `packages/adapters/claude-local/src/model-id.ts` — extracts `normalizeClaudeModelId()` (legacy `4.7→4-7` aliases + `anthropic/` prefix stripping)
- `ui/src/adapters/adapter-display-registry.test.ts`

Files modified:
- `server/src/adapters/builtin-adapter-types.ts` — added `"copilot_local"`
- `server/src/adapters/registry.ts` — `copilotLocalAdapter` registration with all capability flags
- `server/src/routes/agents.ts` — `copilot_local: "instructionsFilePath"` in `DEFAULT_INSTRUCTIONS_PATH_KEYS`
- `ui/src/adapters/registry.ts` — `copilotLocalUIAdapter`
- `ui/src/adapters/adapter-display-registry.ts` — Github icon entry
- `ui/src/adapters/use-adapter-capabilities.ts` — copilot_local KNOWN_DEFAULTS (supportsSkills:false, others true)
- `cli/src/adapters/registry.ts`
- `server/package.json`, `ui/package.json`, `cli/package.json`, `pnpm-lock.yaml`
- `packages/shared/src/constants.ts` — `AGENT_ADAPTER_TYPES` includes copilot_local
- `ui/src/components/{AgentConfigForm,OnboardingWizard,NewIssueDialog,agent-config-primitives}.tsx`, `ui/src/pages/InviteLanding.tsx` — copilot_local in dropdowns/help/icon/issue-options
- `ui/src/components/NewIssueDialog.test.tsx`
- `packages/adapters/claude-local/src/server/{execute,test}.ts` + `ui/build-config.ts` — wire `normalizeClaudeModelId` from new shared file
- `server/src/__tests__/{adapter-models,adapter-registry,adapter-routes,claude-local-adapter-environment,claude-local-execute}.test.ts`
- `docs/adapters/overview.md`, `docs/docs.json`

Live system state:
- Local CLI server running at port 3100 in shellId `paperclip-server` (sync command, still attached to that shell session) against `~/.paperclip/instances/default` data dir.
- Migration tracker force-stamped (54 hashes overwritten); `inspectMigrations` returns `upToDate`.
- Embedded postgres on port 54329; data preserved including company `77be2527-df89-4bfb-9deb-554dfb309393` (Clippyclaw) and 9 agents.
- All 9 agents on `copilot_local`; Clippy + ClippyArch + ClippyCTO + ClippyEng + ClippySec on `claude-opus-4.7`; ClippyDevOps + ClippyDocs on `gpt-5.4-mini`; ClippyPM + ClippyQA on `claude-sonnet-4.6`.

Verification done:
- [x] `pnpm install`
- [x] All 4 typechecks (package, server, ui, cli) clean
- [x] 4 new copilot parser tests pass + new tests for adapter-models/registry/routes pass
- [x] Full `pnpm test`: 1342 pass, 0 copilot regressions
- [x] Smoke: testEnvironment + execute (initial) + execute (--resume) all green against D:\Github\copilot-sdk
- [x] Live: API returns 11 Copilot models for `copilot_local`; ClippyEng currently running successfully on the new adapter

In-progress when summarized:
- [ ] gh auth re-verified as `dayour` — but no fork created, no branch created, no commit made, no push, no PR opened. The `gh diff` review just completed; was about to start staging/branching/forking/PR creation.
</work_done>

<technical_details>
**Copilot CLI runtime contract (validated v1.0.32):**
- Required flags: `-p "<prompt>"`, `--output-format json`, `--allow-all-tools` (mandatory for non-interactive), `--no-color`, `--log-level error`, `--no-auto-update`, `--add-dir <cwd>`
- Cost is `usage.premiumRequests` (not tokens). Adapter sets `costUsd: null`, surfaces `premiumRequests` in `resultJson`. `inputTokens` unavailable; only `outputTokens` per assistant.message summed.
- `--resume=<uuid>` accepts arbitrary UUIDs (creates new session if not found) — unknown-session retry kept defensively but rarely triggers.
- Auth: GitHub OAuth via interactive `copilot` login OR `GH_TOKEN`/`GITHUB_TOKEN`. No config-level API key.
- Default model: `gpt-5.4`. Curated 11-model list includes `claude-opus-4.7`, claude-sonnet-4.6/4.5, claude-haiku-4.5, gpt variants, gemini-3.1-pro.

**Drizzle migration force-stamp (one-time fix):**
- `drizzle.__drizzle_migrations` table stores SHA256 hash of each .sql file content, ordered by id.
- 58 local migrations in `packages/db/src/migrations/` with `meta/_journal.json` listing tag order.
- Published v2026.416.0 had applied all 58 but content of 54 files drifted in master → hash mismatch → drizzle saw them as pending.
- `reconcilePendingMigrationHistory()` was too cautious (couldn't safely conclude pre-applied) → wrote manual script: read each `${tag}.sql`, compute sha256, UPDATE by id (matches journal idx+1).
- After stamping: `inspectMigrations` reports `upToDate`. **Risk noted to user**: any migration with a real schema delta in the new content is silently skipped.
- Server config has `PAPERCLIP_MIGRATION_AUTO_APPLY` env var to bypass the migration prompt.

**Server topology gotcha:**
- Two separate `paperclipai` installations on this machine: published global at `C:\.tools\.npm\_npx\43414d9b790239bb\node_modules\paperclipai` (v2026.416.0) and local workspace at `D:\Github\paperclip` (v2026.417.0-canary.0 = HEAD).
- Both use the SAME data dir `~/.paperclip/instances/default` (Postgres on port 54329).
- The published one auto-launched via `paperclipai onboard --yes` and persisted across reboots.

**gh auth state:**
- 3 accounts in keyring: `dayour` (active, valid), `dayour_microsoft` (valid), `darbotlabs` (invalid token).
- All have `gist, read:org, repo, workflow` scopes.
- No `dayour/paperclip` fork verified yet; need to check or create.

**Adapter conventions (from `.agents/skills/create-agent-adapter/SKILL.md`):**
- 4-export package: `.`, `./server`, `./ui`, `./cli`
- Registries: `server/src/adapters/registry.ts`, `ui/src/adapters/registry.ts`, `cli/src/adapters/registry.ts`
- Built-in types listed in `server/src/adapters/builtin-adapter-types.ts`
- New: `ui/src/adapters/adapter-display-registry.ts` (icon/label/recommended) and `use-adapter-capabilities.ts` (KNOWN_DEFAULTS for SSR)

**PR template requirements (AGENTS.md §10):**
- Must use `.github/PULL_REQUEST_TEMPLATE.md` with sections: Thinking Path, What Changed, Verification, Risks, Model Used, Checklist
- All commits must include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer
- Branch convention: `feat/<slug>` (e.g. `feat/copilot-local-adapter`)

**Dev environment quirks:**
- Windows; `tsx` not on PATH at repo root → run via `cd <workspace>; pnpm exec tsx <file>`
- Vite build hangs on NTFS — use `node node_modules/vite/bin/vite.js build`
- Server startup from NTFS takes 30-60s
- Async/detached pnpm processes can fail to start cleanly; sync mode that backgrounds after initial_wait works better
- 40 pre-existing test failures unrelated to copilot — Windows process-spawn issues. Do not chase.

**User-stated preferences:**
- Keep CLI-spawn approach for `copilot_local` (NOT migrating to `@github/copilot-sdk` JSON-RPC client) — chosen 2026-04-19
- Force-stamp migrations preserving Clippyclaw data — chosen 2026-04-19
- Bump Clippy + ClippyEng to `claude-opus-4.7`; leave DevOps/Docs/PM/QA on their existing models
- Wants PR "From Clippy, for Paperclip for Clippy" — interpreting as: from `dayour` fork → `paperclipai/paperclip:master`, branded as a Clippy/Copilot adapter contribution
</technical_details>

<important_files>
- `D:\Github\paperclip\packages\adapters\copilot-local\src\index.ts`
   - Adapter root: type, label, 11-model catalog with `claude-opus-4.7`, exports `DEFAULT_COPILOT_LOCAL_MODEL`
- `D:\Github\paperclip\packages\adapters\copilot-local\src\server\execute.ts`
   - Core CLI-spawn execution; resolves session via `--resume <uuid>`, sums outputTokens, reports premiumRequests
- `D:\Github\paperclip\packages\adapters\copilot-local\src\server\test.ts`
   - testEnvironment: validates `copilot` CLI on PATH, GH_TOKEN/login present, cwd valid
- `D:\Github\paperclip\packages\adapters\copilot-local\src\server\parse.ts`
   - JSONL parser including `isCopilotUnknownSessionError()`
- `D:\Github\paperclip\ui\src\adapters\copilot-local\config-fields.tsx`
   - Renders only instructions-file input; model dropdown is rendered by parent form via API
- `D:\Github\paperclip\server\src\adapters\registry.ts`
   - `copilotLocalAdapter` registered (lines 22-30 imports, 134-146 adapter object, 257 inserted in array)
- `D:\Github\paperclip\packages\db\src\client.ts`
   - `inspectMigrations()`, `reconcilePendingMigrationHistory()`, `applyPendingMigrations()` — used to diagnose hash drift
- `D:\Github\paperclip\packages\db\src\migrations\meta\_journal.json`
   - 58 entries, defines order/tag for force-stamp
- `D:\Github\paperclip\.github\PULL_REQUEST_TEMPLATE.md`
   - REQUIRED template for the PR body — has Thinking Path / What Changed / Verification / Risks / Model Used / Checklist sections
- `D:\Github\paperclip\AGENTS.md`
   - §10 Pull Request Requirements + §11 Definition of Done; branch/commit conventions
- `C:\Users\dayour\.copilot\session-state\c37b3db6-8e22-4598-9d81-567412f7647e\plan.md` and `files/copilot-sample-tool.jsonl`
   - Plan + sample fixture artifact
- Modified UI/server/cli files (28 in total per `git diff --stat`) all coherent additions for `copilot_local`; nothing unrelated to remove from PR
</important_files>

<next_steps>
Remaining work — open PR from `dayour` fork to `paperclipai/paperclip:master`:

1. Stop/leave running paperclip-server shell as-is (it's serving the user's live UI — don't kill).
2. Check if `dayour/paperclip` fork exists: `gh repo view dayour/paperclip --json nameWithOwner,parent` → if 404, `gh repo fork paperclipai/paperclip --remote=false --clone=false`.
3. Add `dayour` remote: `git remote add dayour https://github.com/dayour/paperclip.git`.
4. Create branch from current master: `git checkout -b feat/copilot-local-adapter`.
5. Stage only the copilot-related changes (everything in current `git status` looks coherent and copilot-related — the 28 modified files + 5 untracked dirs/files. Use `git add -A`).
6. Commit with conventional message + Copilot co-author trailer:
   ```
   feat(adapters): add copilot_local adapter for GitHub Copilot CLI
   
   Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
   ```
7. Push: `git push dayour feat/copilot-local-adapter`.
8. Open PR using the `.github/PULL_REQUEST_TEMPLATE.md` structure. Title: `feat(adapters): add copilot_local adapter for GitHub Copilot CLI`. Required body sections:
   - **Thinking Path**: Paperclip already supports claude_local/codex_local; GitHub Copilot CLI v1.0.32 has matured into a viable provider with multi-model routing including Anthropic + OpenAI + Gemini models. Adding it lets users run Copilot's curated model catalog through the same heartbeat/session/instructions plumbing.
   - **What Changed**: New `@paperclipai/adapter-copilot-local` package with 4-export structure; registered in server/UI/CLI registries + builtin-adapter-types + AGENT_ADAPTER_TYPES; instructions-bundle key wired in agents.ts; UI label/icon/capabilities; small claude-local refactor extracting `normalizeClaudeModelId` to shared `model-id.ts`; new tests for adapter models/registry/routes; docs entry.
   - **Verification**: `pnpm -r typecheck` clean; `pnpm test:run` 1342 pass with 4 new copilot parser tests; smoke `execute()` against a real repo with copilot v1.0.32 produces JSONL with stable sessionId, `--resume` round-trips. Tested live in local Paperclip instance with 9 agents on copilot_local including `claude-opus-4.7`.
   - **Risks**: CLI-spawn (not the `@github/copilot-sdk` JSON-RPC SDK) — chosen for simplicity. Cost reported as `premiumRequests` (not USD). Auth requires interactive `copilot login` or env tokens. Curated model list may drift from official catalog over time.
   - **Model Used**: Claude Opus 4.7 (model ID: claude-opus-4.7), via GitHub Copilot CLI agent
   - **Checklist**: tick all
9. Use `gh pr create --repo paperclipai/paperclip --base master --head dayour:feat/copilot-local-adapter --title "..." --body-file <tempfile>`.

Open questions:
- Should the small claude-local refactor (extracting `normalizeClaudeModelId`) be split into a separate PR? User has not requested split — proceed with single PR.
- Is `dayour/paperclip` already forked? Check first; fork if needed.

Blockers: none — all systems verified working.
</next_steps>