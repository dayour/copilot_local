export const DEFAULT_COPILOT_LOCAL_MODEL = "gpt-5.4";

export const COPILOT_LOCAL_MODELS = [
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-5-mini", label: "GPT-5 mini" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.2-codex", label: "GPT-5.2-Codex" },
  { id: "gpt-5.3-codex", label: "GPT-5.3-Codex" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "grok-code-fast-1", label: "Grok Code Fast 1" }
];

export function listFallbackModels() {
  return [...COPILOT_LOCAL_MODELS];
}
