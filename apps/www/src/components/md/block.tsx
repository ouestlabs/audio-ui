import type { ReactNode } from "react";
import {
  CodeFrame,
  CodeFrameHeader,
  CodeFrameScroll,
  CopyButton,
} from "@/components/md/code";
import { highlightCode } from "@/lib/highlight-code";
import { cn } from "@/registry/default/lib/utils";

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
  const fillHeight = variant === "fill";
  const showLineNumbers = variant !== "compact";

  const highlightedCode = await highlightCode(code, language, {
    showLineNumbers,
  });

  const defaultCopy = <CopyButton size="icon-sm" value={code} variant="ghost" />;
  const resolvedActions = actions !== undefined ? actions : defaultCopy;

  // When there's no metadata (no path, no title), the copy button floats as an
  // overlay instead of rendering a header bar with border/bg.
  const hasMetadata = Boolean(pathLabel || title);

  return (
    <CodeFrame
      className={cn(hasMetadata && "mx-0 rounded-4xl", !hasMetadata && "relative")}
      fillHeight={fillHeight}
    >
      {hasMetadata ? (
        <CodeFrameHeader
          actions={resolvedActions ?? undefined}
          fillHeight={fillHeight}
          language={language}
          pathLabel={pathLabel}
          title={title}
        />
      ) : (
        resolvedActions && (
          <span className="absolute top-2 right-2 z-10">{resolvedActions}</span>
        )
      )}
      <CodeFrameScroll fillHeight={fillHeight}>
        <div
          className={cn(
            "min-w-0 [&_pre]:m-0 [&_pre]:px-0 [&_pre]:py-3.5",
            fillHeight &&
              "flex min-h-0 flex-1 flex-col [&_pre]:min-h-0 [&_pre]:flex-1 [&_pre]:overflow-x-auto [&_pre]:overflow-y-auto"
          )}
          /* biome-ignore lint/security/noDangerouslySetInnerHtml: shiki HTML is server-trusted */
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </CodeFrameScroll>
    </CodeFrame>
  );
}

export { CodeBlock };
