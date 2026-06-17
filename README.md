# draw.io AI Editor

Approach B from the design sketch: **build your own editor (skip MCP)**.

```
Your editor app  ──►  Your backend  ──►  Anthropic API
(react-drawio)        (Next.js route)     (generates draw.io XML)
      ▲                                          │
      └──────────── XML loads back ──────────────┘
```

A standalone web app: type a description, the Next.js backend asks Claude to produce
[draw.io](https://www.drawio.com/) `mxGraph` XML, and the result loads straight into an
embedded draw.io editor where you can keep editing by hand or with follow-up prompts.

## How it works

| Piece | File | Role |
| --- | --- | --- |
| Frontend editor | `app/page.tsx` | Embeds draw.io via [`react-drawio`](https://www.npmjs.com/package/react-drawio), sends prompts, loads returned XML |
| Backend orchestrator | `app/api/generate/route.ts` | Validates the request and calls the generator |
| Anthropic call | `lib/generateDiagram.ts` | Prompts `claude-opus-4-8` for `mxGraphModel` XML and cleans the output |

Follow-up prompts ("add a Redis cache between the API and the database") send the current
diagram XML back as context, so Claude edits the existing diagram instead of starting over.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, type a description, and press **Generate**.

## Configuration

- `ANTHROPIC_API_KEY` — required. Get one at https://console.anthropic.com/.

The model is set in `lib/generateDiagram.ts` (`claude-opus-4-8`). Adaptive thinking is on;
adjust `max_tokens` there if you generate very large diagrams.

## Notes

- The draw.io editor runs from the public embed (`embed.diagrams.net`). No diagram data is
  sent anywhere except your own backend and the Anthropic API.
- This is the "build your own product" path. If you instead just want Claude Desktop to drive
  draw.io for personal use, that's Approach A (an MCP server) — a different project.
