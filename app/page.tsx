"use client";

import { useCallback, useRef, useState } from "react";
import { DrawIoEmbed, DrawIoEmbedRef } from "react-drawio";

const EMPTY_DIAGRAM =
  '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" ' +
  'connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" ' +
  'math="0" shadow="0"><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel>';

export default function Home() {
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the latest diagram XML from the editor so follow-up prompts can edit it.
  const currentXml = useRef<string>(EMPTY_DIAGRAM);

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, currentXml: currentXml.current }),
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
  }, [prompt, loading]);

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
        <strong style={{ fontSize: 15, whiteSpace: "nowrap" }}>draw.io AI Editor</strong>
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") generate();
          }}
          placeholder="Describe a diagram — e.g. 'a CI/CD pipeline from commit to deploy'"
          style={{
            flex: 1,
            padding: "8px 12px",
            fontSize: 14,
            border: "1px solid #cdd0d5",
            borderRadius: 6,
            outline: "none",
          }}
        />
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

      <div style={{ flex: 1, minHeight: 0 }}>
        <DrawIoEmbed
          ref={drawioRef}
          xml={EMPTY_DIAGRAM}
          urlParameters={{ spin: true, libraries: true }}
          onAutoSave={(e) => {
            currentXml.current = e.xml;
          }}
          onSave={(e) => {
            currentXml.current = e.xml;
          }}
        />
      </div>
    </div>
  );
}
