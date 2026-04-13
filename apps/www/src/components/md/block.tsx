import type { ReactNode } from "react";
import {
  CodeFrame,
  CodeFrameHeader,
  CodeFrameScroll,
  CopyCode,
} from "@/components/md/code";
import { highlightCode } from "@/lib/highlight-code";
import { cn } from "@/registry/default/lib/utils";

async function CodeBlock({
  code,
  language,
  title,
  copyButton = true,
  showLineNumbers = true,
  fillHeight = false,
  pathLabel,
  headerActions,
}: {
  code: string;
  language: string;
  title?: string | undefined;
  copyButton?: boolean;
  showLineNumbers?: boolean;
  /** Stretch to fill a flex parent (e.g. drawer panel); scroll happens inside the pre. */
  fillHeight?: boolean;
  pathLabel?: string;
  /** Right side of the caption row (e.g. copy + v0 in a ButtonGroup). */
  headerActions?: ReactNode;
}) {
  const highlightedCode = await highlightCode(code, language, {
    showLineNumbers,
  });

  const panelHeader = Boolean(pathLabel ?? headerActions ?? title);
  const resolvedHeaderActions = (
    <span className="flex items-center gap-1">
      {headerActions}
      {!headerActions && copyButton ? (
        <CopyCode size="icon-sm" value={code} variant="ghost" />
      ) : null}
    </span>
  );

  return (
    <CodeFrame
      className={cn(panelHeader && "mx-0 rounded-4xl")}
      fillHeight={fillHeight}
    >
      <CodeFrameHeader
        actions={resolvedHeaderActions}
        fillHeight={fillHeight}
        language={language}
        pathLabel={pathLabel}
        title={title}
      />
      <CodeFrameScroll fillHeight={fillHeight}>
        <div
          className={cn(
            "min-w-0 [&_pre]:m-0 [&_pre]:p-0",
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
