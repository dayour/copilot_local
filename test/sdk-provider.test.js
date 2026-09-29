import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  buildCopilotSdkClientOptions,
  createCopilotSdkAdapter,
  listCopilotSdkModels,
  runCopilotSdk
} from "../src/sdkProvider.js";

test("official Copilot SDK dependency exports the client used by the provider", async () => {
  const sdk = await import("@github/copilot-sdk");
  assert.equal(typeof sdk.CopilotClient, "function");
});

test("client cwd and cliPath use SDK 1.0.15 workingDirectory and stdio connection", async () => {
  const sdk = await import("@github/copilot-sdk");
  const onListModels = () => [];
  const options = await buildCopilotSdkClientOptions({
    cwd: ".",
    cliPath: "D:\\tools\\copilot.exe",
    clientOptions: { onListModels, env: { COPILOT_TEST_CONFIG: "client" } },
    env: { COPILOT_TEST_RUN: "run" }
  });
  assert.equal(options.workingDirectory, path.resolve("."));
  assert.equal(options.cwd, undefined);
  assert.equal(options.cliPath, undefined);
  assert.deepEqual(options.connection, sdk.RuntimeConnection.forStdio({ path: "D:\\tools\\copilot.exe" }));
  assert.equal(options.onListModels, onListModels);
  assert.equal(options.env.COPILOT_TEST_CONFIG, "client");
  assert.equal(options.env.COPILOT_TEST_RUN, "run");
  assert.equal(typeof new sdk.CopilotClient(options).listModels, "function");

  const existingConnection = sdk.RuntimeConnection.forUri("127.0.0.1:1234");
  const preserved = await buildCopilotSdkClientOptions({
    clientOptions: { workingDirectory: "D:\\existing", connection: existingConnection }
  });
  assert.equal(preserved.workingDirectory, "D:\\existing");
  assert.equal(preserved.connection, existingConnection);
  await assert.rejects(buildCopilotSdkClientOptions({
    cliPath: "copilot",
    clientOptions: { connection: existingConnection }
  }), /cannot be combined/);
  await assert.rejects(buildCopilotSdkClientOptions({ cliPath: " " }), /non-empty/);
  await assert.rejects(listCopilotSdkModels({ cliPath: " " }), /non-empty/);
  await assert.rejects(runCopilotSdk({ prompt: "hello", cliPath: " " }), /non-empty/);
});

function mockSdk({ missingSession = false, missingOnSend = false, sendError = null } = {}) {
  const calls = { starts: 0, stops: 0, creates: [], resumes: [], disconnects: 0, sends: [] };
  const session = {
    sessionId: "new-session",
    async sendAndWait(message, timeoutMs) {
      calls.sends.push({ message, timeoutMs });
      if (missingOnSend && calls.resumes.length && !calls.creates.length) throw new Error("unknown session");
      if (sendError) throw new Error(sendError);
      calls.config.onEvent({ type: "assistant.message_delta", data: { deltaContent: "Hello" } });
      calls.config.onEvent({ type: "assistant.message", data: { content: "Hello", outputTokens: 2 } });
      calls.config.onEvent({ type: "assistant.usage", data: {
        inputTokens: 8, outputTokens: 2, cacheReadTokens: 3, model: "claude-opus-4.8"
      } });
      return { data: { content: "Hello" } };
    },
    async disconnect() { calls.disconnects += 1; }
  };
  const client = {
    async start() { calls.starts += 1; },
    async stop() { calls.stops += 1; },
    async listModels() {
      return [
        { id: "claude-opus-4.8", name: "Claude Opus 4.8", capabilities: { supports: {}, limits: { max_context_window_tokens: 200000 } }, supportedReasoningEfforts: ["high"] },
        { id: "gpt-5.4", name: "GPT-5.4", policy: { state: "disabled", terms: "" } },
        { id: "claude-opus-4.8", name: "Duplicate" },
        { id: "text-embedding-3", name: "Embeddings" }
      ];
    },
    async createSession(config) {
      calls.creates.push(config);
      calls.config = config;
      return session;
    },
    async resumeSession(id, config) {
      calls.resumes.push(id);
      calls.config = config;
      if (missingSession) throw new Error("session not found");
      return { ...session, sessionId: id };
    }
  };
  return { client, calls };
}

test("SDK catalog reflects policy, metadata, and lifecycle instead of static model IDs", async () => {
  const { client, calls } = mockSdk();
  const models = await listCopilotSdkModels({ createClient: async () => client });
  assert.deepEqual(models.map(({ id }) => id), ["claude-opus-4.8"]);
  assert.equal(models[0].label, "Claude Opus 4.8");
  assert.deepEqual(models[0].supportedReasoningEfforts, ["high"]);
  assert.equal(models[0].capabilities.limits.max_context_window_tokens, 200000);
  assert.deepEqual([calls.starts, calls.stops], [1, 1]);
  assert.deepEqual((await listCopilotSdkModels({ client, includeDisabled: true })).map(({ id }) => id),
    ["claude-opus-4.8", "gpt-5.4"]);
  assert.equal(calls.stops, 1, "an injected SDK client remains caller-owned");
});

