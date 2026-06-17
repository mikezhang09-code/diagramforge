import Anthropic from "@anthropic-ai/sdk";
import type { GenerateParams, ModelInfo, ProviderAdapter, ProviderId } from "./types";

interface AnthropicOptions {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  envKeys: string[];
  apiKeyHint: string;
  docsUrl: string;
  fallbackModels: ModelInfo[];
  /** Adaptive thinking is an Anthropic-native feature; compatibility endpoints reject it. */
  thinking: boolean;
}

/**
 * Anthropic Messages API adapter. Reused for first-party Anthropic and for any
 * Anthropic-compatible endpoint (e.g. Mimo) by overriding the base URL.
 */
export function createAnthropicAdapter(opts: AnthropicOptions): ProviderAdapter {
  const client = (apiKey: string, baseUrl?: string) =>
    new Anthropic({ apiKey, baseURL: baseUrl || opts.defaultBaseUrl });

  return {
    id: opts.id,
    label: opts.label,
    defaultBaseUrl: opts.defaultBaseUrl,
    envKeys: opts.envKeys,
    apiKeyHint: opts.apiKeyHint,
    docsUrl: opts.docsUrl,
    fallbackModels: opts.fallbackModels,

    async listModels(apiKey, baseUrl) {
      const res = await client(apiKey, baseUrl).models.list({ limit: 100 });
      return res.data.map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
    },

    async generate({ apiKey, baseUrl, model, system, user, maxTokens }: GenerateParams) {
      // Stream and collect the final message — protects against HTTP timeouts on larger diagrams.
      const stream = client(apiKey, baseUrl).messages.stream({
        model,
        max_tokens: maxTokens,
        ...(opts.thinking ? { thinking: { type: "adaptive" as const } } : {}),
        system,
        messages: [{ role: "user", content: user }],
      });

      const message = await stream.finalMessage();
      return message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
    },
  };
}
