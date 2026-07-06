"use client";

import { useTheme } from "next-themes";
import { use, useEffect, useId, useMemo, useState } from "react";

function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }
  return <MermaidContent chart={chart} />;
}

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;

function getMermaidPromise() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid");
  }
  return mermaidPromise;
}

const renderCache = new Map<
  string,
  Promise<{ svg: string; bindFunctions?: (element: Element) => void }>
>();

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();

  const { default: mermaid } = use(getMermaidPromise());

  useMemo(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      fontFamily: "inherit",
      themeCSS: "margin: 1.5rem auto 0;",
      theme: resolvedTheme === "dark" ? "dark" : "default",
    });
  }, [mermaid, resolvedTheme]);

  const renderPromise = useMemo(() => {
    const cacheKey = `${chart}-${resolvedTheme}`;
    const cached = renderCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = mermaid.render(id, chart.replaceAll("\\n", "\n"));
    renderCache.set(cacheKey, promise);
    return promise;
  }, [chart, resolvedTheme, id, mermaid]);

  const { svg, bindFunctions } = use(renderPromise);

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: <!-- Mermaid renders SVG content -->
      dangerouslySetInnerHTML={{ __html: svg }}
      ref={(container) => {
        if (container) {
          bindFunctions?.(container);
        }
      }}
    />
  );
}

export { Mermaid };
