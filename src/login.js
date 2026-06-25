import { spawn } from "node:child_process";

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

function stringEnv(env) {
  return Object.fromEntries(
    Object.entries(env ?? {})
      .filter((entry) => typeof entry[1] === "string")
  );
}

export async function copilotLogin({
  command = "copilot",
  gheHost,
  timeoutMs = 120000,
  env,
  onStdout,
  onStderr
} = {}) {
  const args = ["login"];
  const host = normalizeHost(gheHost);
  if (host) args.push("--host", host);

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let timeout = null;

    const finish = ({ exitCode = null, signal = null, errorMessage = null } = {}) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);

      const output = [stdout, stderr].filter(Boolean).join("\n").trim();
      const success = !timedOut && exitCode === 0;
      resolve({
        success,
        output,
        errorMessage: success
          ? null
          : errorMessage || stderr.trim() || stdout.trim() || (timedOut ? `copilot login timed out after ${timeoutMs}ms` : `copilot login exited with code ${exitCode}`),
        exitCode,
        signal
      });
    };

    const child = spawn(command, args, {
      env: stringEnv(env ? { ...process.env, ...env } : process.env),
      windowsHide: true,
      shell: false
    });

    if (timeoutMs && timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onStdout?.(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onStderr?.(text);
    });
    child.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      stderr += `${message}\n`;
      onStderr?.(message);
      finish({ errorMessage: message });
    });
    child.on("close", (exitCode, signal) => {
      finish({ exitCode, signal });
    });
  });
}

