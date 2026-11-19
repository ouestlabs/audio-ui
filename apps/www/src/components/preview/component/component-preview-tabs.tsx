import * as React from "react";
import { FilePanel } from "@/components/code/source/file-panel";
import {
  PreviewBar,
  PreviewLoading,
  PreviewPanel,
} from "@/components/preview/frame/preview-frame";
import {
  HostedPreview,
  usePreviewHost,
} from "@/components/preview/frame/preview-host";
import { Frame } from "@/components/site/layout/frame";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { getRegistryItemMetadata } from "@/lib/registry/core/registry";
import { cn } from "@/lib/utils";
import { AudioSessionProvider } from "@/registry/bases/shared/hooks/input/use-audio-session";

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
  /** The code, given where to report it once loaded: the panel's copy button copies it, open or closed. */
  source: (onCode: (code: string) => void) => React.ReactNode;
}) {
  const previewRef = React.useRef<HTMLDivElement>(null);
  // The file as the registry names it (`knob-demo.js`), known before anything loads: the bar never changes once drawn.
  const fileName =
    getRegistryItemMetadata(name)?.files?.[0]?.path?.split("/").at(-1) ?? name;

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
        {/* The code is the frame's second panel, folded as an accordion's item: closed, its bar still names the file and copies it. */}
        {hideCode ? null : (
          <FilePanel
            className="mt-0.5"
            name={name}
            path={fileName}
            source={source}
          />
        )}
      </Frame>
    </AudioSessionProvider>
  );
}
