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
        <div className="flex h-10 shrink-0 items-center justify-between border-b ps-4 pe-2">
          <DialogTitle className="font-mono text-muted-foreground text-xs">
            {label}
          </DialogTitle>
          <DialogClose
            render={
              <Button aria-label="Close" size="icon-sm" variant="ghost" />
            }
          >
            <XIcon aria-hidden="true" />
          </DialogClose>
        </div>
        <DialogDescription className="sr-only">
          The preview at full size.
        </DialogDescription>
        {/* The block takes the whole of what is left, as if it were the page: a panel fills it, and what has a height of its own gives it back to the editor. */}
        <div
          className="h-[calc(100dvh-2.5rem)] overflow-auto font-sans [&>.cn-audio-panel]:min-h-full [&>.cn-audio-panel]:rounded-none [&>.cn-audio-panel]:border-0 [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1 [&_[data-slot=timeline]]:flex [&_[data-slot=timeline]]:min-h-0 [&_[data-slot=timeline]]:flex-1 [&_[data-slot=timeline]]:flex-col"
          data-expanded-preview
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
