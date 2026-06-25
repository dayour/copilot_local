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

function hasKeys(value) {
  return Object.keys(value).length > 0;
}

function toInputText(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return String(value);
  } catch {
    return "";
  }
}

function firstString(...values) {
  for (const value of values) {
    const text = asString(value).trim();
    if (text) return text;
  }
  return "";
}

function firstNumber(...values) {
  const fallback = values.length > 0 ? values[values.length - 1] : 0;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return fallback;
}

function assignString(target, key, value) {
  const text = asString(value);
  if (text) target[key] = text;
}

function assignBoolean(target, key, value) {
  if (typeof value === "boolean") target[key] = value;
}

function assignValue(target, key, value) {
  if (value !== undefined) target[key] = value;
}

function commonMetadata(event) {
  const metadata = {};
  assignString(metadata, "id", event.raw.id);
  assignString(metadata, "timestamp", event.raw.timestamp);
  assignString(metadata, "parentId", event.raw.parentId);
  assignBoolean(metadata, "ephemeral", event.raw.ephemeral);
  return metadata;
}

function normalizeEnvelope(event) {
  return {
    type: event.type,
    data: event.data,
    raw: event.raw,
    ...commonMetadata(event)
  };
}

function normalizeMessage(event, content, delta) {
  return {
    type: event.type,
    content,
    delta,
    messageId: firstString(event.data.messageId, event.data.id, event.raw.messageId, event.raw.id) || null,
    ...commonMetadata(event),
    data: event.data
  };
}

function normalizeReasoning(event, content, delta) {
  return {
    type: event.type,
    content,
    delta,
    messageId: firstString(event.data.messageId, event.data.id, event.raw.messageId, event.raw.id) || null,
    ...commonMetadata(event),
    data: event.data
  };
}

function normalizeUserMessage(event) {
  const content = firstString(event.data.content, event.data.message, event.raw.content, event.raw.message);
  return {
    type: event.type,
    content,
    messageId: firstString(event.data.messageId, event.data.id, event.raw.messageId, event.raw.id) || null,
    ...commonMetadata(event),
    data: event.data
  };
}

function normalizeIntent(event) {
  const intent = firstString(event.data.intent, event.data.name, event.raw.intent, event.raw.name);
  return {
    type: event.type,
    intent,
    ...commonMetadata(event),
    data: event.data
  };
}

function normalizeTurn(event) {
  const phase = event.type === "assistant.turn_start" ? "start" : "end";
  return {
    type: event.type,
    phase,
    turnId: firstString(event.data.turnId, event.data.id, event.raw.turnId, event.raw.id) || null,
    ...commonMetadata(event),
    data: event.data
  };
}

function normalizeSession(event) {
  return {
    type: event.type,
    sessionId: firstString(event.data.sessionId, event.raw.sessionId) || null,
    ...commonMetadata(event),
    data: event.data
  };
}

function toolContent(data) {
  const result = asRecord(data.result);
  if (hasKeys(result)) {
    return firstString(result.detailedContent, result.content, result.output, result.text);
  }
  return firstString(data.output, data.content, data.detailedContent);
}

function toolErrorContent(data, raw) {
  const errObj = asRecord(data.error ?? raw.error);
  return firstString(data.message, raw.message, errObj.message, errObj.code, data.error, raw.error);
}

function normalizeToolEvent(event, phase) {
  const toolName = firstString(event.data.toolName, event.data.name, event.raw.toolName, event.raw.name);
  const toolCallId = firstString(
    event.data.toolCallId,
    event.data.toolUseId,
    event.data.id,
    event.raw.toolCallId,
    event.raw.toolUseId,
    event.raw.id
  );
  const isError = event.data.success === false;
  const content = isError ? toolErrorContent(event.data, event.raw) : toolContent(event.data);
  const normalized = {
    type: event.type,
    phase,
    toolCallId: toolCallId || null,
    toolName: toolName || null,
    name: toolName || null,
    content,
    isError,
    ...commonMetadata(event),
    data: event.data
  };
  assignBoolean(normalized, "success", event.data.success);
  assignString(normalized, "model", event.data.model);
  assignValue(normalized, "arguments", event.data.arguments);
  assignValue(normalized, "input", event.data.input);
  assignValue(normalized, "result", event.data.result);
  assignValue(normalized, "error", event.data.error);
  return normalized;
}

