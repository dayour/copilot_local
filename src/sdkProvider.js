import { access } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_COPILOT_LOCAL_MODEL } from "./models.js";
import { isCopilotStaleSessionError, parseCopilotJsonl } from "./parse.js";

export async function buildCopilotSdkClientOptions(options = {}) {
  const clientOptions = { ...(options.clientOptions ?? {}) };
  if (options.cwd !== undefined) clientOptions.workingDirectory = path.resolve(options.cwd);
  if (options.env !== undefined) {
    clientOptions.env = { ...process.env, ...(clientOptions.env ?? {}), ...options.env };
  }
  if (options.cliPath !== undefined) {
    if (typeof options.cliPath !== "string" || !options.cliPath.trim()) {
      throw new TypeError("cliPath must be a non-empty runtime executable path.");
    }
    if (clientOptions.connection !== undefined) {
      throw new Error("cliPath cannot be combined with clientOptions.connection.");
    }
    const { RuntimeConnection } = await import("@github/copilot-sdk");
    clientOptions.connection = RuntimeConnection.forStdio({ path: options.cliPath });
  }
  return clientOptions;
}

async function makeClient(options) {
  const { CopilotClient } = await import("@github/copilot-sdk");
  return new CopilotClient(await buildCopilotSdkClientOptions(options));
}

async function withClient(options, callback) {
  const owned = !options.client;
  const client = options.client ?? await (options.createClient ?? makeClient)(options);
  try {
    await client.start();
    return await callback(client);
  } finally {
    if (owned) await client.stop();
  }
}

/**
 * Discover the models available to the authenticated SDK client. Unlike a static catalog,
 * this reflects account policy and the actual CLI server. An onListModels handler in
 * clientOptions can supply BYOK models; Copilot's subscription catalog is not a BYOK catalog.
 */
export async function listCopilotSdkModels(options = {}) {
  return withClient(options, async (client) => {
    const models = await client.listModels();
    const seen = new Set();
    return models
      .filter((model) => {
        if (typeof model?.id !== "string" || !model.id.trim()) return false;
        if (model.policy?.state === "disabled" && !options.includeDisabled) return false;
        if (/embedding/i.test(model.id) || /embedding/i.test(model.capabilities?.type ?? "")) return false;
        if (seen.has(model.id)) return false;
        seen.add(model.id);
        return true;
      })
      .map((model) => ({ ...model, label: model.name || model.id }));
  });
}

function sessionConfig(options, cwd, onEvent) {
  const config = { ...(options.sessionConfig ?? {}) };
  for (const field of [
    "model", "reasoningEffort", "provider", "tools", "mcpServers", "customAgents",
    "agent", "systemMessage", "availableTools", "excludedTools", "skillDirectories",
    "disabledSkills", "enableConfigDiscovery", "streaming", "clientName", "hooks"
  ]) {
    if (options[field] !== undefined) config[field] = options[field];
  }
  if (options.providerBaseUrl !== undefined || options.byokBaseUrl !== undefined) {
    config.provider = {
      type: options.providerType ?? "openai",
      baseUrl: options.providerBaseUrl ?? options.byokBaseUrl,
      ...(options.providerWireApi ? { wireApi: options.providerWireApi } : {}),
      ...(options.providerApiKey ?? options.byokApiKey
        ? { apiKey: options.providerApiKey ?? options.byokApiKey } : {}),
      ...(options.providerBearerToken ? { bearerToken: options.providerBearerToken } : {}),
      ...(options.providerAzureApiVersion
        ? { azure: { apiVersion: options.providerAzureApiVersion } } : {})
    };
  }
  config.workingDirectory = cwd;
  config.onPermissionRequest = options.onPermissionRequest ?? config.onPermissionRequest ??
    (options.allowAllTools === false
      ? () => ({ kind: "denied-interactively-by-user" })
      : () => ({ kind: "approve-once" }));
  const originalOnEvent = config.onEvent;
  config.onEvent = (event) => {
    onEvent(event);
    originalOnEvent?.(event);
    options.onEvent?.(event);
  };
  if (config.provider && !config.model) {
    throw new Error("runCopilotSdk requires a model when a custom provider is configured.");
  }
  return config;
}

