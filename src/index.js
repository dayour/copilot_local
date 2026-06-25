import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { isCopilotStaleSessionError, parseCopilotJsonl } from "./parse.js";
import { DEFAULT_COPILOT_LOCAL_MODEL, listCopilotLocalModels } from "./models.js";

const PROVIDER_ENV_OPTIONS = {
  providerBaseUrl: "COPILOT_PROVIDER_BASE_URL",
  providerType: "COPILOT_PROVIDER_TYPE",
  providerApiKey: "COPILOT_PROVIDER_API_KEY",
  providerBearerToken: "COPILOT_PROVIDER_BEARER_TOKEN",
  providerWireApi: "COPILOT_PROVIDER_WIRE_API",
  providerTransport: "COPILOT_PROVIDER_TRANSPORT",
  providerModelId: "COPILOT_PROVIDER_MODEL_ID",
  providerWireModel: "COPILOT_PROVIDER_WIRE_MODEL",
  providerMaxPromptTokens: "COPILOT_PROVIDER_MAX_PROMPT_TOKENS",
  providerMaxOutputTokens: "COPILOT_PROVIDER_MAX_OUTPUT_TOKENS",
  offline: "COPILOT_OFFLINE"
};

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

function hasCliValue(value) {
  return value !== undefined && value !== null && value !== false && String(value).length > 0;
}

function cliValues(value) {
  if (value === undefined || value === null || value === false) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => cliValues(entry));
  return String(value).length > 0 ? [value] : [];
}

