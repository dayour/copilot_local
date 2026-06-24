# Paperclip integration notes

The original adapter was designed as a Paperclip built-in named `copilot_local`.

## Source snapshots

- Adapter package: `paperclip-adapter/`
- UI module: `paperclip-ui-integration/copilot-local/`
- Original plan and checkpoints: `session-artifacts/`

## Paperclip registration points from the original implementation

- `server/src/adapters/registry.ts`
- `server/src/adapters/builtin-adapter-types.ts`
- `ui/src/adapters/registry.ts`
- `cli/src/adapters/registry.ts`
- `packages/shared/src/constants.ts`
- `server/package.json`, `ui/package.json`, `cli/package.json`

## Historical GitHub trail

- `paperclipai/paperclip#4096`: first PR opened from session output; closed.
- `paperclipai/paperclip#4193`: replacement PR from `dayour:chore/refresh-lockfile`; closed.
- `paperclipai/paperclip#4897`: later built-in dynamic-model-discovery attempt; open at time of review.
- `paperclipai/paperclip#4717`: external adapter triage summary linking `@superbiche/copilot-paperclip-adapter`.

## Current live local state at export time

Both local servers were healthy:

- `http://127.0.0.1:4344`
- `http://127.0.0.1:4343`

But `/api/adapters` did not include `copilot_local` or another Copilot adapter. The global adapter plugin store `~\.paperclip\adapter-plugins.json` was missing, so the external npm package was not installed into either local instance.
