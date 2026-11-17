import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import * as React from "react";
import { CopyButton } from "@/components/code/copy/copy-button";
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

const EXTENSION = /\.([a-z]+)$/;

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
  source: (onCode: (code: string, path?: string) => void) => React.ReactNode;
}) {
  const previewRef = React.useRef<HTMLDivElement>(null);
  const [file, setFile] = React.useState<{ code?: string; path?: string }>({});
  const onCode = React.useCallback(
    (content: string, path?: string) => setFile({ code: content, path }),
    []
  );
  const { code } = file;
  // The file as the registry names it (`knob-demo.ts`), the item's name until it is read.
  const fileName = file.path?.split("/").at(-1) ?? `${name}.tsx`;

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
          <Collapsible
            render={
              <FrameContent
                className="mt-0.5 bg-site-code [&_pre]:max-h-96 [&_pre]:scroll-fade-y"
                data-slot="code"
              />
            }
          >
            <div className="flex items-center pr-1.5">
              <CollapsibleTrigger className="flex h-11 min-w-0 flex-1 items-center gap-2 px-3 text-site-muted-foreground outline-none transition-colors hover:text-site-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&[data-panel-open]>svg:last-child]:rotate-180">
                {getIconForLanguageExtension(
                  EXTENSION.exec(fileName)?.[1] ?? "",
                  { className: "size-3.5 shrink-0" }
                )}
                <span className="truncate font-mono text-xs">{fileName}</span>
                <CaretDownIcon
                  aria-hidden="true"
                  className="ml-auto size-4 shrink-0 transition-transform motion-reduce:transition-none"
                />
              </CollapsibleTrigger>
              {code ? (
                <CopyButton
                  className="static shrink-0 bg-transparent"
                  event="copy_component_code"
                  properties={{ name }}
                  value={code}
                />
              ) : null}
            </div>
            {/* Kept mounted once the preview is near, so the code is there to copy before it opens. */}
            <CollapsibleContent
              className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none"
              keepMounted
            >
              {hasBeenVisible ? source(onCode) : null}
            </CollapsibleContent>
          </Collapsible>
        )}
      </Frame>
    </AudioSessionProvider>
  );
}
