/** A provider the user can pick from in the UI. */
export type ProviderId = "anthropic" | "openai" | "gemini" | "mimo";

/** A model offered by a provider, as shown in the model dropdown. */
export interface ModelInfo {
  id: string;
  label: string;
}

/** Everything an adapter needs to produce one diagram. */
export interface GenerateParams {
  apiKey: string;
  baseUrl?: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
}

/**
 * A pluggable AI backend. Each provider implements model discovery (so the user
 * can pick a model with their own key) and text generation. The diagram-specific
 * prompting lives in `generateDiagram.ts`; adapters only deal in raw text.
 */
export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** Default API base URL; the user may override it in the settings panel. */
  defaultBaseUrl: string;
  /** Env vars consulted (in order) for a server-side fallback key. */
  envKeys: string[];
  /** Placeholder/hint shown next to the API key input. */
  apiKeyHint: string;
  /** Where to get a key. */
  docsUrl: string;
  /** Shown before the user loads models, or if listing fails. */
  fallbackModels: ModelInfo[];
  /** Discover models available to this key. */
  listModels(apiKey: string, baseUrl?: string): Promise<ModelInfo[]>;
  /** Generate a completion and return the raw text. */
  generate(params: GenerateParams): Promise<string>;
}

/** Public (no-secret) provider metadata sent to the client. */
export interface ProviderMeta {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
  apiKeyHint: string;
  docsUrl: string;
  fallbackModels: ModelInfo[];
}
