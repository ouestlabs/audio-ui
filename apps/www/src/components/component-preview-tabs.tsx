"use client";

import * as React from "react";
import { Frame, FrameContent } from "@/components/custom/frame";
import { blockPanelClassName, PreviewBar } from "@/components/preview-frame";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";

export function ComponentPreviewTabs({
  className,
  previewClassName,
  align = "center",
  hideCode = false,
  chromeLessOnMobile = false,
  component,
  expand = false,
  fitContent = false,
  name,
  source,
  sourcePreview,
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
  /** The registry name of what is shown. */
  name: string;
  source: React.ReactNode;
  sourcePreview?: React.ReactNode;
}) {
  const [isCodeExpanded, setIsCodeExpanded] = React.useState(false);
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

  return (
    <Frame
      className={cn("group mt-4 mb-12", className)}
      data-slot="component-preview"
      {...props}
    >
      <PreviewBar
        expand={expand ? component : undefined}
        name={name}
        position="header"
      />
      {/* The panel is the preview: no container inside it. */}
      <FrameContent
        className={cn(
          "preview flex h-72 w-full justify-center p-10 font-sans data-[chromeless=true]:h-auto data-[align=start]:items-start data-[align=end]:items-end data-[align=center]:items-center data-[chromeless=true]:p-0",
          // A block is the page: as tall as it is, and the same panel in the catalog.
          fitContent && cn("h-auto", blockPanelClassName),
          previewClassName
        )}
        data-align={align}
        data-chromeless={chromeLessOnMobile}
        data-slot="preview"
        ref={previewRef}
      >
        {hasBeenVisible ? (
          component
        ) : (
          <Spinner className="text-site-muted-foreground/40" />
        )}
      </FrameContent>
      {hideCode ? null : (
        <FrameContent
          className="**:data-rehype-pretty-code-figure:site-rounded-none mt-0.5 **:data-rehype-pretty-code-figure:m-0! [&_pre]:max-h-72"
          data-mobile-code-visible={isCodeExpanded}
          data-slot="code"
        >
          {isCodeExpanded ? (
            source
          ) : (
            <div className="relative">
              {sourcePreview}
              <div className="absolute inset-0 flex items-center justify-center pb-4">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, var(--color-site-code), color-mix(in oklab, var(--color-site-code) 60%, transparent), transparent)",
                  }}
                />
                <Button
                  className="relative z-10 bg-site-background text-site-foreground hover:bg-site-muted dark:bg-site-background dark:text-site-foreground dark:hover:bg-site-muted"
                  onClick={() => {
                    setIsCodeExpanded(true);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  View Code
                </Button>
              </div>
            </div>
          )}
        </FrameContent>
      )}
    </Frame>
  );
}