function cliString(value) {
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function pushFlagValue(args, flag, value) {
  if (hasCliValue(value)) args.push(flag, cliString(value));
}

function pushRepeatedFlagValue(args, flag, value) {
  for (const entry of cliValues(value)) {
    args.push(flag, cliString(entry));
  }
}

function pushRepeatedEqualsValue(args, flag, value) {
  for (const entry of cliValues(value)) {
    args.push(`${flag}=${cliString(entry)}`);
  }
}

function streamMode(value) {
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

function envString(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function buildCopilotEnv(options = {}) {
  const env = { ...(options.env ?? {}) };
  for (const [optionName, envName] of Object.entries(PROVIDER_ENV_OPTIONS)) {
    const value = options[optionName];
    if (value !== undefined && value !== null) env[envName] = envString(value);
  }
  return env;
}

export function buildCopilotArgs(options = {}) {
  const prompt = String(options.prompt ?? "").trim();
  const interactivePrompt =
    typeof options.interactive === "string" ? options.interactive.trim() : prompt;
  const useInteractive =
    options.interactive === true ||
    (typeof options.interactive === "string" && interactivePrompt.length > 0);
  if (!prompt && !useInteractive) throw new Error("runCopilotLocal requires a non-empty prompt.");
  if (useInteractive && !interactivePrompt) {
    throw new Error("runCopilotLocal requires a non-empty prompt for interactive mode.");
  }

  const args = useInteractive ? ["--interactive", interactivePrompt] : ["-p", prompt];
  args.push(
    "--output-format",
    "json",
    "--no-color",
    "-s",
    "--no-ask-user"
  );

  pushFlagValue(args, "--mode", options.mode);
  if (options.plan === true) args.push("--plan");
  if (options.autopilot === true) args.push("--autopilot");
  if (options.allowAllTools !== false) args.push("--allow-all-tools");
  pushFlagValue(args, "--model", options.model);
  pushFlagValue(args, "--context", options.context);
  if (options.resumeSessionId === true) {
    args.push("--resume");
  } else if (hasCliValue(options.resumeSessionId)) {
    args.push(`--resume=${cliString(options.resumeSessionId)}`);
  }
  pushFlagValue(args, "--session-id", options.sessionId);
  if (options.continueSession === true) args.push("--continue");
  pushFlagValue(args, "--name", options.name);
  pushFlagValue(args, "--effort", options.effort);
  pushFlagValue(args, "--reasoning-effort", options.reasoningEffort);
  if (options.stream !== undefined && options.stream !== null) {
    args.push("--stream", streamMode(options.stream));
  }
  pushRepeatedFlagValue(args, "--attachment", options.attachments);

  pushRepeatedFlagValue(args, "--add-dir", options.addDirs);

  if (options.cwd && options.addCwd !== false) {
    args.push("--add-dir", String(options.cwd));
  }

  if (options.allowAllPaths === true) args.push("--allow-all-paths");
  if (options.allowAllUrls === true || options.allowUrls === true) args.push("--allow-all-urls");
  if (options.disallowTempDir === true) args.push("--disallow-temp-dir");
  if (options.allowTools !== true) pushRepeatedEqualsValue(args, "--allow-tool", options.allowTools);
  pushRepeatedEqualsValue(args, "--deny-tool", options.denyTools);
  pushRepeatedEqualsValue(args, "--available-tools", options.availableTools);
  pushRepeatedEqualsValue(args, "--excluded-tools", options.excludedTools);
  if (options.allowUrls !== true) pushRepeatedEqualsValue(args, "--allow-url", options.allowUrls);
  pushRepeatedEqualsValue(args, "--deny-url", options.denyUrls);

  pushRepeatedFlagValue(args, "--additional-mcp-config", options.additionalMcpConfigs);
  if (options.disableBuiltinMcps === true) args.push("--disable-builtin-mcps");
  pushRepeatedFlagValue(args, "--disable-mcp-server", options.disableMcpServers);
  if (options.enableAllGithubMcpTools === true) args.push("--enable-all-github-mcp-tools");
  pushRepeatedFlagValue(args, "--add-github-mcp-tool", options.addGithubMcpTools);
  pushRepeatedFlagValue(args, "--add-github-mcp-toolset", options.addGithubMcpToolsets);
  pushRepeatedFlagValue(args, "--plugin-dir", options.plugins);

  pushFlagValue(args, "--hostname", options.hostname ?? options.gheHost);

  for (const arg of cliValues(options.extraArgs)) args.push(cliString(arg));

  return args;
}

function runProcess(command, args, options) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...buildCopilotEnv(options) },
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

function attemptFailed(proc, parsed) {
  return !proc.timedOut && ((proc.exitCode ?? 0) !== 0 || Boolean(parsed.errorMessage));
}

function buildResult({ command, args, cwd, proc, parsed, options, clearSession = false }) {
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
    clearSession: Boolean(clearSession),
    resultJson: { ...parsed, stdout: proc.stdout, stderr: proc.stderr },
    result: parsed
  };
}

export async function runCopilotLocal(options) {
  const cwd = await ensureDirectory(options.cwd ?? process.cwd(), { create: options.createCwd === true });
  const command = options.command ?? "copilot";
  const runOptions = { ...options, cwd };
  let args = buildCopilotArgs(runOptions);
  let proc = await runProcess(command, args, runOptions);
  let parsed = parseCopilotJsonl(proc.stdout);
  let clearSession = false;

  if (
    options.resumeSessionId &&
    attemptFailed(proc, parsed) &&
    isCopilotStaleSessionError(proc.stdout, proc.stderr)
  ) {
    const retryOptions = { ...runOptions, resumeSessionId: undefined };
    args = buildCopilotArgs(retryOptions);
    proc = await runProcess(command, args, retryOptions);
    parsed = parseCopilotJsonl(proc.stdout);
    clearSession = true;
  }

  return buildResult({ command, args, cwd, proc, parsed, options, clearSession });
}

export function createCopilotLocalAdapter(defaults = {}) {
  return {
    type: "copilot_local",
    label: "GitHub Copilot (local)",
    defaultModel: defaults.model ?? DEFAULT_COPILOT_LOCAL_MODEL,
    listModels: (hints) => listCopilotLocalModels({ ...defaults, ...(hints ?? {}) }),
    run: (options) => runCopilotLocal({ ...defaults, ...options })
  };
}

export { parseCopilotJsonl, parseCopilotEvent, isCopilotStaleSessionError } from "./parse.js";
export {
  DEFAULT_COPILOT_LOCAL_MODEL,
  COPILOT_LOCAL_MODELS,
  listCopilotLocalModels,
  listFallbackModels
} from "./models.js";
export {
  buildCopilotHeaders,
  discoverCopilotApiUrl,
  isCopilotAuthError,
  resolveCopilotToken,
  validateCopilotToken
} from "./auth.js";
export {
  copilotLogin,
  copilotLogin as loginCopilotLocal,
  copilotLogin as login,
  copilotLogin as runCopilotLogin,
  copilotLogin as runLogin
} from "./login.js";
