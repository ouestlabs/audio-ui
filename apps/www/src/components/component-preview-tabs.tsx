"use client";

import * as React from "react";
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
  source,
  sourcePreview,
  ...props
}: React.ComponentProps<"div"> & {
  previewClassName?: string;
  align?: "center" | "start" | "end";
  hideCode?: boolean;
  chromeLessOnMobile?: boolean;
  component: React.ReactNode;
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
    <div
      className={cn(
        "group site-rounded-xl relative mt-4 mb-12 flex flex-col gap-2 overflow-hidden border border-site-border",
        className
      )}
      data-slot="component-preview"
      {...props}
    >
      <div data-slot="preview">
        <div
          className={cn(
            "preview flex h-72 w-full justify-center p-10 font-sans data-[chromeless=true]:h-auto data-[align=start]:items-start data-[align=end]:items-end data-[align=center]:items-center data-[chromeless=true]:p-0",
            previewClassName
          )}
          data-align={align}
          data-chromeless={chromeLessOnMobile}
          ref={previewRef}
        >
          {hasBeenVisible ? (
            component
          ) : (
            <Spinner className="text-site-muted-foreground/40" />
          )}
        </div>
        {!hideCode && (
          <div
            className="**:data-rehype-pretty-code-figure:site-rounded-none relative overflow-hidden **:data-rehype-pretty-code-figure:m-0! **:data-rehype-pretty-code-figure:border-t [&_pre]:max-h-72"
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
          </div>
        )}
      </div>
    </div>
  );
}
