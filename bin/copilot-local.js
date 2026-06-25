#!/usr/bin/env node

const HELP_TEXT = `Usage:
  copilot-local [run] --prompt "..." [options]
  copilot-local [run] "prompt text" [options]
  copilot-local login [--ghe-host <host>] [--command <cmd>]
  copilot-local models [--ghe-host <host>] [--json]
  copilot-local list-models [--ghe-host <host>] [--json]

Commands:
  run, default          Execute a prompt. This is the default command.
  login                 Sign in using local login support when available.
  models, list-models   List available models.

Run and session:
  --prompt, -p <text>          Prompt to send. Required for run unless positional.
  --cwd <dir>                  Working directory. Defaults to current directory.
  --model <id>                 Model id.
  --resume <sessionId>         Resume a session.
  --session-id <sessionId>     Session id to use or resume.
  --continue                   Continue the latest or selected session.
  --name <name>                Session name.
  --effort <level>             Reasoning effort.
  --reasoning-effort <level>   Alias/runtime option for reasoning effort.
  --context <value>            Context mode/window.
  --mode <value>               Execution mode.
  --plan                       Enable plan mode.
  --autopilot                  Enable autopilot mode.
  --interactive                Allow interactive behavior.

Paths and attachments:
  --add-dir <dir>              Add directory. Repeatable.
  --no-add-cwd                 Do not automatically add --cwd as an added dir.
  --attachment <path>          Attach a file. Repeatable.
  --allow-all-paths            Allow all paths.
  --disallow-temp-dir          Disallow temp directory access.

Tools and URLs:
  --allow-tool <name>          Allow tool. Repeatable.
  --deny-tool <name>           Deny tool. Repeatable.
  --available-tool <name>      Declare available tool. Repeatable.
  --excluded-tool <name>       Exclude tool. Repeatable.
  --allow-url <url>            Allow URL. Repeatable.
  --deny-url <url>             Deny URL. Repeatable.
  --allow-all-urls             Allow all URLs.
  --no-allow-all-tools         Do not add --allow-all-tools by default.

MCP and GitHub:
  --additional-mcp-config <p>      Add MCP config. Repeatable.
  --disable-builtin-mcps           Disable built-in MCP servers.
  --disable-mcp-server <name>      Disable MCP server. Repeatable.
  --enable-all-github-mcp-tools    Enable all GitHub MCP tools.
  --add-github-mcp-tool <name>     Add GitHub MCP tool. Repeatable.
  --add-github-mcp-toolset <name>  Add GitHub MCP toolset. Repeatable.
  --plugin-dir <dir>               Add plugin directory. Repeatable.
  --ghe-host, --hostname <host>    GitHub Enterprise host.

Provider/BYOK:
  --provider-base-url <url>
  --provider-type <type>
  --provider-api-key <key>
  --provider-bearer-token <token>
  --provider-wire-api <api>
  --provider-transport <transport>
  --provider-model-id <id>
  --provider-wire-model <id>
  --provider-max-prompt-tokens <n>
  --provider-max-output-tokens <n>
  --offline

Process and output:
  --timeout-ms <n>             Timeout in milliseconds.
  --command <cmd>              Copilot command/binary to execute.
  --env <KEY=VALUE>            Add environment variable. Repeatable.
  KEY=VALUE                    Also accepted as an environment entry.
  --raw                        Print raw JSONL stdout for run.
  --pretty                     Pretty-print JSON output.
  --json                       JSON output (accepted for parity).
  --help, -h                   Show this help.
`;

const KNOWN_COMMANDS = new Set(["run", "default", "login", "models", "list-models"]);