test("SDK run passes model, native provider and tools through, then returns Paperclip-style result", async () => {
  const { client, calls } = mockSdk();
  const output = [];
  const result = await runCopilotSdk({
    createClient: async () => client,
    cwd: process.cwd(),
    prompt: "Say hello",
    model: "claude-opus-4.8",
    provider: { type: "anthropic", baseUrl: "https://provider.example", apiKey: "secret" },
    availableTools: ["view"],
    timeoutMs: 1200,
    onStdout: (chunk) => output.push(chunk)
  });
  assert.equal(calls.creates[0].model, "claude-opus-4.8");
  assert.deepEqual(calls.creates[0].provider, { type: "anthropic", baseUrl: "https://provider.example", apiKey: "secret" });
  assert.deepEqual(calls.creates[0].availableTools, ["view"]);
  assert.deepEqual(calls.creates[0].onPermissionRequest(), { kind: "approve-once" });
  assert.deepEqual(calls.sends[0], { message: { prompt: "Say hello" }, timeoutMs: 1200 });
  assert.equal(result.sessionId, "new-session");
  assert.deepEqual(result.sessionParams, { sessionId: "new-session", cwd: process.cwd() });
  assert.equal(result.sessionDisplayId, "new-session");
  assert.equal(result.model, "claude-opus-4.8");
  assert.equal(result.biller, "byok");
  assert.equal(result.summary, "Hello", "delta and complete event must not double the summary");
  assert.equal(result.usage.inputTokens, 8);
  assert.equal(result.usage.outputTokens, 2, "usage event and message output tokens must not be added twice");
  assert.equal(result.usage.cachedInputTokens, 3);
  assert.equal(result.exitCode, 0);
  assert.equal(output.length, 3);
  assert.deepEqual([calls.disconnects, calls.stops], [1, 1]);
});

test("SDK run retries a missing resumed session and respects denied permissions", async () => {
  const { client, calls } = mockSdk({ missingSession: true });
  const adapter = createCopilotSdkAdapter({ createClient: async () => client, cwd: process.cwd() });
  const result = await adapter.run({
    prompt: "Say hello", resumeSessionId: "stale-session", model: "gpt-5.4",
    allowAllTools: false
  });
  assert.equal(adapter.type, "copilot_local");
  assert.deepEqual(calls.resumes, ["stale-session"]);
  assert.equal(calls.creates.length, 1);
  assert.deepEqual(calls.creates[0].onPermissionRequest(), { kind: "denied-interactively-by-user" });
  assert.equal(result.clearSession, true);
  assert.equal(result.sessionId, "new-session");
});

test("SDK run retries when the resumed session disappears on send", async () => {
  const { client, calls } = mockSdk({ missingOnSend: true });
  const result = await runCopilotSdk({
    createClient: async () => client, prompt: "hello", resumeSessionId: "old-session"
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.clearSession, true);
  assert.equal(result.sessionId, "new-session");
  assert.equal(calls.sends.length, 2);
  assert.equal(calls.disconnects, 2);
});

test("Paperclip BYOK shorthand becomes native SDK provider configuration", async () => {
  const { client, calls } = mockSdk();
  await runCopilotSdk({
    client,
    prompt: "hello",
    model: "deployment-1",
    byokBaseUrl: "https://azure.example",
    byokApiKey: "secret",
    providerType: "azure",
    providerWireApi: "responses",
    providerAzureApiVersion: "2024-10-21"
  });
  assert.deepEqual(calls.creates[0].provider, {
    type: "azure",
    baseUrl: "https://azure.example",
    apiKey: "secret",
    wireApi: "responses",
    azure: { apiVersion: "2024-10-21" }
  });
  assert.equal(calls.stops, 0);
});

test("SDK failures return errors and always stop owned clients", async () => {
  const { client, calls } = mockSdk({ sendError: "upstream unavailable" });
  const result = await runCopilotSdk({ prompt: "hello", createClient: async () => client });
  assert.equal(result.exitCode, 1);
  assert.match(result.errorMessage, /upstream unavailable/);
  assert.deepEqual([calls.disconnects, calls.stops], [1, 1]);
  await assert.rejects(runCopilotSdk({ prompt: "hello", provider: { baseUrl: "https://example.com" }, createClient: async () => client }),
    /requires a model/);
  assert.equal(calls.stops, 2);
  await assert.rejects(runCopilotSdk({ prompt: "" }), /non-empty prompt/);
});
