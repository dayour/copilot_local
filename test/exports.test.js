import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCopilotHeaders,
  copilotLogin,
  listCopilotLocalModels,
  loginCopilotLocal,
  runCopilotLogin,
  runLogin,
  validateCopilotToken
} from "../src/index.js";

test("root exports include auth, login aliases, and dynamic models", () => {
  assert.equal(typeof buildCopilotHeaders, "function");
  assert.equal(typeof validateCopilotToken, "function");
  assert.equal(typeof listCopilotLocalModels, "function");
  assert.equal(loginCopilotLocal, copilotLogin);
  assert.equal(runCopilotLogin, copilotLogin);
  assert.equal(runLogin, copilotLogin);
});