const VALUE_FLAGS = new Map([
  ["--prompt", "prompt"],
  ["-p", "prompt"],
  ["--cwd", "cwd"],
  ["--model", "model"],
  ["--resume", "resume"],
  ["--session-id", "sessionId"],
  ["--name", "name"],
  ["--effort", "effort"],
  ["--reasoning-effort", "reasoningEffort"],
  ["--context", "context"],
  ["--mode", "mode"],
  ["--ghe-host", "gheHost"],
  ["--hostname", "gheHost"],
  ["--timeout-ms", "timeoutMs"],
  ["--command", "command"],
  ["--provider-base-url", "providerBaseUrl"],
  ["--provider-type", "providerType"],
  ["--provider-api-key", "providerApiKey"],
  ["--provider-bearer-token", "providerBearerToken"],
  ["--provider-wire-api", "providerWireApi"],
  ["--provider-transport", "providerTransport"],
  ["--provider-model-id", "providerModelId"],
  ["--provider-wire-model", "providerWireModel"],
  ["--provider-max-prompt-tokens", "providerMaxPromptTokens"],
  ["--provider-max-output-tokens", "providerMaxOutputTokens"]
]);

const REPEATABLE_FLAGS = new Map([
  ["--add-dir", "addDirs"],
  ["--attachment", "attachments"],
  ["--allow-tool", "allowTools"],
  ["--deny-tool", "denyTools"],
  ["--available-tool", "availableTools"],
  ["--excluded-tool", "excludedTools"],
  ["--allow-url", "allowUrls"],
  ["--deny-url", "denyUrls"],
  ["--additional-mcp-config", "additionalMcpConfigs"],
  ["--disable-mcp-server", "disableMcpServers"],
  ["--add-github-mcp-tool", "addGithubMcpTools"],
  ["--add-github-mcp-toolset", "addGithubMcpToolsets"],
  ["--plugin-dir", "plugins"],
  ["--env", "envEntries"]
]);

const BOOLEAN_FLAGS = new Map([
  ["--help", "help"],
  ["-h", "help"],
  ["--raw", "raw"],
  ["--pretty", "pretty"],
  ["--json", "json"],
  ["--continue", "continueSession"],
  ["--plan", "plan"],
  ["--autopilot", "autopilot"],
  ["--interactive", "interactive"],
  ["--no-add-cwd", "noAddCwd"],
  ["--allow-all-paths", "allowAllPaths"],
  ["--allow-all-urls", "allowAllUrls"],
  ["--disallow-temp-dir", "disallowTempDir"],
  ["--no-allow-all-tools", "noAllowAllTools"],
  ["--disable-builtin-mcps", "disableBuiltinMcps"],
  ["--enable-all-github-mcp-tools", "enableAllGithubMcpTools"],
  ["--offline", "offline"]
]);

const PASS_THROUGH_VALUE_FLAGS = new Set([
  "sessionId",
  "name",
  "context",
  "mode",
  "gheHost"
]);

const PASS_THROUGH_REPEATABLE_FLAGS = new Set([
  "attachments",
  "allowTools",
  "denyTools",
  "availableTools",
  "excludedTools",
  "allowUrls",
  "denyUrls",
  "additionalMcpConfigs",
  "disableMcpServers",
  "addGithubMcpTools",
  "addGithubMcpToolsets"
]);

const PASS_THROUGH_BOOLEAN_FLAGS = new Set([
  "continueSession",
  "plan",
  "autopilot",
  "interactive",
  "allowAllPaths",
  "disallowTempDir",
  "disableBuiltinMcps",
  "enableAllGithubMcpTools"
]);

const FLAG_NAME_BY_KEY = new Map([
  ["sessionId", "--session-id"],
  ["name", "--name"],
  ["context", "--context"],
  ["mode", "--mode"],
  ["gheHost", "--ghe-host"],
  ["attachments", "--attachment"],
  ["allowTools", "--allow-tool"],
  ["denyTools", "--deny-tool"],
  ["availableTools", "--available-tool"],
  ["excludedTools", "--excluded-tool"],
  ["allowUrls", "--allow-url"],
  ["denyUrls", "--deny-url"],
  ["additionalMcpConfigs", "--additional-mcp-config"],
  ["disableMcpServers", "--disable-mcp-server"],
  ["addGithubMcpTools", "--add-github-mcp-tool"],
  ["addGithubMcpToolsets", "--add-github-mcp-toolset"],
  ["continueSession", "--continue"],
  ["plan", "--plan"],
  ["autopilot", "--autopilot"],
  ["interactive", "--interactive"],
  ["allowAllPaths", "--allow-all-paths"],
  ["disallowTempDir", "--disallow-temp-dir"],
  ["disableBuiltinMcps", "--disable-builtin-mcps"],
  ["enableAllGithubMcpTools", "--enable-all-github-mcp-tools"]
]);

