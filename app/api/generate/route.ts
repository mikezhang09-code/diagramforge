import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateDiagram } from "@/lib/generateDiagram";
import { getAdapter } from "@/lib/ai/providers";

// Diagram generation can take a while at high effort — allow a long server budget.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: {
    prompt?: unknown;
    currentXml?: unknown;
    provider?: unknown;
    model?: unknown;
    apiKey?: unknown;
    baseUrl?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt, currentXml, provider, model, apiKey, baseUrl } = body;

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "A non-empty 'prompt' is required." }, { status: 400 });
  }
  if (typeof provider !== "string" || !getAdapter(provider)) {
    return NextResponse.json({ error: "A valid 'provider' is required." }, { status: 400 });
  }
  if (typeof model !== "string" || model.trim().length === 0) {
    return NextResponse.json({ error: "A 'model' is required." }, { status: 400 });
  }

  try {
    const xml = await generateDiagram({
      prompt,
      currentXml: typeof currentXml === "string" ? currentXml : undefined,
      providerId: provider,
      model,
      apiKey: typeof apiKey === "string" ? apiKey : undefined,
      baseUrl: typeof baseUrl === "string" ? baseUrl : undefined,
    });
    return NextResponse.json({ xml });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `API error (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error generating diagram.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
