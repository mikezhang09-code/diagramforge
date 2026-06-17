import type { GenerateParams, ModelInfo, ProviderAdapter, ProviderId } from "./types";

// Non-chat models the /models endpoint also returns — hide them from the picker.
const NON_CHAT =
  /(embedding|whisper|tts|audio|dall-e|moderation|image|realtime|transcribe|asr|voiceclone|voicedesign)/i;

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    return json?.error?.message ?? text ?? res.statusText;
  } catch {
    return text || res.statusText;
  }
}

interface OpenAiOptions {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  envKeys: string[];
  apiKeyHint: string;
  docsUrl: string;
  fallbackModels: ModelInfo[];
}

/**
 * OpenAI Chat Completions adapter. Works for OpenAI itself and any
 * OpenAI-compatible endpoint (e.g. Mimo) via a different base URL — both accept
 * `Authorization: Bearer` and the standard `/models` + `/chat/completions` routes.
 */
export function createOpenAiAdapter(opts: OpenAiOptions): ProviderAdapter {
  return {
    id: opts.id,
    label: opts.label,
    defaultBaseUrl: opts.defaultBaseUrl,
    envKeys: opts.envKeys,
    apiKeyHint: opts.apiKeyHint,
    docsUrl: opts.docsUrl,
    fallbackModels: opts.fallbackModels,

    async listModels(apiKey, baseUrl) {
      const base = (baseUrl || opts.defaultBaseUrl).replace(/\/$/, "");
      const res = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) throw new Error(await readError(res));
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? [])
        .map((m) => m.id)
        .filter((id) => !NON_CHAT.test(id))
        .sort()
        .map((id) => ({ id, label: id }));
    },

    async generate({ apiKey, baseUrl, model, system, user, maxTokens }: GenerateParams) {
      const base = (baseUrl || opts.defaultBaseUrl).replace(/\/$/, "");
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          // `max_completion_tokens` is the current param and is accepted by gpt-4o
          // and newer (incl. reasoning models, which reject the legacy `max_tokens`).
          max_completion_tokens: maxTokens,
          stream: false,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return json.choices?.[0]?.message?.content ?? "";
    },
  };
}

export const openaiAdapter = createOpenAiAdapter({
  id: "openai",
  label: "OpenAI",
  defaultBaseUrl: "https://api.openai.com/v1",
  envKeys: ["OPENAI_API_KEY"],
  apiKeyHint: "sk-…",
  docsUrl: "https://platform.openai.com/api-keys",
  fallbackModels: [
    { id: "gpt-5", label: "gpt-5" },
    { id: "gpt-5-mini", label: "gpt-5-mini" },
    { id: "gpt-4.1", label: "gpt-4.1" },
    { id: "gpt-4o", label: "gpt-4o" },
    { id: "gpt-4o-mini", label: "gpt-4o-mini" },
  ],
});