class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function splitFlagToken(token) {
  const equalsAt = token.indexOf("=");
  if (equalsAt <= 0) return { flag: token, value: undefined };
  return { flag: token.slice(0, equalsAt), value: token.slice(equalsAt + 1) };
}

function parseBoolean(value, flag) {
  if (value === undefined) return true;
  const normalized = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new CliError(`Invalid boolean value for ${flag}: ${value}`);
}

function nextValue(argv, index, flag, inlineValue) {
  if (inlineValue !== undefined) return { value: inlineValue, nextIndex: index };
  if (index + 1 >= argv.length) throw new CliError(`Missing value for ${flag}.`);
  const candidate = argv[index + 1];
  const { flag: candidateFlag } = splitFlagToken(candidate);
  if (candidate.startsWith("-") && isKnownFlag(candidateFlag)) {
    throw new CliError(`Missing value for ${flag}.`);
  }
  return { value: candidate, nextIndex: index + 1 };
}

function isKnownFlag(flag) {
  return VALUE_FLAGS.has(flag) || REPEATABLE_FLAGS.has(flag) || BOOLEAN_FLAGS.has(flag);
}

function isBareEnvEntry(token) {
  return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function addRepeatable(repeatables, key, value) {
  if (!repeatables[key]) repeatables[key] = [];
  repeatables[key].push(value);
}

function parseArgs(argv) {
  const parsed = {
    command: "run",
    values: {},
    repeatables: {},
    booleans: {},
    bareEnvEntries: [],
    positionals: []
  };

  let sawEndOfOptions = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (sawEndOfOptions) {
      parsed.positionals.push(token);
      continue;
    }

    if (token === "--") {
      sawEndOfOptions = true;
      continue;
    }

    if (!token.startsWith("-")) {
      if (
        KNOWN_COMMANDS.has(token) &&
        parsed.command === "run" &&
        parsed.positionals.length === 0 &&
        parsed.values.prompt === undefined
      ) {
        parsed.command = token === "default" ? "run" : token;
      } else if (isBareEnvEntry(token) && parsed.positionals.length === 0) {
        parsed.bareEnvEntries.push(token);
      } else {
        parsed.positionals.push(token);
      }
      continue;
    }

    const { flag, value: inlineValue } = splitFlagToken(token);

    if (VALUE_FLAGS.has(flag)) {
      const { value, nextIndex } = nextValue(argv, i, flag, inlineValue);
      parsed.values[VALUE_FLAGS.get(flag)] = value;
      i = nextIndex;
      continue;
    }

    if (REPEATABLE_FLAGS.has(flag)) {
      const { value, nextIndex } = nextValue(argv, i, flag, inlineValue);
      addRepeatable(parsed.repeatables, REPEATABLE_FLAGS.get(flag), value);
      i = nextIndex;
      continue;
    }

    if (BOOLEAN_FLAGS.has(flag)) {
      parsed.booleans[BOOLEAN_FLAGS.get(flag)] = parseBoolean(inlineValue, flag);
      continue;
    }

    throw new CliError(`Unknown option: ${flag}`);
  }

  return parsed;
}

function parseIntegerOption(values, key, flag) {
  if (values[key] === undefined) return undefined;
  const number = Number(values[key]);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new CliError(`${flag} must be a non-negative integer.`);
  }
  return number;
}

