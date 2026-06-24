import { execute, sessionCodec, testEnvironment } from "@paperclipai/adapter-copilot-local/server";
import { type, label, models } from "@paperclipai/adapter-copilot-local";

const cwd = "D:\\Github\\copilot-sdk";

console.log("==> adapter metadata");
console.log({ type, label, modelCount: models.length, defaultModel: models[0].id });

console.log("\n==> testEnvironment");
const env = await testEnvironment({
  companyId: "smoke-co",
  adapterType: "copilot_local",
  config: { cwd, command: "copilot" },
});
console.log("status:", env.status, "checks:", env.checks.length);
for (const c of env.checks) console.log(` - [${c.level}] ${c.code}: ${c.message}`);

console.log("\n==> execute (1st run)");
const stdoutChunks = [];
const stderrChunks = [];
const result = await execute({
  runId: "smoke-run-1",
  agent: { id: "smoke-agent", companyId: "smoke-co", name: "smoke", adapterType: "copilot_local", adapterConfig: {} },
  runtime: { sessionId: null, sessionParams: null, sessionDisplayId: null, taskKey: null },
  config: {
    cwd,
    command: "copilot",
    promptTemplate: "Reply with the single word: hello",
    timeoutSec: 90,
    graceSec: 10,
  },
  context: {},
  onLog: async (stream, chunk) => {
    if (stream === "stdout") stdoutChunks.push(chunk);
    else stderrChunks.push(chunk);
  },
  onMeta: async (meta) => {
    console.log("onMeta: command=", meta.command, "args.count=", meta.commandArgs?.length, "cwd=", meta.cwd);
  },
});

console.log("\nresult summary:");
console.log({
  exitCode: result.exitCode,
  timedOut: result.timedOut,
  signal: result.signal,
  errorMessage: result.errorMessage,
  provider: result.provider,
  model: result.model,
  sessionId: result.sessionId,
  sessionDisplayId: result.sessionDisplayId,
  usage: result.usage,
  costUsd: result.costUsd,
  summary: result.summary?.slice(0, 200),
  premiumRequests: result.resultJson?.premiumRequests,
});

console.log("\n==> sessionCodec round-trip");
const serialized = sessionCodec.serialize(result.sessionParams);
const deserialized = sessionCodec.deserialize(serialized);
console.log({ serialized, deserialized, displayId: sessionCodec.getDisplayId?.(deserialized) });

if (result.sessionId) {
  console.log("\n==> execute (2nd run, --resume)");
  const result2 = await execute({
    runId: "smoke-run-2",
    agent: { id: "smoke-agent", companyId: "smoke-co", name: "smoke", adapterType: "copilot_local", adapterConfig: {} },
    runtime: {
      sessionId: result.sessionId,
      sessionParams: result.sessionParams,
      sessionDisplayId: result.sessionDisplayId,
      taskKey: null,
    },
    config: {
      cwd,
      command: "copilot",
      promptTemplate: "What was the previous word you said? Just the word.",
      timeoutSec: 90,
      graceSec: 10,
    },
    context: {},
    onLog: async () => {},
    onMeta: async () => {},
  });
  console.log({
    exitCode: result2.exitCode,
    sessionId: result2.sessionId,
    resumeMatched: result2.sessionId === result.sessionId,
    summary: result2.summary?.slice(0, 200),
    premiumRequests: result2.resultJson?.premiumRequests,
  });
}
