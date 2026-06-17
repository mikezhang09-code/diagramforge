import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Diagrams are stored as .drawio (XML) files in ./diagrams under the project root.
const DIR = path.join(process.cwd(), "diagrams");
const EXT = ".drawio";

/** Reduce a user-supplied name to a safe bare filename (no path traversal). */
function safeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Drop any directory parts, then keep a friendly charset.
  const base = path.basename(raw).replace(/\.drawio$/i, "");
  const cleaned = base.replace(/[^a-zA-Z0-9 _.-]/g, "").trim();
  return cleaned.length ? cleaned : null;
}

async function ensureDir() {
  await fs.mkdir(DIR, { recursive: true });
}

/** GET — list saved diagrams, or `?name=` to fetch one's XML. */
export async function GET(req: NextRequest) {
  await ensureDir();
  const name = req.nextUrl.searchParams.get("name");

  if (name) {
    const safe = safeName(name);
    if (!safe) return NextResponse.json({ error: "Invalid name." }, { status: 400 });
    try {
      const xml = await fs.readFile(path.join(DIR, safe + EXT), "utf8");
      return NextResponse.json({ name: safe, xml });
    } catch {
      return NextResponse.json({ error: `Not found: ${safe}` }, { status: 404 });
    }
  }

  const entries = await fs.readdir(DIR);
  const names = entries
    .filter((f) => f.toLowerCase().endsWith(EXT))
    .map((f) => f.slice(0, -EXT.length))
    .sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ dir: DIR, diagrams: names });
}

/** POST { name, xml } — save (create or overwrite) a diagram. */
export async function POST(req: NextRequest) {
  await ensureDir();
  let body: { name?: unknown; xml?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const safe = safeName(body.name);
  if (!safe) return NextResponse.json({ error: "A valid 'name' is required." }, { status: 400 });
  if (typeof body.xml !== "string" || body.xml.trim().length === 0) {
    return NextResponse.json({ error: "A non-empty 'xml' is required." }, { status: 400 });
  }

  const file = path.join(DIR, safe + EXT);
  await fs.writeFile(file, body.xml, "utf8");
  return NextResponse.json({ name: safe, path: file });
}

/** DELETE ?name= — remove a saved diagram. */
export async function DELETE(req: NextRequest) {
  const safe = safeName(req.nextUrl.searchParams.get("name"));
  if (!safe) return NextResponse.json({ error: "Invalid name." }, { status: 400 });
  try {
    await fs.unlink(path.join(DIR, safe + EXT));
    return NextResponse.json({ name: safe, deleted: true });
  } catch {
    return NextResponse.json({ error: `Not found: ${safe}` }, { status: 404 });
  }
}