function parseEnvEntries(entries) {
  const env = {};
  for (const entry of entries) {
    const equalsAt = String(entry).indexOf("=");
    if (equalsAt < 1) throw new CliError(`Invalid --env value: ${entry}. Expected KEY=VALUE.`);
    env[entry.slice(0, equalsAt)] = entry.slice(equalsAt + 1);
  }
  return env;
}

function hasAnyRepeatable(parsed, keys) {
  return keys.some((key) => (parsed.repeatables[key] ?? []).length > 0);
}

function buildExtraArgs(parsed) {
  const args = [];

  for (const key of PASS_THROUGH_VALUE_FLAGS) {
    const value = parsed.values[key];
    if (value !== undefined && value !== "") args.push(FLAG_NAME_BY_KEY.get(key), String(value));
  }

  for (const key of PASS_THROUGH_REPEATABLE_FLAGS) {
    for (const value of parsed.repeatables[key] ?? []) {
      args.push(FLAG_NAME_BY_KEY.get(key), String(value));
    }
  }

  for (const key of PASS_THROUGH_BOOLEAN_FLAGS) {
    if (parsed.booleans[key] === true) args.push(FLAG_NAME_BY_KEY.get(key));
  }

  return args;
}

function compactObject(value) {
  if (Array.isArray(value)) return value.map(compactObject);
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (nestedValue === undefined) continue;
    if (Array.isArray(nestedValue) && nestedValue.length === 0) continue;
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      const compacted = compactObject(nestedValue);
      if (Object.keys(compacted).length === 0) continue;
      output[key] = compacted;
      continue;
    }
    output[key] = nestedValue;
  }
  return output;
}

function buildSharedOptions(parsed) {
  const timeoutMs = parseIntegerOption(parsed.values, "timeoutMs", "--timeout-ms");
  const providerMaxPromptTokens = parseIntegerOption(
    parsed.values,
    "providerMaxPromptTokens",
    "--provider-max-prompt-tokens"
  );
  const providerMaxOutputTokens = parseIntegerOption(
    parsed.values,
    "providerMaxOutputTokens",
    "--provider-max-output-tokens"
  );
  const envEntries = [
    ...(parsed.repeatables.envEntries ?? []),
    ...parsed.bareEnvEntries
  ];
  const env = parseEnvEntries(envEntries);

  const provider = compactObject({
    baseUrl: parsed.values.providerBaseUrl,
    type: parsed.values.providerType,
    apiKey: parsed.values.providerApiKey,
    bearerToken: parsed.values.providerBearerToken,
    wireApi: parsed.values.providerWireApi,
    transport: parsed.values.providerTransport,
    modelId: parsed.values.providerModelId,
    wireModel: parsed.values.providerWireModel,
    maxPromptTokens: providerMaxPromptTokens,
    maxOutputTokens: providerMaxOutputTokens
  });

  return compactObject({
    cwd: parsed.values.cwd,
    model: parsed.values.model,
    sessionId: parsed.values.sessionId,
    name: parsed.values.name,
    effort: parsed.values.effort ?? parsed.values.reasoningEffort,
    reasoningEffort: parsed.values.reasoningEffort ?? parsed.values.effort,
    context: parsed.values.context,
    mode: parsed.values.mode,
    plan: parsed.booleans.plan === true ? true : undefined,
    autopilot: parsed.booleans.autopilot === true ? true : undefined,
    interactive: parsed.booleans.interactive === true ? true : undefined,
    addDirs: parsed.repeatables.addDirs ?? [],
    addCwd: parsed.booleans.noAddCwd === true ? false : undefined,
    attachments: parsed.repeatables.attachments ?? [],
    allowTools: parsed.repeatables.allowTools ?? [],
    denyTools: parsed.repeatables.denyTools ?? [],
    availableTools: parsed.repeatables.availableTools ?? [],
    excludedTools: parsed.repeatables.excludedTools ?? [],
    allowUrls: parsed.repeatables.allowUrls ?? [],
    allowAllUrls: parsed.booleans.allowAllUrls === true ? true : undefined,
    denyUrls: parsed.repeatables.denyUrls ?? [],
    allowAllPaths: parsed.booleans.allowAllPaths === true ? true : undefined,
    disallowTempDir: parsed.booleans.disallowTempDir === true ? true : undefined,
    additionalMcpConfigs: parsed.repeatables.additionalMcpConfigs ?? [],
    disableBuiltinMcps: parsed.booleans.disableBuiltinMcps === true ? true : undefined,
    disableMcpServers: parsed.repeatables.disableMcpServers ?? [],
    enableAllGithubMcpTools: parsed.booleans.enableAllGithubMcpTools === true ? true : undefined,
    addGithubMcpTools: parsed.repeatables.addGithubMcpTools ?? [],
    addGithubMcpToolsets: parsed.repeatables.addGithubMcpToolsets ?? [],
    plugins: parsed.repeatables.plugins ?? [],
    gheHost: parsed.values.gheHost,
    timeoutMs,
    command: parsed.values.command,
    env: Object.keys(env).length ? env : undefined,
    provider,
    providerBaseUrl: parsed.values.providerBaseUrl,
    providerType: parsed.values.providerType,
    providerApiKey: parsed.values.providerApiKey,
    providerBearerToken: parsed.values.providerBearerToken,
    providerWireApi: parsed.values.providerWireApi,
    providerTransport: parsed.values.providerTransport,
    providerModelId: parsed.values.providerModelId,
    providerWireModel: parsed.values.providerWireModel,
    providerMaxPromptTokens,
    providerMaxOutputTokens,
    offline: parsed.booleans.offline === true ? true : undefined
  });
}

