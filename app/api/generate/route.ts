import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateDiagram } from "@/lib/generateDiagram";

// Diagram generation can take a while at high effort — allow a long server budget.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and add your key." },
      { status: 500 },
    );
  }

  let body: { prompt?: unknown; currentXml?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { prompt, currentXml } = body;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "A non-empty 'prompt' is required." }, { status: 400 });
  }

  try {
    const xml = await generateDiagram(
      prompt,
      typeof currentXml === "string" ? currentXml : undefined,
    );
    return NextResponse.json({ xml });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error (${err.status}): ${err.message}` },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error generating diagram.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
