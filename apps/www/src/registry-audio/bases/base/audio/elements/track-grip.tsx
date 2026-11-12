import type { ComponentProps, CSSProperties, Ref } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/registry/bases/base/lib/utils";
import type { TrackGhost } from "@/registry-audio/bases/base/hooks/use-track-reorder";

/**
 * The grip a track is moved by, down the left edge of its header: give it
 * `gripProps(id)` from `useTrackReorder`. Drag it, or press Up and Down on it.
 */
function TrackGrip({
  className,
  dragging,
  trackName,
  ...props
}: ComponentProps<"button"> & {
  /** Whether its track is the one being dragged. */
  dragging?: boolean;
  trackName: string;
}) {
  return (
    <button
      aria-label={`Move ${trackName}`}
      className={cn(
        "absolute inset-y-0 inset-s-1 z-10 flex w-3 cursor-grab items-center justify-center text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing",
        dragging && "cursor-grabbing bg-muted text-foreground",
        className
      )}
      data-slot="track-grip"
      type="button"
      {...props}
    >
      <svg
        aria-hidden="true"
        className="size-3.5"
        fill="currentColor"
        focusable="false"
        viewBox="0 0 16 16"
      >
        <circle cx="5.5" cy="3.5" r="1.25" />
        <circle cx="10.5" cy="3.5" r="1.25" />
        <circle cx="5.5" cy="8" r="1.25" />
        <circle cx="10.5" cy="8" r="1.25" />
        <circle cx="5.5" cy="12.5" r="1.25" />
        <circle cx="10.5" cy="12.5" r="1.25" />
      </svg>
    </button>
  );
}

/**
 * The copy of a track's header under the pointer while it is dragged, drawn
 * over the page: give it `ghost` and `ghostRef` from `useTrackReorder`, and
 * the track's name. Nothing while no track is dragged.
 */
function TrackReorderGhost({
  className,
  ghost,
  ghostRef,
  style,
  trackName,
}: {
  className?: string;
  ghost: TrackGhost | null;
  ghostRef: Ref<HTMLDivElement>;
  /** What carries the color of a track that has one of its own, as `trackSwatch` gives it. */
  style?: CSSProperties;
  trackName?: string;
}) {
  if (!(ghost && trackName)) {
    return null;
  }
  return createPortal(
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed z-50 flex items-center border border-s-4 bg-card px-3 text-sm shadow-lg",
        className
      )}
      data-slot="track-reorder-ghost"
      ref={ghostRef}
      style={{
        ...style,
        height: ghost.height,
        left: ghost.left,
        top: ghost.top,
        width: ghost.width,
      }}
    >
      {trackName}
    </div>,
    document.body
  );
}

export { TrackGrip, TrackReorderGhost };