function buildRunOptions(parsed) {
  const prompt = parsed.values.prompt ?? (parsed.positionals.length ? parsed.positionals.join(" ") : undefined);
  if (!prompt || !String(prompt).trim()) throw new CliError("Missing required --prompt.");

  const sharedOptions = buildSharedOptions(parsed);
  const hasToolPolicy = hasAnyRepeatable(parsed, [
    "allowTools",
    "denyTools",
    "availableTools",
    "excludedTools"
  ]);
  const resumeSessionId = parsed.values.resume ?? parsed.values.sessionId;

  return compactObject({
    ...sharedOptions,
    prompt,
    cwd: sharedOptions.cwd ?? process.cwd(),
    resumeSessionId,
    "continue": parsed.booleans.continueSession === true ? true : undefined,
    continueSession: parsed.booleans.continueSession === true ? true : undefined,
    allowAllTools: hasToolPolicy || parsed.booleans.noAllowAllTools === true ? false : undefined
  });
}

async function loadFunction(candidates) {
  const importErrors = [];

  for (const candidate of candidates) {
    let moduleNamespace;
    try {
      moduleNamespace = await import(candidate.specifier);
    } catch (error) {
      importErrors.push({ specifier: candidate.specifier, error });
      continue;
    }

    for (const name of candidate.names) {
      if (typeof moduleNamespace[name] === "function") {
        return { fn: moduleNamespace[name], source: `${candidate.specifier}#${name}` };
      }
    }
  }

  return { fn: null, source: null, importErrors };
}

function getExitCode(result) {
  if (typeof result?.exitCode === "number") return result.exitCode;
  if (typeof result?.code === "number") return result.code;
  if (result?.errorMessage || result?.error) return 1;
  return 0;
}

const SECRET_KEY_PATTERN = /(?:api[-_]?key|bearer[-_]?token|access[-_]?token|refresh[-_]?token|id[-_]?token|authorization|credential|password|secret|^token$)/i;

function redactSecrets(value, key = "", seen = new WeakSet()) {
  if (SECRET_KEY_PATTERN.test(key)) return "[REDACTED]";
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, key, seen));
  }

  const output = {};
  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    output[nestedKey] = redactSecrets(nestedValue, nestedKey, seen);
  }
  return output;
}

