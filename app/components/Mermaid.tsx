"use client";

import { useEffect, useMemo, useState } from "react";
import mermaid from "mermaid";

let mermaidInitialized = false;

export default function Mermaid({
  chart,
  className,
}: {
  chart: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stable render id per mount
  const renderId = useMemo(
    () => `mermaid-${Math.random().toString(36).slice(2)}`,
    []
  );

  useEffect(() => {
    let cancelled = false;

    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "strict",
      });
      mermaidInitialized = true;
    }

    setSvg(null);
    setError(null);

    (async () => {
      try {
        const result = await mermaid.render(renderId, chart);
        if (cancelled) return;
        setSvg(result.svg);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [renderId, chart]);

  if (error) {
    return (
      <div className={className}>
        <div className="text-xs text-red-300 font-mono mb-2">
          Mermaid render error: {error}
        </div>
        <pre className="text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className={className}>
        <div className="text-xs text-zinc-500 font-mono">Rendering diagram…</div>
      </div>
    );
  }

  return (
    <div
      className={className}
      // Mermaid returns SVG markup.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}



