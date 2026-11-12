import { CaretRightIcon, CheckIcon, CopyIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { getIconForLanguageExtension } from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";

/**
 * One file of an example: its name as a row that opens and closes its code,
 * with the button that copies it on the same row, for an example made of
 * several files to read and copy one at a time.
 */
export function CodeFile({
  children,
  open: initiallyOpen = false,
  title,
}: {
  children: ReactNode;
  /** Whether the file is open at first. */
  open?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const code = useRef<HTMLDivElement>(null);
  const language = title.split(".").at(-1) ?? "";
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const toggle = useCallback(() => setOpen((value) => !value), []);
  // The code is in the page even while the file is closed, so a closed file copies too.
  const copy = useCallback(() => {
    copyToClipboard(code.current?.querySelector("pre code")?.textContent ?? "");
  }, [copyToClipboard]);
  return (
    <div className="border-site-border border-b last:border-b-0">
      <div className="flex items-center gap-1 pr-2">
        <button
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 px-4 py-2.5 text-left font-mono text-site-muted-foreground text-xs hover:text-site-foreground"
          onClick={toggle}
          type="button"
        >
          <CaretRightIcon
            aria-hidden
            className={cn("size-3 transition-transform", open && "rotate-90")}
          />
          {getIconForLanguageExtension(language, {
            className: "size-4 shrink-0",
          })}
          {title}
        </button>
        <Button
          aria-label={`Copy ${title}`}
          className="size-7 text-site-muted-foreground"
          onClick={copy}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isCopied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
        </Button>
      </div>
      {/* The copy button of the code block itself is this row's. */}
      <div
        className="[&_figure]:my-0 [&_figure_button]:hidden"
        hidden={!open}
        ref={code}
      >
        {children}
      </div>
    </div>
  );
}
