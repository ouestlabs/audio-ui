import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import {
  PreviewBar,
  PreviewLoading,
  PreviewPanel,
} from "@/components/preview/frame/preview-frame";
import {
  HostedPreview,
  usePreviewHost,
} from "@/components/preview/frame/preview-host";
import { getIconForLanguageExtension } from "@/components/site/icons";
import { Frame, FrameContent } from "@/components/site/layout/frame";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";
import { AudioSessionProvider } from "@/registry-audio/bases/base/hooks/use-audio-session";

export function ComponentPreviewTabs({
  className,
  previewClassName,
  align: _align,
  hideCode = false,
  chromeLessOnMobile: _chromeLessOnMobile,
  component,
  expand = false,
  hint,
  fitContent = false,
  name,
  source,
  ...props
}: Omit<React.ComponentProps<"div">, "ref"> & {
  previewClassName?: string;
  align?: "center" | "start" | "end";
  hideCode?: boolean;
  chromeLessOnMobile?: boolean;
  component: React.ReactNode;
  /** Adds a button that opens the preview at full size: for the editors made to take a screen. */
  expand?: boolean;
  /** Lets the preview be as tall as what it shows, rather than a fixed height: for blocks. */
  fitContent?: boolean;
  /** How to use what is shown: said in the footer of the full-size view. */
  hint?: string;
  /** The registry name of what is shown. */
  name: string;
  source: React.ReactNode;
}) {
  const previewRef = React.useRef<HTMLDivElement>(null);

  // Docs pages can mount a dozen+ live previews on one page (real audio
  // elements, pointer listeners, etc.). Defer mounting each one until it's
  // near the viewport, same pattern as the components catalog grid
  // (component-card-container.tsx), to keep docs pages from feeling laggy.
  const hasBeenVisible = useIntersectionObserver(previewRef, {
    freezeOnceVisible: true,
    rootMargin: "800px",
    threshold: 0,
  });

  const hosted = usePreviewHost(expand);
  const shown = expand ? (
    <HostedPreview host={hosted.host} open={hosted.open}>
      {component}
    </HostedPreview>
  ) : (
    component
  );

  return (
    <AudioSessionProvider>
      <Frame
        className={cn("group mt-4 mb-12", className)}
        data-slot="component-preview"
        {...props}
      >
        <PreviewBar expand={hosted} hint={hint} name={name} position="header" />
        {/* The panel is the preview: no container inside it. */}
        <PreviewPanel
          block={fitContent}
          className={previewClassName}
          data-slot="preview"
          ref={previewRef}
        >
          {hasBeenVisible ? shown : <PreviewLoading />}
        </PreviewPanel>
        {/* The code folds under the preview, as an accordion's item: closed until the reader opens it. */}
        {hideCode ? null : (
          <Collapsible>
            <CollapsibleTrigger className="flex h-9 w-full items-center justify-between rounded-(--frame-radius-inner) px-3 font-medium text-site-muted-foreground text-sm outline-none transition-colors hover:text-site-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&[data-panel-open]>svg]:rotate-180">
              {/* Named as a file, as each item of a stack of files would be. */}
              <span className="flex items-center gap-2 font-mono text-xs">
                {getIconForLanguageExtension("tsx", {
                  className: "size-3.5 shrink-0",
                })}
                {name}.tsx
              </span>
              <CaretDownIcon
                aria-hidden="true"
                className="size-4 transition-transform motion-reduce:transition-none"
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
              <FrameContent
                className="bg-site-code [&_pre]:max-h-96"
                data-slot="code"
              >
                {source}
              </FrameContent>
            </CollapsibleContent>
          </Collapsible>
        )}
      </Frame>
    </AudioSessionProvider>
  );
}
