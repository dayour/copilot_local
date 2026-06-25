import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

const TOKEN_ENV_VARS = ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"];
const DEFAULT_HOST = "github.com";
const DISCOVERY_CACHE_TTL_MS = 10 * 60 * 1000;
const discoveryCache = new Map();

function normalizeHost(host) {
  const raw = String(host ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0].toLowerCase();
  }
}

function isDefaultHost(host) {
  const normalized = normalizeHost(host);
  return !normalized || normalized === DEFAULT_HOST;
}

function stringEnv(env) {
  return Object.fromEntries(
    Object.entries(env ?? {})
      .filter((entry) => typeof entry[1] === "string")
  );
}

function cacheKey(token, gheHost) {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 16);
  return `${digest}@${normalizeHost(gheHost) || DEFAULT_HOST}`;
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: options.env,
      windowsHide: true,
      shell: false
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let timeout = null;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve({ stdout, stderr, timedOut, ...result });
    };

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      stderr += `${error.message}\n`;
      finish({ exitCode: null, signal: null, error });
    });
    child.on("close", (exitCode, signal) => {
      finish({ exitCode, signal });
    });
  });
}

export function validateCopilotToken(token) {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) {
    return { valid: false, reason: "Token is empty." };
  }
  if (trimmed.startsWith("ghp_")) {
    return {
      valid: false,
      reason: "Classic personal access tokens (ghp_) are not supported by the Copilot API. Use an OAuth or fine-grained token instead."
    };
  }
  return { valid: true };
}

export async function resolveCopilotToken({
  env,
  gheHost,
  tokenSource = "auto",
  command = "gh",
  timeoutMs = 10000
} = {}) {
  const source = String(tokenSource || "auto").toLowerCase();
  const searchEnv = stringEnv(env ?? process.env);
  const host = normalizeHost(gheHost);
  const mayUseEnv = source !== "gh_cli" && (isDefaultHost(host) || source === "env");

  if (mayUseEnv) {
    for (const name of TOKEN_ENV_VARS) {
      const value = searchEnv[name]?.trim();
      if (!value) continue;

      const validation = validateCopilotToken(value);
      if (validation.valid) {
        return { token: value, source: `env:${name}` };
      }
    }

    if (source === "env") return null;
  }

  if (source === "env") return null;

  try {
    const args = ["auth", "token"];
    if (host) args.push("--hostname", host);

    const commandEnv = stringEnv(env ? { ...process.env, ...env } : process.env);
    delete commandEnv.GH_TOKEN;
    delete commandEnv.GITHUB_TOKEN;

    const result = await runCommand(command, args, { env: commandEnv, timeoutMs });
    const token = result.stdout.trim();
    if (!result.timedOut && result.exitCode === 0 && token) {
      const validation = validateCopilotToken(token);
      if (validation.valid) {
        return { token, source: `gh_cli${host ? `:${host}` : ""}` };
      }
    }
  } catch {
    // gh CLI is unavailable or failed; callers will fall back.
  }

  return null;
}

export function buildCopilotHeaders(token) {
  return {
    Authorization: `Bearer ${String(token ?? "").trim()}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Editor-Version": "vscode/1.104.1",
    "Editor-Plugin-Version": "copilot-chat/0.27.2025070801",
    "User-Agent": "GitHubCopilotChat/0.27.2025070801",
    "Copilot-Integration-Id": "vscode-chat",
    "Openai-Intent": "conversation-edits"
  };
}

export function isCopilotAuthError(errorMessage, stdout, stderr) {
  const combined = [errorMessage, stdout, stderr].filter(Boolean).join("\n");
  return /(?:\b(?:401|403)\b|unauthori[sz]ed|forbidden|bad credentials|invalid\s+(?:oauth\s+)?token|token\s+(?:expired|invalid)|authentication\s+(?:required|failed)|auth(?:entication)?\s+required|not\s+(?:authenticated|logged\s+in)|login\s+(?:is\s+)?required|must\s+(?:be\s+)?(?:login|log in|authenticate)|copilot\s+subscription)/i.test(combined);
}

export async function discoverCopilotApiUrl(token, gheHost) {
  const validation = validateCopilotToken(token);
  if (!validation.valid) return null;

  const host = normalizeHost(gheHost);
  const key = cacheKey(token, host);
  const cached = discoveryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { apiUrl: cached.apiUrl, userInfo: cached.userInfo };
  }

  const apiHost = host ? `api.${host}` : "api.github.com";
  const url = `https://${apiHost}/copilot_internal/user`;

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `token ${String(token).trim()}`,
        Accept: "application/json",
        "Editor-Version": "vscode/1.104.1",
        "Copilot-Integration-Id": "vscode-chat",
        "User-Agent": "GitHubCopilotChat/0.27.2025070801"
      }
    });

    if (!response.ok) return null;

    const userInfo = await response.json();
    const apiUrl = userInfo?.endpoints?.api;
    if (typeof apiUrl !== "string" || !apiUrl.trim()) return null;

    const cleanApiUrl = apiUrl.replace(/\/+$/, "");
    const result = { apiUrl: cleanApiUrl, userInfo };
    discoveryCache.set(key, {
      ...result,
      expiresAt: Date.now() + DISCOVERY_CACHE_TTL_MS
    });

    return result;
  } catch {
    return null;
  }
}
