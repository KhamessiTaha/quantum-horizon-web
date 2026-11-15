import { useEffect, useState } from "react";
import type { FramesResponse } from "../../lib/api.ts";
import { download } from "../../lib/exportData.ts";

type Copied = "link" | "embed" | null;

export default function ShareButtons({ frames = null }: { frames?: FramesResponse | null }) {
  const [copied, setCopied] = useState<Copied>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy(kind: Exclude<Copied, null>) {
    const url = new URL(window.location.href);
    url.searchParams.delete("embed");
    const link = url.toString();
    url.searchParams.set("embed", "1");
    const text =
      kind === "link"
        ? link
        : `<iframe src="${url.toString()}" width="760" height="640" style="border:0" title="Quantum Horizon view" loading="lazy"></iframe>`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      <button type="button" className="btn" onClick={() => copy("link")}>
        {copied === "link" ? "Link copied" : "Copy link"}
      </button>
      <button type="button" className="btn" onClick={() => copy("embed")}>
        {copied === "embed" ? "Embed code copied" : "Embed"}
      </button>
      <button
        type="button"
        className="btn"
        disabled={!frames}
        onClick={() => frames && download(frames, "csv")}
        title="The measurement per pass, with a citation line"
      >
        Data CSV
      </button>
      <button
        type="button"
        className="btn"
        disabled={!frames}
        onClick={() => frames && download(frames, "json")}
        title="The whole view: measurements, every frame used, flags and notes"
      >
        JSON
      </button>
      <span className="visually-hidden" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </div>
  );
}
