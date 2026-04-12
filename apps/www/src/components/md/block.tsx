import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { highlightCode } from "@/lib/highlight-code";
import { getIconForLanguageExtension } from "@/lib/icons";
import { cn } from "@/registry/default/lib/utils";
import { ScrollArea } from "@/registry/default/ui/scroll-area";

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

  const panelHeader = Boolean(pathLabel ?? headerActions);
  const showFloatingCopy = copyButton && !headerActions;

  let caption: ReactNode = null;
  if (panelHeader) {
    caption = (
      <figcaption
        className={cn(
          "flex shrink-0 items-center justify-between gap-2 border-border/60 border-b px-3 py-2 font-medium text-muted-foreground text-xs [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-foreground/70",
          fillHeight && "shrink-0"
        )}
        data-language={language}
        data-rehype-pretty-code-title=""
      >
        <span className="flex min-w-0 flex-1 items-center justify-start gap-2 text-left">
          {getIconForLanguageExtension(language)}
          {pathLabel ? (
            <span className="truncate font-mono text-[0.8125rem] text-code-foreground">
              {pathLabel}
            </span>
          ) : null}
        </span>
        {headerActions ? (
          <span className="flex shrink-0 items-center">{headerActions}</span>
        ) : null}
      </figcaption>
    );
  } else if (title) {
    caption = (
      <figcaption
        className={cn(
          "flex items-center gap-2 text-code-foreground [&_svg]:size-5 [&_svg]:text-code-foreground sm:[&_svg]:size-4",
          fillHeight && "shrink-0"
        )}
        data-language={language}
        data-rehype-pretty-code-title
      >
        {getIconForLanguageExtension(language)}
        {title}
      </figcaption>
    );
  }

  return (
    <figure
      className={cn(
        panelHeader && "mx-0 rounded-4xl",
        fillHeight && "flex min-h-0 flex-1 flex-col overflow-hidden"
      )}
      data-rehype-pretty-code-figure
    >
      {caption}
      {showFloatingCopy ? <CopyButton value={code} /> : null}
      <ScrollArea
        className={cn(
          "w-full bg-code **:data-[slot=scroll-area-viewport]:p-0",
          fillHeight ? "min-h-0 min-w-0 flex-1" : "h-auto"
        )}
      >
        <div
          className={cn(
            "min-w-0 [&_pre]:m-0 [&_pre]:p-0",
            fillHeight &&
              "flex min-h-0 flex-1 flex-col [&_pre]:min-h-0 [&_pre]:flex-1 [&_pre]:overflow-x-auto [&_pre]:overflow-y-auto"
          )}
          /* biome-ignore lint/security/noDangerouslySetInnerHtml: shiki HTML is server-trusted */
          dangerouslySetInnerHTML={{ __html: highlightedCode }}
        />
      </ScrollArea>
    </figure>
  );
}

export { CodeBlock };
