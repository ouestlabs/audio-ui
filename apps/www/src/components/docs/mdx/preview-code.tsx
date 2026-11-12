"use client";

import { type ReactNode, useCallback, useState } from "react";
import { FrameContent } from "@/components/site/layout/frame";
import { Button } from "@/components/ui/button";

/**
 * The code of a preview, right under it: a few lines until the reader asks
 * for it with View Code, as a registry component's preview does.
 */
export function PreviewCode({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  return (
    <FrameContent
      className="mt-0.5 bg-site-code [&_pre]:max-h-72"
      data-slot="code"
    >
      {open ? (
        children
      ) : (
        <div className="relative max-h-36 overflow-hidden">
          {children}
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
              onClick={show}
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
  );
}
