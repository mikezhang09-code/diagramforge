"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const BASE = "/drawio/templates";

interface TemplateEntry {
  url: string; // e.g. "cloud/aws/aws_1.xml"
  label: string;
  category: string; // top-level folder, e.g. "cloud"
}

function prettify(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen template's raw .drawio/mxfile XML. */
  onPick: (xml: string, label: string) => void;
}

export default function TemplateGallery({ open, onClose, onPick }: Props) {
  const [entries, setEntries] = useState<TemplateEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string>("");
  const [loadingPick, setLoadingPick] = useState(false);

  // Parse the draw.io template index once, the first time the gallery opens.
  useEffect(() => {
    if (!open || entries) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE}/index.xml`);
        if (!res.ok) throw new Error(`index.xml ${res.status}`);
        const text = await res.text();
        const doc = new DOMParser().parseFromString(text, "application/xml");
        const list: TemplateEntry[] = [];
        doc.querySelectorAll("template").forEach((el) => {
          const url = el.getAttribute("url");
          if (!url) return;
          const label =
            el.getAttribute("name") ||
            el.getAttribute("title") ||
            prettify(url.split("/").pop()!.replace(/\.xml$/, ""));
          list.push({ url, label, category: url.split("/")[0] });
        });
        if (cancelled) return;
        setEntries(list);
        setActive(list[0]?.category ?? "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load templates.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, entries]);

  const categories = useMemo(
    () => (entries ? [...new Set(entries.map((e) => e.category))] : []),
    [entries],
  );
  const shown = useMemo(
    () => (entries ? entries.filter((e) => e.category === active) : []),
    [entries, active],
  );

  const pick = useCallback(
    async (e: TemplateEntry) => {
      setLoadingPick(true);
      setError(null);
      try {
        const res = await fetch(`${BASE}/${e.url}`);
        if (!res.ok) throw new Error(`template ${res.status}`);
        const xml = await res.text();
        onPick(xml, e.label);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to open template.");
      } finally {
        setLoadingPick(false);
      }
    },
    [onPick, onClose],
  );

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          width: "min(900px, 92vw)",
          height: "min(640px, 88vh)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #e4e6eb",
          }}
        >
          <strong style={{ fontSize: 15 }}>Templates</strong>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 20,
              cursor: "pointer",
              color: "#5f6368",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{ padding: "8px 16px", color: "#c5221f", fontSize: 13 }}>{error}</div>
        )}
        {!entries && !error && (
          <div style={{ padding: 24, color: "#5f6368", fontSize: 14 }}>Loading templates…</div>
        )}

        {entries && (
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* Category sidebar */}
            <div
              style={{
                width: 160,
                borderRight: "1px solid #e4e6eb",
                overflowY: "auto",
                padding: "8px 0",
                background: "#fafbfc",
              }}
            >
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setActive(c)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 16px",
                    fontSize: 13,
                    border: "none",
                    cursor: "pointer",
                    background: c === active ? "#e8f0fe" : "transparent",
                    color: c === active ? "#1a73e8" : "#3c4043",
                    fontWeight: c === active ? 600 : 400,
                  }}
                >
                  {prettify(c)}
                </button>
              ))}
            </div>

            {/* Thumbnail grid */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 14,
                alignContent: "start",
                opacity: loadingPick ? 0.6 : 1,
              }}
            >
              {shown.map((e) => (
                <button
                  key={e.url}
                  onClick={() => pick(e)}
                  disabled={loadingPick}
                  title={e.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 8,
                    border: "1px solid #dadce0",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: loadingPick ? "default" : "pointer",
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      height: 96,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#f8f9fa",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${BASE}/${e.url.replace(/\.xml$/, ".png")}`}
                      alt={e.label}
                      style={{ maxWidth: "100%", maxHeight: 96, objectFit: "contain" }}
                      onError={(ev) => {
                        (ev.currentTarget as HTMLImageElement).style.visibility = "hidden";
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#3c4043",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {e.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