function normalizeToolRequest(event, requestRaw) {
  const request = asRecord(requestRaw);
  const toolName = firstString(request.name, request.toolName, requestRaw);
  const toolCallId = firstString(request.toolCallId, request.toolUseId, request.id);
  const normalized = {
    type: "assistant.tool_request",
    phase: "request",
    toolCallId: toolCallId || null,
    toolName: toolName || null,
    name: toolName || null,
    messageId: firstString(event.data.messageId, event.data.id, event.raw.messageId, event.raw.id) || null,
    ...commonMetadata(event),
    data: request
  };
  assignValue(normalized, "arguments", request.arguments);
  assignValue(normalized, "input", request.input);
  assignValue(normalized, "request", requestRaw);
  return normalized;
}

function normalizeToolDefinition(event, toolRaw) {
  const tool = asRecord(toolRaw);
  const name = firstString(tool.name, tool.toolName, tool.id, toolRaw);
  return {
    type: event.type,
    phase: "available",
    name: name || null,
    toolName: name || null,
    ...commonMetadata(event),
    data: hasKeys(tool) ? tool : toolRaw
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function findArray(...values) {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
}

function firstRecord(...values) {
  for (const value of values) {
    const record = asRecord(value);
    if (hasKeys(record)) return record;
  }
  return {};
}

function normalizeNamedItem(itemRaw) {
  const item = asRecord(itemRaw);
  if (hasKeys(item)) {
    return {
      ...item,
      name: firstString(item.name, item.id, item.slug, item.serverName, item.displayName) || null
    };
  }
  const name = firstString(itemRaw);
  return name ? { name } : { value: itemRaw };
}

function resultUsage(event) {
  const usage = asRecord(event.raw.usage);
  return hasKeys(usage) ? usage : asRecord(event.data.usage);
}

function errorMessage(event) {
  const errObj = asRecord(event.data.error ?? event.raw.error);
  return firstString(
    event.data.message,
    event.raw.message,
    errObj.message,
    errObj.code,
    event.data.error,
    event.raw.error
  );
}

export function parseCopilotEvent(line) {
  const parsed = asRecord(safeJsonParse(toInputText(line)));
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
  const summaryParts = [];
  const errors = [];
  const events = [];
  const messages = [];
  const reasoning = [];
  const tools = [];
  const sessions = [];
  const skills = [];
  const mcpServers = [];
  const userMessages = [];
  const intents = [];
  const turns = [];
  const unknownEvents = [];
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0
  };
  let premiumRequests = 0;
  let exitCode = null;
  let codeChanges = null;
  let totalApiDurationMs = null;
  let sessionDurationMs = null;

  for (const rawLine of toInputText(stdout).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseCopilotEvent(line);
    if (!event) continue;
    events.push(normalizeEnvelope(event));

    const { type, data, raw } = event;
    const nextSessionId = firstString(data.sessionId, raw.sessionId);
    if (nextSessionId && !sessionId) sessionId = nextSessionId;

    if (type === "assistant.message_delta") {
      const content = firstString(data.deltaContent, data.content);
      if (content) {
        summaryParts.push(content);
        messages.push(normalizeMessage(event, content, true));
      }
      continue;
    }

    if (type === "assistant.message") {
      const content = asString(data.content);
      const toolRequests = asArray(data.toolRequests);
      if (content) summaryParts.push(content);
      if (content || toolRequests.length > 0) messages.push(normalizeMessage(event, content, false));
      for (const request of toolRequests) {
        tools.push(normalizeToolRequest(event, request));
      }
      usage.outputTokens += asNumber(data.outputTokens, 0);
      continue;
    }

    if (type === "assistant.reasoning" || type === "assistant.reasoning_delta") {
      const content = type === "assistant.reasoning_delta"
        ? firstString(data.deltaContent, data.content)
        : firstString(data.content, data.deltaContent);
      if (content || hasKeys(data)) {
        reasoning.push(normalizeReasoning(event, content, type === "assistant.reasoning_delta"));
      }
      continue;
    }

    if (type === "assistant.usage") {
      const usageData = Object.keys(data).length > 0 ? data : asRecord(raw.usage);
      usage.inputTokens += asNumber(usageData.inputTokens, 0);
      usage.outputTokens += asNumber(usageData.outputTokens, 0);
      usage.cachedInputTokens += asNumber(usageData.cachedInputTokens, asNumber(usageData.cachedTokens, 0));
      const nextModel = asString(usageData.model);
      if (nextModel && !model) model = nextModel;
      continue;
    }

    if (type === "tool.execution_start") {
      tools.push(normalizeToolEvent(event, "start"));
      continue;
    }

    if (type === "tool.execution_partial_result") {
      tools.push(normalizeToolEvent(event, "partial_result"));
      continue;
    }

    if (type === "tool.execution_complete") {
      tools.push(normalizeToolEvent(event, "complete"));
      const nextModel = asString(data.model);
      if (nextModel && !model) model = nextModel;
      continue;
    }

    if (type.startsWith("session.")) {
      sessions.push(normalizeSession(event));

      if (type === "session.tools_updated") {
        const nextModel = asString(data.model);
        if (nextModel) model = nextModel;
        for (const tool of findArray(data.tools, raw.tools, raw.data)) {
          tools.push(normalizeToolDefinition(event, tool));
        }
      }

      if (type === "session.skills_loaded") {
        for (const skill of findArray(data.skills, data.loadedSkills, data.availableSkills, raw.skills, raw.data)) {
          skills.push(normalizeNamedItem(skill));
        }
      }

      if (type === "session.mcp_servers_loaded") {
        for (const server of findArray(data.mcpServers, data.mcp_servers, data.servers, raw.mcpServers, raw.servers, raw.data)) {
          mcpServers.push(normalizeNamedItem(server));
        }
      }
      continue;
    }

    if (type === "user.message") {
      userMessages.push(normalizeUserMessage(event));
      continue;
    }

    if (type === "assistant.turn_start" || type === "assistant.turn_end") {
      turns.push(normalizeTurn(event));
      continue;
    }

    if (type === "assistant.intent") {
      intents.push(normalizeIntent(event));
      continue;
    }

    if (type === "result") {
      sessionId = asString(raw.sessionId) || sessionId;
      exitCode = asNumber(raw.exitCode, exitCode);
      const usageData = resultUsage(event);
      premiumRequests += firstNumber(usageData.premiumRequests, raw.premiumRequests, data.premiumRequests, 0);
      totalApiDurationMs = firstNumber(raw.totalApiDurationMs, usageData.totalApiDurationMs, data.totalApiDurationMs, totalApiDurationMs);
      sessionDurationMs = firstNumber(raw.sessionDurationMs, usageData.sessionDurationMs, data.sessionDurationMs, sessionDurationMs);
      const nextCodeChanges = firstRecord(raw.codeChanges, usageData.codeChanges, data.codeChanges);
      if (hasKeys(nextCodeChanges)) codeChanges = nextCodeChanges;
      const nextModel = asString(raw.model) || asString(data.model);
      if (nextModel && !model) model = nextModel;
      continue;
    }

    if (type === "error") {
      const message = errorMessage(event);
      if (message) errors.push(message);
      continue;
    }

    unknownEvents.push(normalizeEnvelope(event));
  }

  return {
    sessionId,
    exitCode,
    summary: summaryParts.join("").trim(),
    errorMessage: errors.length > 0 ? errors.join("\n") : null,
    usage,
    premiumRequests,
    model,
    events,
    messages,
    reasoning,
    tools,
    sessions,
    skills,
    mcpServers,
    userMessages,
    intents,
    turns,
    unknownEvents,
    codeChanges,
    totalApiDurationMs,
    sessionDurationMs
  };
}

export function isCopilotStaleSessionError(stdout, stderr = "") {
  const haystack = `${stdout}\n${stderr}`;
  return /invalid\s+session|session\s+not\s+found|session\s.*expired|unknown\s+session/i.test(haystack);
}
