"use client";

import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/ssr";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
        className="h-[94vh] w-[96vw] max-w-[96vw] overflow-hidden p-0 sm:max-w-[96vw]"
        showCloseButton
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <DialogDescription className="sr-only">
          The preview at full size.
        </DialogDescription>
        <div className="flex size-full items-center justify-center overflow-auto p-8 font-sans">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
