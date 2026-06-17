import { createAnthropicAdapter } from "./anthropic";
import { openaiAdapter, createOpenAiAdapter } from "./openai";
import { geminiAdapter } from "./gemini";
import type { ProviderAdapter, ProviderId, ProviderMeta } from "./types";

const anthropicAdapter = createAnthropicAdapter({
  id: "anthropic",
  label: "Anthropic (Claude)",
  defaultBaseUrl: "https://api.anthropic.com",
  envKeys: ["ANTHROPIC_API_KEY"],
  apiKeyHint: "sk-ant-…",
  docsUrl: "https://console.anthropic.com/",
  thinking: true,
  fallbackModels: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
});

// Mimo (Xiaomi) exposes an OpenAI-compatible API at /v1 (Bearer auth, standard
// /models + /chat/completions). Its /anthropic surface doesn't support model
// listing, so we drive it through the OpenAI adapter.
const mimoAdapter = createOpenAiAdapter({
  id: "mimo",
  label: "Mimo (Xiaomi)",
  defaultBaseUrl: "https://api.xiaomimimo.com/v1",
  envKeys: ["MIMO_API_KEY"],
  apiKeyHint: "sk-…",
  docsUrl: "https://xiaomimimo.com/",
  fallbackModels: [
    { id: "mimo-v2.5-pro", label: "mimo-v2.5-pro" },
    { id: "mimo-v2.5", label: "mimo-v2.5" },
    { id: "mimo-v2-pro", label: "mimo-v2-pro" },
    { id: "mimo-v2-flash", label: "mimo-v2-flash" },
  ],
});

const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
  mimo: mimoAdapter,
};

/** Order shown in the provider dropdown. */
export const PROVIDER_ORDER: ProviderId[] = ["anthropic", "openai", "gemini", "mimo"];

export function getAdapter(id: string): ProviderAdapter | undefined {
  return (ADAPTERS as Record<string, ProviderAdapter | undefined>)[id];
}

/** Resolve a server-side fallback API key from this provider's env vars. */
export function envApiKey(adapter: ProviderAdapter): string | undefined {
  for (const key of adapter.envKeys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

/** Secret-free provider metadata for the client UI. */
export function providerMeta(): ProviderMeta[] {
  return PROVIDER_ORDER.map((id) => {
    const a = ADAPTERS[id];
    return {
      id: a.id,
      label: a.label,
      defaultBaseUrl: a.defaultBaseUrl,
      apiKeyHint: a.apiKeyHint,
      docsUrl: a.docsUrl,
      fallbackModels: a.fallbackModels,
    };
  });
}
