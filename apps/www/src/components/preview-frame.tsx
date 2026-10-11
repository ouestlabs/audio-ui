"use client";

import type * as React from "react";
import { CopyRegistry } from "@/components/copy-registry";
import { FrameFooter, FrameHeader } from "@/components/custom/frame";
import { ExpandPreview } from "@/components/expand-preview";
import { cn } from "@/lib/utils";

/**
 * What the panel of a block's preview looks like, in the docs and in the
 * catalog alike: a block is the page, so the panel is its frame and it brings
 * none of its own, and it is never shorter than a preview.
 */
export const blockPanelClassName =
  "min-h-72 flex-nowrap items-stretch justify-start p-0 sm:p-0 lg:p-0 sm:**:data-[slot=preview]:max-w-none [&>.cn-audio-panel]:w-full [&>.cn-audio-panel]:flex-1 [&>.cn-audio-panel]:rounded-none [&>.cn-audio-panel]:border-0";

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
  name,
  position = "footer",
}: {
  /** What comes last: a button to see the code. */
  actions?: React.ReactNode;
  /** Something about the preview that is not for everyone, such as its name in development. */
  badge?: React.ReactNode;
  description?: string;
  expand?: React.ReactNode;
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
        {expand ? <ExpandPreview label={name}>{expand}</ExpandPreview> : null}
        <CopyRegistry value={`@audio/${name}`} />
        {actions}
      </div>
    </Bar>
  );
}
