import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCopilotArgs } from "../src/index.js";

function valueAfter(args, flag) {
  const index = args.indexOf(flag);
  assert.notEqual(index, -1, `missing ${flag}`);
  return args[index + 1];
}

test("buildCopilotArgs maps runtime flags", () => {
  const args = buildCopilotArgs({
    prompt: "hello",
    model: "gpt-5.4",
    resumeSessionId: "session-123",
    addDirs: ["D:\\repo", "D:\\shared"],
    addCwd: false,
    reasoningEffort: "high",
    context: "long_context",
    allowAllTools: false,
    allowTools: ["read_file", "edit_file"],
    denyTools: ["dangerous_tool"],
    allowAllPaths: true,
    allowUrls: ["https://example.com"],
    denyUrls: ["https://blocked.example"],
    additionalMcpConfigs: ["D:\\repo\\mcp.json"],
    disableBuiltinMcps: true,
    disableMcpServers: ["legacy-server"],
    enableAllGithubMcpTools: true,
    addGithubMcpTools: ["get_issue"],
    addGithubMcpToolsets: ["repos"],
    hostname: "ghe.example.com",
    attachments: ["D:\\repo\\trace.log", "D:\\repo\\screenshot.png"]
  });

  assert.equal(valueAfter(args, "-p"), "hello");
  assert.equal(valueAfter(args, "--model"), "gpt-5.4");
  assert.ok(args.includes("--resume=session-123"));
  assert.equal(valueAfter(args, "--reasoning-effort"), "high");
  assert.equal(valueAfter(args, "--context"), "long_context");
  assert.equal(valueAfter(args, "--hostname"), "ghe.example.com");
  assert.ok(!args.includes("--allow-all-tools"));
  assert.ok(args.includes("--allow-all-paths"));
  assert.ok(args.includes("--allow-tool=read_file"));
  assert.ok(args.includes("--allow-tool=edit_file"));
  assert.ok(args.includes("--deny-tool=dangerous_tool"));
  assert.ok(args.includes("--allow-url=https://example.com"));
  assert.ok(args.includes("--deny-url=https://blocked.example"));
  assert.ok(args.includes("--disable-builtin-mcps"));
  assert.ok(args.includes("--enable-all-github-mcp-tools"));
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === "--add-dir"),
    ["D:\\repo", "D:\\shared"]
  );
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === "--attachment"),
    ["D:\\repo\\trace.log", "D:\\repo\\screenshot.png"]
  );
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === "--additional-mcp-config"),
    ["D:\\repo\\mcp.json"]
  );
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === "--disable-mcp-server"),
    ["legacy-server"]
  );
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === "--add-github-mcp-tool"),
    ["get_issue"]
  );
  assert.deepEqual(
    args.filter((arg, index) => args[index - 1] === "--add-github-mcp-toolset"),
    ["repos"]
  );
});
