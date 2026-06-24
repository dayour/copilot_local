#!/usr/bin/env node
import { runCopilotLocal } from "../src/index.js";

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`Usage:
  copilot-local --prompt "..." [--cwd <dir>] [--model <id>] [--resume <sessionId>]

Options:
  --prompt   Prompt to send to GitHub Copilot CLI. Required.
  --cwd      Working directory. Defaults to current directory.
  --model    Optional Copilot model id, e.g. claude-opus-4.7.
  --resume   Optional Copilot session id to resume.
  --raw      Print raw JSONL stdout instead of parsed JSON.
`);
  process.exit(0);
}

const prompt = readArg("--prompt");
if (!prompt) {
  console.error("Missing required --prompt.");
  process.exit(2);
}

const result = await runCopilotLocal({
  prompt,
  cwd: readArg("--cwd") ?? process.cwd(),
  model: readArg("--model") ?? undefined,
  resumeSessionId: readArg("--resume") ?? undefined
});

if (hasFlag("--raw")) {
  process.stdout.write(result.stdout);
} else {
  console.log(JSON.stringify({
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    sessionId: result.sessionId,
    model: result.model,
    provider: result.provider,
    summary: result.summary,
    errorMessage: result.errorMessage,
    usage: result.usage,
    premiumRequests: result.premiumRequests
  }, null, 2));
}

process.exitCode = result.exitCode ?? (result.errorMessage ? 1 : 0);
