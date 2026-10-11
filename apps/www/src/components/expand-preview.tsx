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
        className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">
          The preview at full size.
        </DialogDescription>
        {/* Out of the way, in the corner the block pads for itself. */}
        <DialogClose
          render={
            <Button
              aria-label="Close"
              className="absolute end-0 top-0 z-50 size-5 rounded-none rounded-es-md bg-background/80 text-muted-foreground backdrop-blur-sm hover:text-foreground"
              size="icon-xs"
              variant="ghost"
            />
          }
        >
          <XIcon aria-hidden="true" className="size-3" />
        </DialogClose>
        {/* The block is the page: the whole viewport, a panel without a frame, and what has a height of its own gives it back to the editor. */}
        <div
          className="h-dvh overflow-hidden font-sans [&>.cn-audio-panel]:h-full [&>.cn-audio-panel]:overflow-auto [&>.cn-audio-panel]:rounded-none [&>.cn-audio-panel]:border-0 [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1 [&_[data-slot=timeline]]:flex [&_[data-slot=timeline]]:min-h-0 [&_[data-slot=timeline]]:flex-1 [&_[data-slot=timeline]]:flex-col"
          data-expanded-preview
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
