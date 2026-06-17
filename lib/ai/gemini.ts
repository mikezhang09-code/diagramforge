import type { GenerateParams, ModelInfo, ProviderAdapter } from "./types";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text);
    return json?.error?.message ?? text ?? res.statusText;
  } catch {
    return text || res.statusText;
  }
}

/** Google Gemini (Generative Language API) adapter. */
export const geminiAdapter: ProviderAdapter = {
  id: "gemini",
  label: "Google Gemini",
  defaultBaseUrl: DEFAULT_BASE_URL,
  envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  apiKeyHint: "AIza…",
  docsUrl: "https://aistudio.google.com/app/apikey",
  fallbackModels: [
    { id: "gemini-2.5-pro", label: "gemini-2.5-pro" },
    { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    { id: "gemini-2.0-flash", label: "gemini-2.0-flash" },
  ],

  async listModels(apiKey, baseUrl) {
    const base = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    const res = await fetch(`${base}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error(await readError(res));
    const json = (await res.json()) as {
      models?: Array<{
        name: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    return (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => {
        const id = m.name.replace(/^models\//, "");
        return { id, label: m.displayName ?? id };
      });
  },

  async generate({ apiKey, baseUrl, model, system, user, maxTokens }: GenerateParams) {
    const base = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    const res = await fetch(
      `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      },
    );
    if (!res.ok) throw new Error(await readError(res));
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
  },
};
