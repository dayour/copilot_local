import assert from "node:assert/strict";
import { test } from "node:test";

import { isCopilotAuthError, validateCopilotToken } from "../src/auth.js";

test("validateCopilotToken rejects classic ghp tokens", () => {
  const validation = validateCopilotToken("ghp_example");

  assert.equal(validation.valid, false);
  assert.match(validation.reason, /classic personal access tokens/i);
  assert.deepEqual(validateCopilotToken("github_pat_example"), { valid: true });
});

test("isCopilotAuthError recognizes auth failures without matching unrelated output", () => {
  assert.equal(isCopilotAuthError("401 Unauthorized"), true);
  assert.equal(isCopilotAuthError(null, "", "Copilot subscription required"), true);
  assert.equal(isCopilotAuthError("tool execution failed for another reason"), false);
});
