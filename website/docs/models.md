---
sidebar_position: 3
---

# Model Catalog

The adapter maintains a catalog of supported models with their capabilities and token limits.

See [`src/models.js`](https://github.com/dayour/copilot_local/blob/main/src/models.js) for the full listing.

## Usage

```js
import { MODELS } from 'copilot-local-adapter/models';

// List available model IDs
console.log(Object.keys(MODELS));

// Get model info
const opus = MODELS['claude-opus-4.7'];
console.log(opus.maxTokens, opus.provider);
```

## Specifying a Model

Pass `--model <id>` on the CLI or `model` in the programmatic API:

```bash
node ./bin/copilot-local.js --model claude-sonnet-4.5 --prompt "hello"
```
