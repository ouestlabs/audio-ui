import type { ReactNode } from "react";
import {
  CodeFrame,
  CodeFrameHeader,
  CodeFrameScroll,
  CopyButton,
} from "@/components/md/code";
import { highlightCode } from "@/lib/highlight-code";

type CodeBlockVariant = "default" | "fill" | "compact";

async function CodeBlock({
  code,
  language,
  title,
  variant = "default",
  pathLabel,
  actions,
}: {
  code: string;
  language: string;
  title?: string;
  /** "default" — standard; "fill" — stretches in flex containers; "compact" — no line numbers */
  variant?: CodeBlockVariant;
  pathLabel?: string;
  /** Custom right-side actions. Pass `null` to suppress the default copy button. */
  actions?: ReactNode;
}) {
  const highlightedCode = await highlightCode(code, language, {
    showLineNumbers: variant !== "compact",
  });

  const hasMetadata = Boolean(pathLabel || title);

  const defaultCopy = (
    <CopyButton
      data-overlay={!hasMetadata || undefined}
      size="icon-sm"
      value={code}
      variant="ghost"
    />
  );
  const resolvedActions = actions !== undefined ? actions : defaultCopy;

  return (
    <CodeFrame
      data-has-metadata={hasMetadata || undefined}
      data-variant={variant !== "default" ? variant : undefined}
    >
      {hasMetadata ? (
        <CodeFrameHeader
          actions={resolvedActions ?? undefined}
          language={language}
          pathLabel={pathLabel}
          title={title}
        />
      ) : (
        resolvedActions
      )}
      <CodeFrameScroll>
        <div
          className="min-w-0 [&_pre]:m-0"
          /* biome-ignore lint/security/noDangerouslySetInnerHtml: shiki HTML is server-trusted */
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </CodeFrameScroll>
    </CodeFrame>
  );
}

export { CodeBlock };
