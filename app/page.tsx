"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DrawIoEmbed, DrawIoEmbedRef } from "react-drawio";
import TemplateGallery from "./TemplateGallery";

const EMPTY_DIAGRAM =
  '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" ' +
  'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" ' +
  'math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel>';

interface ModelInfo {
  id: string;
  label: string;
}
interface ProviderMeta {
  id: string;
  label: string;
  defaultBaseUrl: string;
  apiKeyHint: string;
  docsUrl: string;
  fallbackModels: ModelInfo[];
}

const STORAGE_KEY = "drawio-ai:settings";

interface StoredSettings {
  provider: string;
  model: string;
  apiKeys: Record<string, string>;
  baseUrls: Record<string, string>;
}

function loadSettings(): Partial<StoredSettings> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function Home() {
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The draw.io editor is an iframe. We self-host the editor under /drawio so it
  // loads from this app's own origin (no dependency on embed.diagrams.net). The
  // base URL must be absolute, so it's resolved client-side from the origin; an
  // env override lets you point elsewhere (e.g. a CDN or embed.diagrams.net).
  const [embedBase, setEmbedBase] = useState<string | null>(null);
  useEffect(() => {
    setEmbedBase(
      process.env.NEXT_PUBLIC_DRAWIO_BASE_URL ||
        `${window.location.origin}/drawio/index.html`,
    );
  }, []);

  // If the editor iframe doesn't report ready in time, surface a hint instead of
  // an endless blank canvas (e.g. the /drawio assets failed to load).
  const [editorReady, setEditorReady] = useState(false);
  const [editorTimedOut, setEditorTimedOut] = useState(false);

  // Track the latest diagram XML from the editor so follow-up prompts can edit it.
  const currentXml = useRef<string>(EMPTY_DIAGRAM);

  // Saved diagrams (server folder).
  const [diagramName, setDiagramName] = useState<string | null>(null);
  const [savedList, setSavedList] = useState<string[]>([]);
  const [saveDir, setSaveDir] = useState<string>("");
  const [fileMsg, setFileMsg] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Provider / model configuration.
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [provider, setProvider] = useState("anthropic");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [baseUrls, setBaseUrls] = useState<Record<string, string>>({});
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // If the embed hasn't reported ready within 20s, assume it's blocked/unreachable.
  useEffect(() => {
    const t = setTimeout(() => setEditorTimedOut(true), 20000);
    return () => clearTimeout(t);
  }, []);

  const meta = providers.find((p) => p.id === provider);
  const apiKey = apiKeys[provider] ?? "";
  const baseUrl = baseUrls[provider] ?? "";

  // Load saved settings + provider metadata on mount.
  useEffect(() => {
    const saved = loadSettings();
    if (saved.provider) setProvider(saved.provider);
    if (saved.model) setModel(saved.model);
    if (saved.apiKeys) setApiKeys(saved.apiKeys);
    if (saved.baseUrls) setBaseUrls(saved.baseUrls);

    fetch("/api/models")
      .then((r) => r.json())
      .then((d: { providers?: ProviderMeta[] }) => {
        const list = d.providers ?? [];
        setProviders(list);
        const active = saved.provider ?? "anthropic";
        const pm = list.find((p) => p.id === active);
        if (pm) {
          setModels(pm.fallbackModels);
          if (!saved.model) setModel(pm.fallbackModels[0]?.id ?? "");
        }
      })
      .catch(() => setModelsError("Could not load provider list."));
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const data: StoredSettings = { provider, model, apiKeys, baseUrls };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [provider, model, apiKeys, baseUrls]);

  // When the provider changes, reset the model list to its fallbacks.
  const switchProvider = useCallback(
    (id: string) => {
      setProvider(id);
      setModelsError(null);
      const pm = providers.find((p) => p.id === id);
      const fallback = pm?.fallbackModels ?? [];
      setModels(fallback);
      setModel(fallback[0]?.id ?? "");
    },
    [providers],
  );

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey, baseUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load models.");
      const list: ModelInfo[] = data.models ?? [];
      setModels(list);
      if (list.length && !list.some((m) => m.id === model)) setModel(list[0].id);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : "Failed to load models.");
    } finally {
      setModelsLoading(false);
    }
  }, [provider, apiKey, baseUrl, model]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          currentXml: currentXml.current,
          provider,
          model,
          apiKey,
          baseUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      currentXml.current = data.xml;
      // autosave:true keeps `onAutoSave` firing so later manual edits stay in sync.
      drawioRef.current?.load({ xml: data.xml, autosave: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, provider, model, apiKey, baseUrl]);

  // ---- Saved diagrams (server folder) ----

  const refreshList = useCallback(async () => {
    try {
      const res = await fetch("/api/diagrams");
      const data = await res.json();
      if (res.ok) {
        setSavedList(data.diagrams ?? []);
        if (data.dir) setSaveDir(data.dir);
      }
    } catch {
      /* listing is best-effort */
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const newDiagram = useCallback(() => {
    currentXml.current = EMPTY_DIAGRAM;
    setDiagramName(null);
    setFileMsg(null);
    drawioRef.current?.load({ xml: EMPTY_DIAGRAM, autosave: true });
  }, []);

  // Load a draw.io template as a new, unsaved diagram.
  const loadTemplate = useCallback((xml: string, label: string) => {
    currentXml.current = xml;
    setDiagramName(null);
    setFileMsg(`Loaded template: ${label} (unsaved)`);
    drawioRef.current?.load({ xml, autosave: true });
  }, []);

  const openDiagram = useCallback(async (name: string) => {
    if (!name) return;
    setFileMsg(null);
    try {
      const res = await fetch(`/api/diagrams?name=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open diagram.");
      currentXml.current = data.xml;
      setDiagramName(data.name);
      drawioRef.current?.load({ xml: data.xml, autosave: true });
    } catch (err) {
      setFileMsg(err instanceof Error ? err.message : "Could not open diagram.");
    }
  }, []);

  const saveAs = useCallback(
    async (forcePrompt: boolean) => {
      let name = diagramName;
      if (forcePrompt || !name) {
        const input = window.prompt("Save diagram as:", name ?? "untitled");
        if (!input) return;
        name = input;
      }
      setFileMsg(null);
      try {
        const res = await fetch("/api/diagrams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, xml: currentXml.current }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Save failed.");
        setDiagramName(data.name);
        setFileMsg(`Saved to ${data.path}`);
        refreshList();
      } catch (err) {
        setFileMsg(err instanceof Error ? err.message : "Save failed.");
      }
    },
    [diagramName, refreshList],
  );

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #cdd0d5",
    borderRadius: 6,
    outline: "none",
    background: "#fff",
  };
  const fileBtnStyle: React.CSSProperties = {
    padding: "6px 12px",
    fontSize: 13,
    color: "#3c4043",
    background: "#fff",
    border: "1px solid #dadce0",
    borderRadius: 6,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "#5f6368",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <header
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "12px 16px",
          background: "#fff",
          borderBottom: "1px solid #e4e6eb",
        }}
      >
        <span
          style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, whiteSpace: "nowrap" }}
        >
          <strong style={{ fontSize: 15 }}>DiagramForge</strong>
          <span style={{ fontSize: 10, color: "#9aa0a6" }}>
            Built on the open-source draw.io editor
          </span>
        </span>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generate();
          }}
          placeholder="Describe a diagram — e.g. 'a CI/CD pipeline from commit to deploy'"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => setShowSettings((s) => !s)}
          title="Provider & model settings"
          style={{
            padding: "8px 12px",
            fontSize: 14,
            color: "#3c4043",
            background: showSettings ? "#e8f0fe" : "#f1f3f4",
            border: "1px solid #dadce0",
            borderRadius: 6,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          ⚙ {meta?.label ?? provider}
        </button>
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          style={{
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            background: loading || !prompt.trim() ? "#9aa0a6" : "#1a73e8",
            border: "none",
            borderRadius: 6,
            cursor: loading || !prompt.trim() ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Generating…" : "Generate"}
        </button>
      </header>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 16px",
          background: "#fafbfc",
          borderBottom: "1px solid #e4e6eb",
          fontSize: 13,
        }}
      >
        <button onClick={newDiagram} style={fileBtnStyle}>
          New
        </button>
        <button onClick={() => setShowTemplates(true)} style={fileBtnStyle}>
          Template…
        </button>
        <select
          value=""
          onChange={(e) => {
            openDiagram(e.target.value);
            e.target.value = "";
          }}
          style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}
          title="Open a saved diagram"
        >
          <option value="">Open…</option>
          {savedList.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <button onClick={() => saveAs(false)} style={fileBtnStyle}>
          Save
        </button>
        <button onClick={() => saveAs(true)} style={fileBtnStyle}>
          Save As…
        </button>
        <span style={{ color: "#3c4043", fontWeight: 600, marginLeft: 4 }}>
          {diagramName ? `${diagramName}.drawio` : "untitled (unsaved)"}
        </span>
        {fileMsg && (
          <span
            style={{
              color: /^(Saved|Loaded)/.test(fileMsg) ? "#188038" : "#c5221f",
              marginLeft: 8,
            }}
          >
            {fileMsg}
          </span>
        )}
        {saveDir && (
          <span style={{ color: "#9aa0a6", marginLeft: "auto", fontSize: 12 }} title={saveDir}>
            📁 {saveDir}
          </span>
        )}
      </div>

      {showSettings && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            alignItems: "flex-end",
            padding: "14px 16px",
            background: "#f8f9fa",
            borderBottom: "1px solid #e4e6eb",
          }}
        >
          <div>
            <label style={labelStyle}>Provider</label>
            <select
              value={provider}
              onChange={(e) => switchProvider(e.target.value)}
              style={{ ...inputStyle, minWidth: 180 }}
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={labelStyle}>
              API key{" "}
              {meta && (
                <a
                  href={meta.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#1a73e8", fontWeight: 400 }}
                >
                  (get one)
                </a>
              )}
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeys((k) => ({ ...k, [provider]: e.target.value }))}
              placeholder={meta?.apiKeyHint ?? "API key"}
              autoComplete="off"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle}>Base URL (optional override)</label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrls((b) => ({ ...b, [provider]: e.target.value }))}
              placeholder={meta?.defaultBaseUrl ?? ""}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Model</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                style={{ ...inputStyle, minWidth: 220 }}
              >
                {models.length === 0 && <option value="">No models</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                onClick={loadModels}
                disabled={modelsLoading}
                title="Fetch the models available to your API key"
                style={{
                  padding: "8px 14px",
                  fontSize: 14,
                  color: "#3c4043",
                  background: "#fff",
                  border: "1px solid #dadce0",
                  borderRadius: 6,
                  cursor: modelsLoading ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {modelsLoading ? "Loading…" : "Load models"}
              </button>
            </div>
          </div>

          {modelsError && (
            <div style={{ flexBasis: "100%", color: "#c5221f", fontSize: 13 }}>{modelsError}</div>
          )}
          <div style={{ flexBasis: "100%", color: "#80868b", fontSize: 12 }}>
            Keys are stored in your browser&apos;s localStorage and sent only to your own backend.
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 16px",
            background: "#fce8e6",
            color: "#c5221f",
            fontSize: 13,
            borderBottom: "1px solid #f5c6c4",
          }}
        >
          {error}
        </div>
      )}

      {editorTimedOut && !editorReady && (
        <div
          style={{
            padding: "8px 16px",
            background: "#fef7e0",
            color: "#7a5c00",
            fontSize: 13,
            borderBottom: "1px solid #f1d98a",
          }}
        >
          The draw.io editor is taking a while to load. It is self-hosted under{" "}
          <code>/drawio</code> on this server — if it never appears, the editor assets may be
          missing (run <code>npm run setup:drawio</code>). Generation still works regardless.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {embedBase && (
          <DrawIoEmbed
            ref={drawioRef}
            baseUrl={embedBase}
            xml={EMPTY_DIAGRAM}
            autosave
            urlParameters={{ spin: true, libraries: true }}
            onLoad={() => setEditorReady(true)}
            onAutoSave={(e) => {
              currentXml.current = e.xml;
            }}
            onSave={(e) => {
              currentXml.current = e.xml;
            }}
          />
        )}
      </div>

      <TemplateGallery
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onPick={loadTemplate}
      />
    </div>
  );
}
