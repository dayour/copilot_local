import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { parseCopilotJsonl } from "./parse.js";
import { DEFAULT_COPILOT_LOCAL_MODEL, listFallbackModels } from "./models.js";

async function ensureDirectory(cwd, { create = false } = {}) {
  const resolved = path.resolve(cwd || process.cwd());
  try {
    await access(resolved);
  } catch (err) {
    if (!create) throw err;
    await mkdir(resolved, { recursive: true });
  }
  return resolved;
}

function buildCopilotArgs(options) {
  const prompt = String(options.prompt ?? "").trim();
  if (!prompt) throw new Error("runCopilotLocal requires a non-empty prompt.");

  const args = [
    "-p",
    prompt,
    "--output-format",
    "json",
    "--no-color",
    "-s",
    "--no-ask-user"
  ];

  if (options.allowAllTools !== false) args.push("--allow-all-tools");
  if (options.model) args.push("--model", String(options.model));
  if (options.resumeSessionId) args.push(`--resume=${String(options.resumeSessionId)}`);
  if (options.effort) args.push("--effort", String(options.effort));

  for (const dir of options.addDirs ?? []) {
    if (dir) args.push("--add-dir", String(dir));
  }

  if (options.cwd && options.addCwd !== false) {
    args.push("--add-dir", String(options.cwd));
  }

  for (const arg of options.extraArgs ?? []) {
    args.push(String(arg));
  }

  return args;
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timeout = null;

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      options.onStdout?.(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      options.onStderr?.(text);
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
    });
    child.on("close", (exitCode, signal) => {
      if (timeout) clearTimeout(timeout);
      resolve({ exitCode, signal, timedOut, stdout, stderr });
    });
  });
}

export async function runCopilotLocal(options) {
  const cwd = await ensureDirectory(options.cwd ?? process.cwd(), { create: options.createCwd === true });
  const command = options.command ?? "copilot";
  const args = buildCopilotArgs({ ...options, cwd });
  const proc = await runProcess(command, args, { ...options, cwd });
  const parsed = parseCopilotJsonl(proc.stdout);

  return {
    command,
    args,
    cwd,
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: proc.timedOut,
    stdout: proc.stdout,
    stderr: proc.stderr,
    sessionId: parsed.sessionId,
    model: parsed.model ?? options.model ?? null,
    provider: "github-copilot",
    summary: parsed.summary,
    errorMessage: parsed.errorMessage || (proc.exitCode ? proc.stderr.trim() || null : null),
    usage: parsed.usage,
    premiumRequests: parsed.premiumRequests,
    result: parsed
  };
}

export function createCopilotLocalAdapter(defaults = {}) {
  return {
    type: "copilot_local",
    label: "GitHub Copilot (local)",
    defaultModel: defaults.model ?? DEFAULT_COPILOT_LOCAL_MODEL,
    listModels: listFallbackModels,
    run: (options) => runCopilotLocal({ ...defaults, ...options })
  };
}

export { parseCopilotJsonl, parseCopilotEvent, isCopilotStaleSessionError } from "./parse.js";
export { DEFAULT_COPILOT_LOCAL_MODEL, COPILOT_LOCAL_MODELS, listFallbackModels } from "./models.js";
