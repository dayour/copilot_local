import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCopilotJsonl } from "../src/parse.js";

function line(event) {
  return JSON.stringify(event);
}

test("parseCopilotJsonl normalizes expanded event metadata", () => {
  const stdout = [
    line({
      type: "assistant.message_delta",
      id: "msg-1",
      timestamp: "2026-06-24T00:00:00.000Z",
      data: { deltaContent: "Hel", messageId: "assistant-1" }
    }),
    line({
      type: "assistant.message",
      id: "msg-2",
      data: {
        content: "lo",
        messageId: "assistant-1",
        outputTokens: 2,
        toolRequests: [
          { id: "tool-1", name: "read_file", arguments: { path: "README.md" } }
        ]
      }
    }),
    line({
      type: "assistant.usage",
      data: {
        inputTokens: 10,
        outputTokens: 4,
        cachedInputTokens: 3,
        model: "gpt-5.4"
      }
    }),
    line({
      type: "session.skills_loaded",
      data: {
        sessionId: "session-from-event",
        skills: [{ id: "docx", displayName: "Word" }, "xlsx"]
      }
    }),
    line({
      type: "session.mcp_servers_loaded",
      data: {
        servers: [{ serverName: "github", displayName: "GitHub" }, "browser"]
      }
    }),
    line({ type: "custom.future_event", id: "unknown-1", data: { ok: true } }),
    line({
      type: "result",
      sessionId: "session-from-result",
      exitCode: 0,
      usage: {
        premiumRequests: 2,
        totalApiDurationMs: 1234,
        sessionDurationMs: 5678,
        codeChanges: {
          linesAdded: 1,
          linesRemoved: 2,
          filesModified: ["README.md"]
        }
      }
    })
  ].join("\n");

  const parsed = parseCopilotJsonl(stdout);

  assert.equal(parsed.sessionId, "session-from-result");
  assert.equal(parsed.exitCode, 0);
  assert.equal(parsed.summary, "Hello");
  assert.deepEqual(parsed.usage, {
    inputTokens: 10,
    outputTokens: 6,
    cachedInputTokens: 3
  });
  assert.equal(parsed.premiumRequests, 2);
  assert.equal(parsed.model, "gpt-5.4");
  assert.equal(parsed.events.length, 7);
  assert.equal(parsed.messages.length, 2);
  assert.equal(parsed.messages[0].delta, true);
  assert.equal(parsed.tools.length, 1);
  assert.equal(parsed.tools[0].phase, "request");
  assert.equal(parsed.sessions.length, 2);
  assert.deepEqual(parsed.skills.map((skill) => skill.name), ["docx", "xlsx"]);
  assert.deepEqual(parsed.mcpServers.map((server) => server.name), ["github", "browser"]);
  assert.equal(parsed.unknownEvents.length, 1);
  assert.equal(parsed.unknownEvents[0].type, "custom.future_event");
  assert.deepEqual(parsed.codeChanges, {
    linesAdded: 1,
    linesRemoved: 2,
    filesModified: ["README.md"]
  });
  assert.equal(parsed.totalApiDurationMs, 1234);
  assert.equal(parsed.sessionDurationMs, 5678);
});
