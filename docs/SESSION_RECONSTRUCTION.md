# Session reconstruction

Primary session: `c37b3db6-8e22-4598-9d81-567412f7647e`

## Local session artifacts

Recovered from:

```text
C:\Users\dayour\.copilot\session-state\c37b3db6-8e22-4598-9d81-567412f7647e
```

Exported artifacts:

- `session-artifacts/plan.md`
- `session-artifacts/checkpoints/001-scoping-copilot-adapter-implem.md`
- `session-artifacts/checkpoints/002-fixing-copilot-local-model-dro.md`
- `session-artifacts/checkpoints/003-opening-copilot-adapter-pr.md`
- `session-artifacts/files/copilot-sample-tool.jsonl`
- `session-artifacts/files/smoke.mjs`

## Key findings from the session

- Paperclip had no dedicated GitHub Copilot adapter at the start.
- The chosen adapter type was `copilot_local`.
- The implementation initially used the Copilot CLI JSONL contract, not the official `@github/copilot-sdk` JSON-RPC SDK.
- Smoke target was `D:\Github\copilot-sdk`.
- `--resume=<sessionId>` worked for session continuity.
- Billing metadata surfaced as `usage.premiumRequests`, not USD/token cost.
- The first live model issue was caused by running a published Paperclip server that did not include the local adapter.

## Related local sessions from `C:\Users\dayour\.copilot\session-store.db`

- `474be375-b0c9-4cd8-9bca-4f2e5021b6f6`: filed CLI-11 for the adapter.
- `a5d79c08-b1f7-4436-9cb9-c2b45802aa96`: wrote the Copilot adapter ADR.
- `388d598e-f822-442b-8ec1-dd41f4856c1f`: postmortem/runbook work after `copilot_local` went live.

Raw Copilot session DBs and full event logs were not copied into this export to avoid bundling unrelated local session history.
