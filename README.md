# DiagramForge

> Describe a diagram in plain English and edit it live. **Built on the open-source
> [draw.io](https://www.drawio.com/) editor** (Apache-2.0). "draw.io" and "diagrams.net" are
> trademarks of JGraph Ltd.; DiagramForge is an independent project and is not affiliated with
> or endorsed by them.

DiagramForge owns the whole stack — its own editor UI, backend, AI provider, and a self-hosted
copy of the draw.io editor:

```
DiagramForge UI  ──►  DiagramForge backend  ──►  AI provider
(react-drawio)        (Next.js route)            (generates mxGraph XML)
      ▲                                                │
      └──────────────── XML loads back ───────────────┘
```

A standalone web app: type a description, the backend asks an AI model to produce
[draw.io](https://www.drawio.com/) `mxGraph` XML, and the result loads straight into the
embedded editor where you can keep editing by hand or with follow-up prompts.

The AI provider is configurable **from inside the app** — there is no model config in any
`.env` file. Open **⚙ Settings**, pick a provider (**Anthropic (Claude)**, **OpenAI**, **Google
Gemini**, or **Mimo** — Xiaomi, via its OpenAI-compatible API), paste your API key, click
**Load models** to fetch the models that key can actually use, and choose one.

## How it works

| Piece | File | Role |
| --- | --- | --- |
| Frontend editor | `app/page.tsx` | Embeds draw.io via [`react-drawio`](https://www.npmjs.com/package/react-drawio), holds the provider/key/model settings, sends prompts, loads returned XML |
| Model discovery | `app/api/models/route.ts` | Lists providers, and lists the models a given API key can access |
| Backend orchestrator | `app/api/generate/route.ts` | Validates the request and dispatches to the chosen provider |
| Prompting | `lib/generateDiagram.ts` | Builds the system/user prompt for `mxGraphModel` XML and cleans the output |
| Providers | `lib/ai/*` | Per-provider adapters (model listing + generation) and the registry |
| Saved diagrams | `app/api/diagrams/route.ts` | Lists / reads / writes / deletes `.drawio` files in the server's `diagrams/` folder |

Follow-up prompts ("add a Redis cache between the API and the database") send the current
diagram XML back as context, so the model edits the existing diagram instead of starting over.

### Adding a provider

Implement the `ProviderAdapter` interface (`lib/ai/types.ts`) — `listModels` and `generate` —
and register it in `lib/ai/providers.ts`. OpenAI-compatible endpoints can reuse
`createOpenAiAdapter` by just overriding the base URL (that's how Mimo is wired up);
Anthropic-compatible ones can reuse `createAnthropicAdapter` the same way.

## Getting started

```bash
npm install
npm run setup:drawio   # fetches the self-hosted draw.io editor into public/drawio (~146 MB)
npm run dev
```

`setup:drawio` downloads the draw.io webapp once (it's gitignored, like `node_modules`). You
don't need to create a `.env` file. Open http://localhost:3005, click **⚙ Settings**, pick a
provider, paste your API key, click **Load models**, choose a model, then type a description and
press **Generate**.

(`.env.local` is purely optional — see [AI provider & model settings](#ai-provider--model-settings).)

### Public internet access (Cloudflare Tunnel)

To expose the running server to the public internet without opening firewall ports, use a
Cloudflare **quick tunnel**:

```bash
npm run dev        # in one terminal (serves on :3005)
npm run tunnel     # in another — prints a public https://<name>.trycloudflare.com URL
```

Or run both at once with `npm run dev:public` (uses `concurrently`; `Ctrl+C` stops both).
The public URL is reprinted in a clear `PUBLIC URL: …` banner so it doesn't get lost in the
interleaved dev-server and tunnel logs.

`npm run tunnel` runs `cloudflared tunnel --url http://localhost:3005` (via `scripts/tunnel.sh`).
The whole app —
including the self-hosted editor at `/drawio` — is reachable at that URL, so public users get
the full editor without needing to reach `embed.diagrams.net` themselves. (This is the Next.js
equivalent of the `t + enter` quick tunnel that Cloudflare's Vite plugin offers.)

Requires `cloudflared` on the host. Quick tunnels are **ephemeral** (new random URL each run)
and rate-limited — fine for demos. For a stable URL on your own domain, use a **named tunnel**
(`cloudflared tunnel login` → `create` → DNS route → run as a service).

**Password gate.** Because there's no per-user accounts yet, the whole app is protected by a
single shared password (HTTP Basic Auth in `middleware.ts`) — the page, `/api/*`, and the
`/drawio` editor are all gated, so a public visitor must log in before anything loads. Set the
password via `APP_PASSWORD` in `.env` (username can be anything; only the password is checked).
A built-in default applies if unset, so the gate is always on — **set your own before going
public**. Browsers cache the credential per origin, so it's a one-time prompt per session.

> ⚠️ Still: don't set a real `*_API_KEY` in `.env` while public unless you intend authorized
> users to spend it. The password gate controls access, but anyone you give the password to can
> use the editor and read/write/delete diagrams via `/api/diagrams`.

### Tailscale / LAN access

`npm run dev` binds to all interfaces (`-H 0.0.0.0`) on a fixed port (`3005`), so the editor is
reachable from other devices on the tailnet at `http://<this-machine's-tailscale-ip>:3005`
(e.g. http://100.113.14.97:3005). The machine's Tailscale IP is allow-listed via
`allowedDevOrigins` in `next.config.mjs` so Next.js permits cross-origin access to its
`/_next/*` dev assets. If the VM's Tailscale IP changes, update that list.

## Self-hosted draw.io editor

The diagram editor is the **draw.io webapp served from this app itself** (under `/drawio`), not
the public `embed.diagrams.net` service. This means:

- No external dependency at runtime — the editor works on any device that can reach this server
  (e.g. over Tailscale), even with no general internet access.
- No reliance on diagrams.net's hosted-service terms. draw.io is **Apache-2.0**; you self-host
  your own copy. (You still can't use the "draw.io"/"diagrams.net" trademarks for your product.)

Setup and versioning:

- `npm run setup:drawio` fetches the editor into `public/drawio`. It's **gitignored** (~146 MB),
  so run it once after cloning and on deploy. Pin a different release with
  `DRAWIO_VERSION=v30.0.4 npm run setup:drawio`.
- To point at a different editor instead (e.g. a CDN, or back to the hosted service), set
  `NEXT_PUBLIC_DRAWIO_BASE_URL` (e.g. `https://embed.diagrams.net`). When unset, the app uses
  its own origin + `/drawio/index.html`.
- **Branding:** `setup:drawio` stamps DiagramForge's marks (from `assets/brand/`) over the
  fetched editor's logo/favicon/title, so the served editor carries no draw.io logo. (In embed
  mode draw.io doesn't display its logo in the editor UI anyway; this covers the favicon, the
  bundled logo assets, and the iframe title.)

## Templates

The file toolbar's **Template…** button opens a gallery of draw.io's built-in templates (155
across categories like Basic, Flowcharts, Cloud/AWS, Network, UML…), with thumbnail previews.
Picking one loads it as a new unsaved diagram.

These come from the self-hosted editor's `public/drawio/templates/` (read via `templates/index.xml`).
Note: draw.io's **embed mode hides its own native template picker** — the host app is meant to
drive document creation — so this gallery (`app/TemplateGallery.tsx`) is the app's own UI over
those files. That's why there's no template menu *inside* the draw.io canvas itself.

## Saving diagrams

The file toolbar (under the prompt bar) gives **New**, **Open…**, **Save**, and **Save As…**.
Saved diagrams are written as `.drawio` (XML) files in a `diagrams/` folder at the project root
on the server — the toolbar shows the exact path. `New` clears the canvas, `Open…` lists saved
diagrams, and `Save` overwrites the current file (prompting for a name the first time).

> Note: the **Save button inside the draw.io editor itself** only hands the XML back to the app;
> use the app's toolbar **Save** to write a file. draw.io's **Export/Import** still work for
> downloading/uploading individual files to your computer.

The `diagrams/` folder is gitignored (it's user data). Saved files live on whichever machine
runs the server.

## AI provider & model settings

**All AI configuration is done in the app's ⚙ Settings panel — `.env` no longer controls the
provider or model.** (Earlier versions hardcoded `claude-opus-4-8`; that's gone.)

In the Settings panel you can set, per provider:

| Setting | What it does |
| --- | --- |
| **Provider** | Anthropic, OpenAI, Gemini, or Mimo. Each has its own adapter in `lib/ai/`. |
| **API key** | Sent to this app's own backend with each request. Stored per-provider in your browser's `localStorage`, so switching providers keeps each key. |
| **Base URL** | Optional override of the provider's API endpoint — handy for proxies or other OpenAI/Anthropic-compatible gateways. Defaults are shown as the placeholder. |
| **Model** | Click **Load models** to query the provider with your key and list the models it can use, then pick one. A short fallback list is shown before you load. |

### Where keys come from

For a given request the backend resolves the key in this order:

1. The key you entered in the Settings panel (preferred).
2. A server environment variable, **only as a fallback** if no in-app key is set:
   `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MIMO_API_KEY`.

So `.env.local` is now optional and only useful for a shared server-side fallback key (e.g. a
deployment where you don't want every user to bring their own). For normal local use you can
ignore it entirely. See `.env.example` for the variable names.

> Security note: in-app keys live in the browser's `localStorage` (readable by any script on
> that origin). That's fine for a personal/trusted tool, but don't use this BYO-key-in-browser
> model to handle other people's keys in a shared deployment.

Adaptive thinking is enabled for Anthropic only; adjust `max_tokens` in
`lib/generateDiagram.ts` if you generate very large diagrams.

## Notes

- The draw.io editor is [self-hosted](#self-hosted-drawio-editor) under `/drawio` on this
  server, so no diagram data leaves your own backend except the prompts/XML sent to the AI
  provider you selected. If the editor canvas never appears, the `public/drawio` assets are
  probably missing — run `npm run setup:drawio`. (The app shows a hint banner after ~20s.)
- DiagramForge is a self-contained product. If you only want an AI assistant to drive a diagram
  editor for personal use, an MCP-server approach (e.g. with Claude Desktop) is a simpler — but
  separate — alternative.