function printJson(value, parsed) {
  const pretty = parsed.booleans.pretty !== false;
  console.log(JSON.stringify(redactSecrets(value), null, pretty ? 2 : 0));
}

function normalizeRunResult(result) {
  return {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    sessionId: result.sessionId,
    model: result.model,
    provider: result.provider,
    summary: result.summary,
    errorMessage: result.errorMessage,
    usage: result.usage,
    premiumRequests: result.premiumRequests
  };
}

async function handleRun(parsed) {
  const options = buildRunOptions(parsed);
  const { fn: runCopilotLocal } = await loadFunction([
    { specifier: "../src/index.js", names: ["runCopilotLocal"] }
  ]);

  if (!runCopilotLocal) {
    const payload = {
      exitCode: 1,
      errorMessage: "Run support is unavailable. Expected ../src/index.js to export runCopilotLocal(options)."
    };
    printJson(payload, parsed);
    process.exitCode = 1;
    return;
  }

  const result = await runCopilotLocal(options);

  if (parsed.booleans.raw === true) {
    process.stdout.write(result?.stdout ?? "");
  } else {
    printJson(normalizeRunResult(result ?? {}), parsed);
  }

  process.exitCode = getExitCode(result);
}

async function handleLogin(parsed) {
  const options = buildSharedOptions(parsed);
  const { fn: login, importErrors } = await loadFunction([
    { specifier: "../src/login.js", names: ["loginCopilotLocal", "login", "runLogin", "runCopilotLogin"] },
    { specifier: "../src/index.js", names: ["loginCopilotLocal", "login", "runLogin", "runCopilotLogin"] }
  ]);

  if (!login) {
    const details = importErrors?.find(({ error }) => error?.code !== "ERR_MODULE_NOT_FOUND")?.error?.message;
    const payload = {
      exitCode: 1,
      errorMessage: details
        ? `Login support could not be loaded: ${details}`
        : "Login support is unavailable. Expected ../src/login.js or ../src/index.js to export loginCopilotLocal(options)."
    };
    printJson(payload, parsed);
    process.exitCode = 1;
    return;
  }

  const result = await login(options);
  if (parsed.booleans.raw === true && typeof result?.stdout === "string") {
    process.stdout.write(result.stdout);
  } else {
    printJson(result ?? { exitCode: 0 }, parsed);
  }
  process.exitCode = getExitCode(result);
}

async function handleModels(parsed) {
  const options = buildSharedOptions(parsed);
  const { fn: listModels } = await loadFunction([
    {
      specifier: "../src/index.js",
      names: ["listCopilotLocalModels", "listModels", "getCopilotLocalModels", "listFallbackModels"]
    },
    {
      specifier: "../src/models.js",
      names: ["listCopilotLocalModels", "listModels", "getCopilotLocalModels", "listFallbackModels"]
    }
  ]);

  if (!listModels) {
    const payload = {
      exitCode: 1,
      errorMessage: "Model listing is unavailable. Expected a listModels-compatible export from ../src/index.js or ../src/models.js."
    };
    printJson(payload, parsed);
    process.exitCode = 1;
    return;
  }

  const result = await listModels(options);
  const payload = Array.isArray(result) ? { models: result } : result ?? { models: [] };
  printJson(payload, parsed);
  process.exitCode = getExitCode(payload);
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    if (parsed.booleans.help === true) {
      console.log(HELP_TEXT);
      return;
    }

    if (parsed.command === "login") {
      await handleLogin(parsed);
    } else if (parsed.command === "models" || parsed.command === "list-models") {
      await handleModels(parsed);
    } else {
      await handleRun(parsed);
    }
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      process.exitCode = error.exitCode;
      return;
    }

    const payload = {
      exitCode: 1,
      errorMessage: error?.message ?? String(error)
    };
    printJson(payload, parsed ?? { booleans: { pretty: true } });
    process.exitCode = 1;
  }
}

await main();
