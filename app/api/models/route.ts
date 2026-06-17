import { NextRequest, NextResponse } from "next/server";
import { getAdapter, envApiKey, providerMeta } from "@/lib/ai/providers";

export const maxDuration = 60;

/** GET /api/models — list the providers and their metadata for the UI. */
export async function GET() {
  return NextResponse.json({ providers: providerMeta() });
}

/**
 * POST /api/models — list the models available to a provider for the given key.
 * Body: { provider, apiKey?, baseUrl? }. Falls back to the server env key.
 */
export async function POST(req: NextRequest) {
  let body: { provider?: unknown; apiKey?: unknown; baseUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { provider, apiKey, baseUrl } = body;
  const adapter = typeof provider === "string" ? getAdapter(provider) : undefined;
  if (!adapter) {
    return NextResponse.json({ error: "A valid 'provider' is required." }, { status: 400 });
  }

  const key = (typeof apiKey === "string" && apiKey.trim()) || envApiKey(adapter);
  if (!key) {
    return NextResponse.json(
      { error: `No API key for ${adapter.label}. Enter one above or set ${adapter.envKeys[0]}.` },
      { status: 400 },
    );
  }

  try {
    const models = await adapter.listModels(
      key,
      typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : undefined,
    );
    if (models.length === 0) {
      return NextResponse.json({ models: adapter.fallbackModels });
    }
    return NextResponse.json({ models });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list models.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
