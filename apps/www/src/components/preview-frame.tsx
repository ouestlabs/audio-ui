"use client";

import type * as React from "react";
import { BuiltOn } from "@/components/built-on";
import { CopyRegistry } from "@/components/copy-registry";
import {
  FrameContent,
  FrameFooter,
  FrameHeader,
} from "@/components/custom/frame";
import { ExpandPreview } from "@/components/expand-preview";
import type { PreviewHost } from "@/components/preview-host";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * The inset of every preview's panel, on a page, in a card and at full size:
 * one value, so what is shown sits the same distance from the frame wherever
 * it is. The `p-4` of a block's own panel is that same inset, so a block
 * gives its own up and takes the panel's.
 */
export const PANEL_INSET = "p-4";

/**
 * What a block's panel adds: a block is the page, so the panel is its frame
 * and it brings none of its own (no border, no corners, no tint, no inset),
 * and an editor that takes a screen is capped so the preview is not far
 * taller than the others: it scrolls inside, and opens at full size with the
 * expand button.
 */
export const blockPanelClassName =
  "min-h-60 flex-nowrap items-stretch justify-start sm:**:data-[slot=preview]:max-w-none [&_.cn-audio-panel]:w-full [&_.cn-audio-panel]:flex-1 [&_.cn-audio-panel]:rounded-none [&_.cn-audio-panel]:border-0 [&_.cn-audio-panel]:bg-transparent [&_.cn-audio-panel]:p-0 [&_[data-slot=piano-roll]]:max-h-56";

/** What a preview's panel looks like, on a page and in a card alike. */
const panelClassName = `flex min-w-0 flex-1 flex-col flex-wrap items-center justify-center overflow-x-auto font-sans **:data-[slot=preview]:w-full sm:**:data-[slot=preview]:max-w-[80%] ${PANEL_INSET}`;

/**
 * What a panel shows while its preview is on its way: a spinner in the middle
 * of the room the preview will take, so the frame does not collapse around it
 * and jump when the preview arrives.
 */
export function PreviewLoading() {
  return (
    <div className="flex min-h-40 w-full flex-1 items-center justify-center">
      <Spinner className="size-5 text-site-muted-foreground/40" />
    </div>
  );
}

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
  expand?: PreviewHost;
  /** How to use the preview, shown in the footer of the full-size view. */
  hint?: string;
  name: string;
  position?: "footer" | "header";
}) {
  const Bar = position === "header" ? FrameHeader : FrameFooter;
  return (
    <Bar className="flex-row items-center gap-3 px-2 py-1.5">
      {/* What it is, when it has a description; else the library it is built on. */}
      <p className="flex flex-1 items-center gap-1.5 truncate ps-1 text-site-muted-foreground text-xs">
        {description ? (
          <span className="truncate">{description}</span>
        ) : (
          <BuiltOn />
        )}
      </p>
      <div className="flex items-center gap-1.5">
        {badge}
        {expand?.host ? (
          <ExpandPreview hint={hint} label={name} preview={expand} />
        ) : null}
        <CopyRegistry value={`@audio-ui/${name}`} />
        {actions}
      </div>
    </Bar>
  );
}
