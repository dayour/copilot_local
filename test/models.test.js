import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COPILOT_LOCAL_MODELS,
  DEFAULT_COPILOT_LOCAL_MODEL,
  listCopilotLocalModels,
  listFallbackModels
} from "../src/models.js";

test("fallback model list exposes current model ids", () => {
  const modelIds = new Set(COPILOT_LOCAL_MODELS.map((model) => model.id));

  assert.ok(modelIds.has(DEFAULT_COPILOT_LOCAL_MODEL));
  assert.ok(modelIds.has("claude-opus-4.8"));
  assert.ok(modelIds.has("gpt-5.5"));
  assert.ok(modelIds.has("gpt-5.4"));
  assert.ok(modelIds.has("gpt-5.3-codex"));
  assert.ok(modelIds.has("gemini-3.5-flash"));
});

test("listFallbackModels returns a fresh array copy", () => {
  const first = listFallbackModels();
  const second = listFallbackModels();

  assert.notEqual(first, second);
  first.pop();
  assert.equal(second.length, COPILOT_LOCAL_MODELS.length);
});

test("listCopilotLocalModels falls back without credentials", async () => {
  const models = await listCopilotLocalModels({
    tokenSource: "env",
    env: {},
    timeoutMs: 1
  });

  assert.deepEqual(models, listFallbackModels());
});
