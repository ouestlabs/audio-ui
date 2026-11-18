import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { CopyButton } from "@/components/code/copy/copy-button";
import { getIconForLanguageExtension } from "@/components/site/icons";
import { FrameContent } from "@/components/site/layout/frame";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";

const EXTENSION = /\.([a-z]+)$/;

/**
 * One file in a frame, folded as an accordion's item: its bar names it (its
 * language's logo, its folder dimmed) and copies it, open or closed; its code
 * opens under the bar. The code is read once the panel nears the screen, so it
 * is there to copy before it opens.
 */
export function FilePanel({
  className,
  name,
  onCode,
  path,
  source,
}: {
  className?: string;
  /** The registry item the file is read from, for the copy's event. */
  name: string;
  /** Called with the code once it is loaded: for what holds several files, such as a stack's download. */
  onCode?: (code: string) => void;
  /** Where the file lands (`components/audio-ui/knob/knob.ts`), or its name. */
  path: string;
  /** The code, given where to report it once loaded. */
  source: (onCode: (code: string) => void) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [code, setOwnCode] = useState<string>();
  const setCode = useCallback(
    (loaded: string) => {
      setOwnCode(loaded);
      onCode?.(loaded);
    },
    [onCode]
  );
  const near = useIntersectionObserver(ref, {
    freezeOnceVisible: true,
    rootMargin: "800px",
    threshold: 0,
  });
  const parts = path.split("/");
  const base = parts.pop() ?? path;
  const folder = parts.at(-1);
  return (
    <Collapsible
      render={
        <FrameContent
          className={cn(
            "bg-site-code [&_pre]:max-h-96 [&_pre]:scroll-fade-y",
            className
          )}
          data-slot="code"
          ref={ref}
        />
      }
    >
      <div className="flex items-center pr-1.5">
        <CollapsibleTrigger
          className="flex h-11 min-w-0 flex-1 items-center gap-2 px-3 text-site-muted-foreground outline-none transition-colors hover:text-site-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&[data-open]>svg:last-child]:rotate-180"
          title={path}
        >
          {getIconForLanguageExtension(EXTENSION.exec(base)?.[1] ?? "", {
            className: "size-3.5 shrink-0",
          })}
          <span className="truncate font-mono text-xs">
            {folder ? (
              <span className="text-site-muted-foreground/70">{folder}/</span>
            ) : null}
            <span className="text-site-foreground">{base}</span>
          </span>
          <CaretDownIcon
            aria-hidden="true"
            className="ml-auto size-4 shrink-0 transition-transform motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        {code ? (
          <CopyButton
            className="static shrink-0 bg-transparent"
            event="copy_component_code"
            properties={{ name, path }}
            value={code}
          />
        ) : null}
      </div>
      <CollapsibleContent className="overflow-hidden" keepMounted>
        {near ? source(setCode) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}
