"use client";

import { ArrowsOutSimpleIcon, XIcon } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { CopyRegistry } from "@/components/copy-registry";
import { Frame, FrameContent, FrameHeader } from "@/components/custom/frame";
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
        className="top-3 left-3 h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-[16px] bg-site-background p-0 ring-0 sm:max-w-none"
        showCloseButton={false}
      >
        {/* The same frame as a card: a header with the name and what to do with it, and the panel. */}
        <Frame className="size-full rounded-[16px]">
          <FrameHeader className="shrink-0 flex-row items-center justify-between gap-3 px-2 py-1.5">
            <DialogTitle className="truncate ps-1 font-mono font-normal text-site-muted-foreground text-xs">
              {label}
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <CopyRegistry value={`@audio/${label}`} />
              <DialogClose
                render={
                  <Button aria-label="Close" size="icon" variant="outline" />
                }
              >
                <XIcon aria-hidden="true" />
              </DialogClose>
            </div>
          </FrameHeader>
          <DialogDescription className="sr-only">
            The preview at full size.
          </DialogDescription>
          {/* The block is the page: it fills the panel, which is its only container, and what has a height of its own gives it back to the editor. */}
          <FrameContent
            className="min-h-0 flex-1 font-sans [&>div:not(.cn-audio-panel)]:h-full [&>div:not(.cn-audio-panel)]:p-6 [&_[data-slot=plot]]:h-auto [&_[data-slot=plot]]:min-h-0 [&_[data-slot=plot]]:flex-1 [&>.cn-audio-panel]:h-full [&>.cn-audio-panel]:overflow-auto [&>.cn-audio-panel]:rounded-none [&>.cn-audio-panel]:border-0 [&>.cn-audio-panel]:bg-transparent [&_[data-slot=piano-roll]]:h-auto [&_[data-slot=piano-roll]]:min-h-0 [&_[data-slot=piano-roll]]:flex-1 [&_[data-slot=timeline]]:flex [&_[data-slot=timeline]]:min-h-0 [&_[data-slot=timeline]]:flex-1 [&_[data-slot=timeline]]:flex-col"
            data-expanded-preview
          >
            {children}
          </FrameContent>
        </Frame>
      </DialogContent>
    </Dialog>
  );
}
