---
sidebar_position: 3
---

# Model Catalog

The adapter can discover models from the Copilot API when credentials are available, and otherwise returns a maintained fallback list.

## Exports

```js
import {
  DEFAULT_COPILOT_LOCAL_MODEL,
  COPILOT_LOCAL_MODELS,
  listFallbackModels,
  listCopilotLocalModels
} from 'copilot-local-adapter/models';

console.log(DEFAULT_COPILOT_LOCAL_MODEL); // gpt-5.4
console.log(listFallbackModels().map((model) => model.id));
```

`COPILOT_LOCAL_MODELS` is an array of `{ id, label }` entries, not a keyed `MODELS` object. Use `listFallbackModels()` when callers may mutate the returned array.

## Dynamic Discovery

```js
const models = await listCopilotLocalModels({
  tokenSource: 'auto',
  gheHost: undefined
});
```

Discovery uses Copilot-compatible tokens from environment variables or `gh auth token`, discovers the Copilot API endpoint when needed, calls `/models`, filters embedding models, and normalizes labels. Missing credentials, unsupported `ghp_` tokens, network errors, and empty API responses all fall back to the static catalog.

## Specifying a Model

Pass `--model <id>` on the CLI or `model` in the programmatic API:

```bash
node ./bin/copilot-local.js --model claude-sonnet-4.6 --prompt "hello"
```