/**
 * Run a Copilot SDK session, preserving Paperclip's CLI adapter result fields.
 * An SDK client can be injected for shared lifecycle management; otherwise each call
 * owns and stops its client. The SDK does not emit the CLI's terminal `result` event.
 */
export async function runCopilotSdk(options = {}) {
  const prompt = String(options.prompt ?? "").trim();
  if (!prompt) throw new Error("runCopilotSdk requires a non-empty prompt.");
  const cwd = path.resolve(options.cwd ?? process.cwd());
  await access(cwd);

  return withClient({ ...options, cwd }, async (client) => {
    let clearSession = false;
    let events = [];
    let lastMessage = null;
    let session = null;
    let error = null;
    const capture = (event) => {
      events.push(event);
      if (event.type === "assistant.message") lastMessage = event;
      options.onStdout?.(`${JSON.stringify(event)}\n`);
    };
    const config = sessionConfig(options, cwd, capture);

    const send = async (resume) => {
      session = resume
        ? await client.resumeSession(String(options.resumeSessionId), config)
        : await client.createSession(config);
      const response = await session.sendAndWait(
        { prompt, ...(options.attachments ? { attachments: options.attachments } : {}) },
        options.timeoutMs
      );
      if (!lastMessage && response) lastMessage = response;
    };

    try {
      try {
        await send(Boolean(options.resumeSessionId));
      } catch (resumeError) {
        if (!options.resumeSessionId ||
            !isCopilotStaleSessionError(String(resumeError?.message ?? resumeError))) {
          throw resumeError;
        }
        if (session) await session.disconnect();
        session = null;
        clearSession = true;
        events = [];
        lastMessage = null;
        await send(false);
      }
    } catch (failure) {
      error = failure instanceof Error ? failure : new Error(String(failure));
      options.onStderr?.(`${error.message}\n`);
    } finally {
      if (session) {
        try {
          await session.disconnect();
        } catch (disconnectError) {
          if (!error) error = disconnectError;
        }
      }
    }

    const stdout = events.map((event) => JSON.stringify(event)).join("\n");
    const parsed = parseCopilotJsonl(stdout);
    const stderr = error?.message ?? "";
    const summary = lastMessage?.data?.content ?? parsed.summary;
    const usageEvents = events.filter((event) => event.type === "assistant.usage");
    const usage = usageEvents.length
      ? usageEvents.reduce((total, event) => ({
          inputTokens: total.inputTokens + (event.data?.inputTokens ?? 0),
          outputTokens: total.outputTokens + (event.data?.outputTokens ?? 0),
          cachedInputTokens: total.cachedInputTokens +
            (event.data?.cacheReadTokens ?? event.data?.cachedInputTokens ?? 0)
        }), { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 })
      : parsed.usage;
    const result = { ...parsed, summary, sessionId: session?.sessionId ?? null,
      model: parsed.model ?? config.model ?? null, usage,
      errorMessage: error?.message ?? parsed.errorMessage };
    return {
      command: "copilot-sdk",
      args: [],
      cwd,
      exitCode: error ? 1 : 0,
      signal: null,
      timedOut: Boolean(error && /timeout/i.test(error.message)),
      stdout,
      stderr,
      sessionId: result.sessionId,
      sessionParams: result.sessionId ? { sessionId: result.sessionId, cwd } : null,
      sessionDisplayId: result.sessionId,
      model: result.model,
      provider: "github-copilot",
      biller: config.provider ? "byok" : "subscription",
      summary: result.summary,
      errorMessage: result.errorMessage,
      usage: result.usage,
      premiumRequests: result.premiumRequests,
      clearSession,
      resultJson: { ...result, stdout, stderr },
      result
    };
  });
}

export function createCopilotSdkAdapter(defaults = {}) {
  return {
    type: "copilot_local",
    label: "GitHub Copilot SDK (local)",
    defaultModel: defaults.model ?? DEFAULT_COPILOT_LOCAL_MODEL,
    listModels: (hints) => listCopilotSdkModels({ ...defaults, ...(hints ?? {}) }),
    run: (options) => runCopilotSdk({ ...defaults, ...options })
  };
}
