import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CopilotClient, defineTool } from "@github/copilot-sdk";
import { listCopilotSdkModels, runCopilotSdk } from "../src/sdkProvider.js";

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolName = "copilot_local_smoke_token";
const token = "COPILOT_LOCAL_TOOL_SMOKE_7391";

async function main() {
  const events = [];
  let invocations = 0;
  const tool = defineTool(toolName, {
    description: "Return a fixed validation token that is not known until this tool is called.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    defer: "never",
    skipPermission: true,
    handler: (_arguments, invocation) => {
      assert.equal(invocation.toolName, toolName);
      invocations += 1;
      return token;
    }
  });

  const client = new CopilotClient({ workingDirectory: cwd });
  try {
    const models = await listCopilotSdkModels({ client });
    const requestedModel = process.env.COPILOT_SMOKE_MODEL;
    const model = requestedModel ?? ["gpt-5-mini", "gpt-5.4-mini", "claude-haiku-4.5"]
      .find((id) => models.some((entry) => entry.id === id));
    assert.ok(model && models.some((entry) => entry.id === model),
      `No suitable available smoke model; set COPILOT_SMOKE_MODEL to one of: ${models.map((entry) => entry.id).join(", ")}`);

    const result = await runCopilotSdk({
      client,
      cwd,
      model,
      prompt: `Call ${toolName} exactly once. Then reply with a short sentence containing the token returned by that tool verbatim. Do not use any other tool or modify files.`,
      tools: [tool],
      availableTools: [toolName],
      sessionConfig: { skipCustomInstructions: true, enableConfigDiscovery: false },
      timeoutMs: 90_000,
      onEvent: (event) => events.push(event)
    });

    assert.equal(result.exitCode, 0, result.errorMessage ?? "SDK run failed");
    assert.ok(invocations > 0, `${toolName} handler was not invoked`);
    const starts = events.filter((event) =>
      event.type === "tool.execution_start" && event.data?.toolName === toolName);
    assert.ok(starts.length > 0, `No ${toolName} tool.execution_start event`);
    const completions = events.filter((event) =>
      event.type === "tool.execution_complete" && event.data?.success === true &&
      starts.some((start) => start.data.toolCallId === event.data?.toolCallId));
    assert.ok(completions.length > 0, `No matching successful ${toolName} tool.execution_complete event`);
    assert.ok(completions.some((event) => event.data.result?.content?.includes(token)),
      `The ${toolName} completion event did not contain the handler's token`);
    assert.ok(events.some((event) =>
      event.type === "assistant.message" && event.data?.content?.includes(token)),
    "No assistant.message event containing the tool token");
    assert.ok(result.summary.includes(token), "Final SDK response did not contain the tool token");

    console.log(JSON.stringify({
      status: "passed",
      model,
      handlerInvocations: invocations,
      toolStartEvents: starts.length,
      successfulToolCompletionEvents: completions.length,
      finalResponse: result.summary
    }, null, 2));
  } finally {
    const errors = await client.stop();
    assert.deepEqual(errors, [], "Copilot SDK client cleanup failed");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
