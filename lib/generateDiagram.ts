import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const MODEL = "claude-opus-4-8";

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

/**
 * Turn a natural-language description into draw.io mxGraph XML.
 * `currentXml` (the diagram already in the editor) is passed as context so follow-up
 * prompts like "add a database node" can edit the existing diagram instead of starting over.
 */
export async function generateDiagram(
  prompt: string,
  currentXml?: string,
): Promise<string> {
  const userContent = currentXml?.trim()
    ? `Here is the current diagram XML. Modify it to satisfy the request, preserving existing ` +
      `elements where it makes sense.\n\n<current_diagram>\n${currentXml}\n</current_diagram>\n\n` +
      `Request: ${prompt}`
    : prompt;

  // Stream and collect the final message — protects against HTTP timeouts on larger diagrams.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const message = await stream.finalMessage();

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return extractXml(text);
}

/** Strip any stray code fences / prose and return the bare mxGraphModel document. */
function extractXml(raw: string): string {
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
