"use client";

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
import { Frame, FrameContent } from "@/components/site/layout/frame";
import { Button } from "@/components/ui/button";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";

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
  /** How to use what is shown: said in the footer of the full-size view. */
  hint?: string;
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

  const hosted = usePreviewHost(expand);
  const expandCode = React.useCallback(() => setIsCodeExpanded(true), []);
  const shown = expand ? (
    <HostedPreview host={hosted.host} open={hosted.open}>
      {component}
    </HostedPreview>
  ) : (
    component
  );

  return (
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
      {hideCode ? null : (
        <FrameContent
          className="mt-0.5 bg-site-code [&_pre]:max-h-72"
          data-mobile-code-visible={isCodeExpanded}
          data-slot="code"
        >
          {isCodeExpanded ? (
            source
          ) : (
            <div className="relative">
              {sourcePreview}
              <div className="absolute inset-0 flex items-end justify-center pb-3">
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, var(--color-site-code), color-mix(in oklab, var(--color-site-code) 60%, transparent), transparent)",
                  }}
                />
                <Button
                  className="relative z-10 bg-site-background text-site-foreground hover:bg-site-muted dark:bg-site-background dark:text-site-foreground dark:hover:bg-site-muted"
                  onClick={expandCode}
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
