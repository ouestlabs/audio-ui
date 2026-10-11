"use client";

import { ArrowsOutSimpleIcon, XIcon } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A button that opens `children`, a live preview, in a dialog that takes most
 * of the screen, for judging a block at the size it is meant to be used at.
 * What it holds mounts only while it is open.
 */
export function ExpandPreview({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  /** Names the preview for assistive technology, such as the block's name. */
  label: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            aria-label={`Expand ${label}`}
            className={cn("shrink-0", className)}
            size="icon"
            variant="outline"
          >
            <ArrowsOutSimpleIcon aria-hidden="true" />
          </Button>
        }
      />
      <DialogContent
        className="top-3 left-3 h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">
          The preview at full size.
        </DialogDescription>
        {/* In the corner, above the block, which leaves it room. */}
        <DialogClose
          render={
            <Button
              aria-label="Close"
              className="absolute end-2 top-2 z-50 size-7 bg-background/80 text-muted-foreground backdrop-blur-sm hover:text-foreground"
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <XIcon aria-hidden="true" className="size-4" />
        </DialogClose>
        {/* The block is the page: the whole dialog, inset from the screen, a panel without a frame, and what has a height of its own gives it back to the editor. */}
        <div
          className="h-full overflow-hidden font-sans [&>.cn-audio-panel]:h-full [&>.cn-audio-panel]:overflow-auto [&>.cn-audio-panel]:pt-11 [&>.cn-audio-panel]:rounded-none [&>.cn-audio-panel]:border-0 [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1 [&_[data-slot=timeline]]:flex [&_[data-slot=timeline]]:min-h-0 [&_[data-slot=timeline]]:flex-1 [&_[data-slot=timeline]]:flex-col"
          data-expanded-preview
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
