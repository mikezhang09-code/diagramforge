import { getAdapter, envApiKey } from "./ai/providers";

const SYSTEM_PROMPT = `You are a diagram generator for draw.io (diagrams.net). You convert a
natural-language description into a single valid draw.io diagram expressed as mxGraph XML.

Rules:
- Output ONLY the XML, starting with <mxGraphModel and ending with </mxGraphModel>. No prose,
  no markdown code fences, no explanation before or after.
- The root must be <mxGraphModel dx="..." dy="..." grid="1" gridSize="10" ...> containing a
  single <root> with the two mandatory base cells:
    <mxCell id="0" /> and <mxCell id="1" parent="0" />
- Every shape is an <mxCell vertex="1" parent="1"> with a child
  <mxGeometry x y width height as="geometry" />. Use unique string ids.
- Every connector is an <mxCell edge="1" parent="1" source="<id>" target="<id>"> with a child
  <mxGeometry relative="1" as="geometry" />.
- Lay shapes out on a sensible grid so nothing overlaps; leave ~40px gaps. Typical box is
  120x60. Give nodes readable labels via the value attribute.
- Use style strings draw.io understands (e.g. "rounded=1;whiteSpace=wrap;html=1;" for boxes,
  "edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" for connectors, "ellipse;..." for circles,
  "rhombus;..." for decisions).
- Prefer a clear top-to-bottom or left-to-right flow that matches the description.`;

export interface GenerateOptions {
  prompt: string;
  /** The diagram already in the editor, sent as context for follow-up edits. */
  currentXml?: string;
  providerId: string;
  model: string;
  /** User-supplied key; falls back to the provider's env var when omitted. */
  apiKey?: string;
  /** User-supplied base URL override. */
  baseUrl?: string;
}

/**
 * Turn a natural-language description into draw.io mxGraph XML using the chosen
 * provider and model. `currentXml` lets follow-up prompts edit an existing diagram.
 */
export async function generateDiagram(opts: GenerateOptions): Promise<string> {
  const adapter = getAdapter(opts.providerId);
  if (!adapter) throw new Error(`Unknown provider: ${opts.providerId}`);

  const apiKey = opts.apiKey?.trim() || envApiKey(adapter);
  if (!apiKey) {
    throw new Error(
      `No API key for ${adapter.label}. Enter one in Settings or set ${adapter.envKeys[0]}.`,
    );
  }
  if (!opts.model) throw new Error("No model selected.");

  const user = opts.currentXml?.trim()
    ? `Here is the current diagram XML. Modify it to satisfy the request, preserving existing ` +
      `elements where it makes sense.\n\n<current_diagram>\n${opts.currentXml}\n</current_diagram>\n\n` +
      `Request: ${opts.prompt}`
    : opts.prompt;

  const text = await adapter.generate({
    apiKey,
    baseUrl: opts.baseUrl?.trim() || undefined,
    model: opts.model,
    system: SYSTEM_PROMPT,
    user,
    maxTokens: 16000,
  });

  return extractXml(text);
}

/** Strip any stray code fences / prose and return the bare mxGraphModel document. */
export function extractXml(raw: string): string {
  let text = raw.trim();

  // Remove ```xml ... ``` fences if the model added them despite instructions.
  const fenceMatch = text.match(/```(?:xml)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  const start = text.indexOf("<mxGraphModel");
  const end = text.lastIndexOf("</mxGraphModel>");
  if (start !== -1 && end !== -1) {
    text = text.slice(start, end + "</mxGraphModel>".length);
  }

  return text;
}
