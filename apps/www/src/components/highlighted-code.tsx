import {
  type HighlightRenderNode,
  renderTokens,
} from "@tanstack/highlight/core";
import type * as React from "react";
import { highlighter } from "@/lib/highlighter";

/** Renders the highlighter's nodes as elements, each keyed by where its text starts in the code. */
function renderNodes(
  nodes: readonly HighlightRenderNode[],
  start: number
): { elements: React.ReactNode[]; end: number } {
  const elements: React.ReactNode[] = [];
  let offset = start;
  for (const node of nodes) {
    if (node.type === "text") {
      elements.push(node.value);
      offset += node.value.length;
      continue;
    }
    const children = renderNodes(node.children, offset);
    const data = Object.fromEntries(
      Object.entries(node.data ?? {}).map(([name, value]) => [
        `data-${name}`,
        value,
      ])
    );
    elements.push(
      <span className={node.classNames.join(" ")} key={offset} {...data}>
        {children.elements}
      </span>
    );
    offset = children.end;
  }
  return { elements, end: offset };
}

/**
 * Code highlighted as elements, line numbers included: the same markup the
 * highlighter writes as HTML, without injecting HTML. Colors come from the
 * `th-*` classes (see `styles/highlight.css`).
 */
export function HighlightedCode({
  code,
  language = "tsx",
}: {
  code: string;
  language?: string;
}) {
  const lang = highlighter.normalizeLanguage(language);
  const { tokens } = highlighter.tokenize(code, { lang });
  const { elements } = renderNodes(
    renderTokens(tokens, { lineNumbers: true }),
    0
  );
  return (
    <pre
      className={`th-code th-code--${lang} th-code--line-numbers`}
      data-language={lang}
    >
      <code>{elements}</code>
    </pre>
  );
}
