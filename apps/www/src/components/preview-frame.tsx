"use client";

import type * as React from "react";
import { CopyRegistry } from "@/components/copy-registry";
import {
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/custom/frame";
import { ExpandPreview } from "@/components/expand-preview";
import { cn } from "@/lib/utils";

/**
 * What the panel of a block's preview looks like, in the docs and in the
 * catalog alike: a block is the page, so the panel is its frame and it brings
 * none of its own (no border, no corners, no tint over the frame's own
 * background), it is never shorter than a preview, and an editor that
 * takes a screen is capped so the preview is not far taller than the others:
 * it scrolls inside, and opens at full size with the expand button.
 */
export const blockPanelClassName =
  "min-h-72 flex-nowrap items-stretch justify-start p-0 sm:p-0 lg:p-0 sm:**:data-[slot=preview]:max-w-none [&>.cn-audio-panel]:w-full [&>.cn-audio-panel]:flex-1 [&>.cn-audio-panel]:rounded-none [&>.cn-audio-panel]:border-0 [&>.cn-audio-panel]:bg-transparent [&_[data-slot=piano-roll]]:max-h-56";

/** What a preview's panel looks like, on a page and in a card alike. */
const panelClassName =
  "flex min-h-50 min-w-0 flex-1 flex-col flex-wrap items-center justify-center overflow-x-auto p-3 font-sans **:data-[slot=preview]:w-full sm:p-6 sm:**:data-[slot=preview]:max-w-[80%] lg:px-8 lg:py-12";

/**
 * The panel of a preview's frame, the one container of what is shown: the
 * same wherever a preview is, a block or not.
 */
export function PreviewPanel({
  block = false,
  className,
  ...props
}: React.ComponentProps<typeof FrameContent> & { block?: boolean }) {
  return (
    <FrameContent
      className={cn(panelClassName, block && blockPanelClassName, className)}
      {...props}
    />
  );
}

/**
 * The bar of a preview's frame, the same wherever a preview is shown: what it
 * is (a description, or its name), then its actions. It is the footer of a
 * card in the catalog and the header of a preview on a page. `expand` is the
 * live preview to open at full size, for the editors made to take a screen.
 */
export function PreviewBar({
  actions,
  badge,
  description,
  expand,
  hint,
  name,
  position = "footer",
}: {
  /** What comes last: a button to see the code. */
  actions?: React.ReactNode;
  /** Something about the preview that is not for everyone, such as its name in development. */
  badge?: React.ReactNode;
  description?: string;
  expand?: React.ReactNode;
  /** How to use the preview, shown in the footer of the full-size view. */
  hint?: string;
  name: string;
  position?: "footer" | "header";
}) {
  const Bar = position === "header" ? FrameHeader : FrameFooter;
  return (
    <Bar className="flex-row items-center gap-3 px-2 py-1.5">
      <p
        className={cn(
          "flex flex-1 items-center gap-1.5 truncate ps-1 text-site-muted-foreground text-xs",
          !description && "font-mono"
        )}
      >
        <span className="truncate">{description || name}</span>
      </p>
      <div className="flex items-center gap-1.5">
        {badge}
        {expand ? (
          <ExpandPreview hint={hint} label={name}>
            {expand}
          </ExpandPreview>
        ) : null}
        <CopyRegistry value={`@audio/${name}`} />
        {actions}
      </div>
    </Bar>
  );
}
