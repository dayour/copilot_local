function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value;
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseCopilotEvent(line) {
  const parsed = asRecord(safeJsonParse(line));
  const type = asString(parsed.type);
  if (!type) return null;
  return {
    type,
    data: asRecord(parsed.data),
    raw: parsed
  };
}

export function parseCopilotJsonl(stdout) {
  let sessionId = null;
  let model = null;
  const messages = [];
  const errors = [];
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0
  };
  let premiumRequests = 0;
  let exitCode = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseCopilotEvent(line);
    if (!event) continue;

    const { type, data, raw } = event;
    if (type === "assistant.message_delta") {
      const content = asString(data.deltaContent);
      if (content) messages.push(content);
      continue;
    }

    if (type === "assistant.message") {
      const content = asString(data.content);
      if (content) messages.push(content);
      usage.outputTokens += asNumber(data.outputTokens, 0);
      continue;
    }

    if (type === "assistant.usage") {
      const usageData = Object.keys(data).length > 0 ? data : asRecord(raw.usage);
      usage.inputTokens += asNumber(usageData.inputTokens, 0);
      usage.outputTokens += asNumber(usageData.outputTokens, 0);
      usage.cachedInputTokens += asNumber(usageData.cachedInputTokens, 0);
      continue;
    }

    if (type === "tool.execution_complete") {
      const nextModel = asString(data.model);
      if (nextModel && !model) model = nextModel;
      continue;
    }

    if (type === "session.tools_updated") {
      const nextModel = asString(data.model);
      if (nextModel) model = nextModel;
      continue;
    }

    if (type === "result") {
      sessionId = asString(raw.sessionId) || sessionId;
      exitCode = asNumber(raw.exitCode, exitCode);
      const resultUsage = asRecord(raw.usage);
      premiumRequests += asNumber(resultUsage.premiumRequests, 0);
      continue;
    }

    if (type === "error") {
      const errObj = asRecord(data.error ?? raw.error);
      const message =
        asString(data.message).trim() ||
        asString(raw.message).trim() ||
        asString(errObj.message).trim();
      if (message) errors.push(message);
    }
  }

  return {
    sessionId,
    exitCode,
    summary: messages.join("").trim(),
    errorMessage: errors.length > 0 ? errors.join("\n") : null,
    usage,
    premiumRequests,
    model
  };
}

export function isCopilotStaleSessionError(stdout, stderr = "") {
  const haystack = `${stdout}\n${stderr}`;
  return /invalid\s+session|session\s+not\s+found|session\s.*expired|unknown\s+session/i.test(haystack);
}
