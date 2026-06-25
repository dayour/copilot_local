import { buildCopilotHeaders, discoverCopilotApiUrl, resolveCopilotToken } from "./auth.js";

export const DEFAULT_COPILOT_LOCAL_MODEL = "gpt-5.4";

export const COPILOT_LOCAL_MODELS = [
  { id: "claude-opus-4.8", label: "Claude Opus 4.8" },
  { id: "claude-opus-4.7", label: "Claude Opus 4.7" },
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6" },
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-5-mini", label: "GPT-5 mini" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.2-codex", label: "GPT-5.2-Codex" },
  { id: "gpt-5.3-codex", label: "GPT-5.3-Codex" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "grok-code-fast-1", label: "Grok Code Fast 1" }
];

export function listFallbackModels() {
  return [...COPILOT_LOCAL_MODELS];
}

function normalizeHost(host) {
  const raw = String(host ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const normalized = parsed.hostname.toLowerCase();
    return normalized === "github.com" ? "" : normalized;
  } catch {
    const normalized = raw.replace(/^https?:\/\//i, "").split(/[/?#]/, 1)[0].toLowerCase();
    return normalized === "github.com" ? "" : normalized;
  }
}

function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}

function modelLabel(model) {
  const label = model.name || model.label || model.display_name || model.id;
  const vendor = model.vendor;
  if (
    typeof vendor === "string" &&
    vendor &&
    vendor !== "OpenAI" &&
    vendor !== "Azure OpenAI" &&
    !String(label).includes(vendor)
  ) {
    return `${label} (${vendor})`;
  }
  return String(label);
}

function isEmbeddingModel(model) {
  const id = String(model.id ?? "").toLowerCase();
  const name = String(model.name ?? model.label ?? "").toLowerCase();
  const type = String(model.capabilities?.type ?? model.type ?? "").toLowerCase();
  return type.includes("embedding") || id.includes("embedding") || name.includes("embedding");
}

function parseModels(body) {
  const data = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.models)
        ? body.models
        : [];
  const seen = new Map();

  for (const item of data) {
    if (!item || typeof item !== "object" || !item.id || isEmbeddingModel(item)) continue;
    const id = String(item.id);
    if (!seen.has(id)) {
      seen.set(id, { id, label: modelLabel(item) });
    }
  }

  return [...seen.values()];
}

async function fetchCopilotModels(token, gheHost, timeoutMs) {
  const discovered = await discoverCopilotApiUrl(token, gheHost);
  const baseUrl = discovered?.apiUrl || (gheHost ? null : "https://api.githubcopilot.com");
  if (!baseUrl) return [];

  try {
    const response = await fetchWithTimeout(`${baseUrl}/models`, {
      method: "GET",
      headers: buildCopilotHeaders(token)
    }, timeoutMs);

    if (!response.ok) return [];
    return parseModels(await response.json());
  } catch {
    return [];
  }
}

export async function listCopilotLocalModels(hints = {}) {
  const options = hints && typeof hints === "object" ? hints : {};
  const gheHost = normalizeHost(options.gheHost ?? options.githubHost ?? options.host);
  const tokenSource = typeof options.tokenSource === "string"
    ? options.tokenSource
    : gheHost
      ? "gh_cli"
      : "auto";
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0
    ? options.timeoutMs
    : 10000;

  const tokenResult = await resolveCopilotToken({
    env: options.env,
    gheHost,
    tokenSource,
    command: options.ghCommand ?? options.authCommand ?? options.tokenCommand,
    timeoutMs
  });

  if (!tokenResult) return listFallbackModels();

  const models = await fetchCopilotModels(
    tokenResult.token,
    gheHost,
    timeoutMs
  );

  return models.length > 0 ? models : listFallbackModels();
}
