"use client";

import { Timeline as TimelinePrimitive } from "@audio-ui/react";
import type { CSSProperties } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

function Timeline({ className, ...props }: TimelinePrimitive.Root.Props) {
  return (
    <TimelinePrimitive.Root
      className={cn(
        "cn-timeline flex w-full min-w-0 flex-col data-disabled:opacity-50",
        className
      )}
      data-slot="timeline"
      {...props}
    />
  );
}

type TimelineViewportProps = TimelinePrimitive.Viewport.Props & {
  /** `hidden` drops the native scrollbar, for a `TimelineNavigator` to scroll with instead. */
  scrollbar?: "hidden" | "native";
};

function TimelineViewport({
  className,
  scrollbar = "native",
  ...props
}: TimelineViewportProps) {
  return (
    <TimelinePrimitive.Viewport
      className={cn(
        "cn-timeline-viewport relative min-h-0 min-w-0 overscroll-x-contain",
        scrollbar === "hidden" &&
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      data-slot="timeline-viewport"
      {...props}
    />
  );
}

function TimelineRuler({ className, ...props }: TimelinePrimitive.Ruler.Props) {
  return (
    <TimelinePrimitive.Ruler
      className={cn(
        "cn-timeline-ruler shrink-0 cursor-pointer touch-none select-none",
        "data-disabled:pointer-events-none",
        className
      )}
      data-slot="timeline-ruler"
      {...props}
    />
  );
}

type TimelineLaneProps = Omit<TimelinePrimitive.Lane.Props, "style"> & {
  /** Distance between grid lines, in the timeline's units. Leave it out for no lines. */
  gridStep?: number;
  style?: CSSProperties;
};

/** A line every `gridStep` units, sized from the lane's own unit so it follows the zoom. */
function gridLines(gridStep: number | undefined): CSSProperties | undefined {
  if (!(gridStep && gridStep > 0)) {
    return;
  }
  return {
    backgroundImage:
      "repeating-linear-gradient(to right, var(--timeline-grid-color) 0 1px, transparent 1px 100%)",
    backgroundSize: `calc(var(--timeline-unit) * ${gridStep}) 100%`,
  };
}

function TimelineLane({
  className,
  gridStep,
  style,
  ...props
}: TimelineLaneProps) {
  return (
    <TimelinePrimitive.Lane
      className={cn("cn-timeline-lane", className)}
      data-slot="timeline-lane"
      style={{ ...gridLines(gridStep), ...style }}
      {...props}
    />
  );
}

function TimelineTrack({ className, ...props }: TimelinePrimitive.Track.Props) {
  return (
    <TimelinePrimitive.Track
      className={cn("cn-timeline-track", className)}
      data-slot="timeline-track"
      {...props}
    />
  );
}

function TimelineTrackHeader({
  className,
  ...props
}: TimelinePrimitive.TrackHeader.Props) {
  return (
    <TimelinePrimitive.TrackHeader
      className={cn("cn-timeline-track-header", className)}
      data-slot="timeline-track-header"
      {...props}
    />
  );
}

function TimelineTrackResizeHandle({
  className,
  ...props
}: TimelinePrimitive.TrackResizeHandle.Props) {
  return (
    <TimelinePrimitive.TrackResizeHandle
      className={cn(
        "cn-timeline-track-resize-handle absolute touch-none outline-none",
        className
      )}
      data-slot="timeline-track-resize-handle"
      {...props}
    />
  );
}

function TimelineMark({ className, ...props }: TimelinePrimitive.Mark.Props) {
  return (
    <TimelinePrimitive.Mark
      className={cn(
        "cn-timeline-mark pointer-events-none inset-y-0 flex items-center",
        className
      )}
      data-slot="timeline-mark"
      {...props}
    />
  );
}

function TimelinePlayhead({
  className,
  ...props
}: TimelinePrimitive.Playhead.Props) {
  return (
    <TimelinePrimitive.Playhead
      className={cn(
        "cn-timeline-playhead pointer-events-none inset-y-0 w-px",
        className
      )}
      data-slot="timeline-playhead"
      {...props}
    />
  );
}

function TimelineRange({ className, ...props }: TimelinePrimitive.Range.Props) {
  return (
    <TimelinePrimitive.Range
      className={cn(
        "cn-timeline-range inset-y-0 cursor-grab touch-none data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-range"
      {...props}
    />
  );
}

function TimelineRangeHandle({
  className,
  ...props
}: TimelinePrimitive.RangeHandle.Props) {
  return (
    <TimelinePrimitive.RangeHandle
      className={cn(
        "cn-timeline-range-handle absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0",
        "after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3",
        className
      )}
      data-slot="timeline-range-handle"
      {...props}
    />
  );
}

function TimelineClip({ className, ...props }: TimelinePrimitive.Clip.Props) {
  return (
    <TimelinePrimitive.Clip
      className={cn(
        "cn-timeline-clip group/clip isolate inset-y-0 touch-none data-dragging:z-10 data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-clip"
      {...props}
    />
  );
}

/** The clip's title bar: drag it to move the clip. Put the clip's name in it. */
function TimelineClipHeader({
  className,
  ...props
}: TimelinePrimitive.ClipHeader.Props) {
  return (
    <TimelinePrimitive.ClipHeader
      className={cn(
        "cn-timeline-clip-header flex h-5 cursor-grab items-center truncate px-2 text-xs data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="timeline-clip-header"
      {...props}
    />
  );
}

function TimelineClipHandle({
  className,
  ...props
}: TimelinePrimitive.ClipHandle.Props) {
  return (
    <TimelinePrimitive.ClipHandle
      className={cn(
        "cn-timeline-clip-handle absolute inset-y-0 z-10 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0",
        "after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3",
        className
      )}
      data-slot="timeline-clip-handle"
      {...props}
    />
  );
}

/** Shades what a fade attenuates, over the clip's content. */
function TimelineClipFade({
  className,
  ...props
}: TimelinePrimitive.ClipFade.Props) {
  return (
    <TimelinePrimitive.ClipFade
      className={cn("cn-timeline-clip-fade", className)}
      data-slot="timeline-clip-fade"
      {...props}
    />
  );
}

function TimelineClipFadeHandle({
  className,
  ...props
}: TimelinePrimitive.ClipFadeHandle.Props) {
  return (
    <TimelinePrimitive.ClipFadeHandle
      className={cn(
        "cn-timeline-clip-fade-handle top-0 z-20 size-2.5 cursor-ew-resize opacity-0 transition-opacity",
        "group-hover/clip:opacity-100 group-data-[selected]/clip:opacity-100 data-dragging:opacity-100 has-focus-visible:opacity-100",
        "after:absolute after:-inset-1 pointer-coarse:opacity-100 pointer-coarse:after:-inset-2",
        className
      )}
      data-slot="timeline-clip-fade-handle"
      {...props}
    />
  );
}

/** The whole timeline as one bar: drag the window to scroll, an edge to zoom, double-click to show everything. */
function TimelineNavigator({
  className,
  ...props
}: TimelinePrimitive.Navigator.Props) {
  return (
    <TimelinePrimitive.Navigator
      className={cn("cn-timeline-navigator shrink-0 select-none", className)}
      data-slot="timeline-navigator"
      {...props}
    >
      <TimelinePrimitive.NavigatorWindow
        aria-label="Visible range"
        className="cn-timeline-navigator-window inset-y-0 cursor-grab active:cursor-grabbing"
      />
      <TimelinePrimitive.NavigatorHandle
        aria-label="Start of the visible range"
        className="cn-timeline-navigator-handle inset-y-0 w-2 cursor-ew-resize data-[edge=end]:-translate-x-full after:absolute after:-inset-x-1.5 after:inset-y-0"
        edge="start"
      />
      <TimelinePrimitive.NavigatorHandle
        aria-label="End of the visible range"
        className="cn-timeline-navigator-handle inset-y-0 w-2 cursor-ew-resize data-[edge=end]:-translate-x-full after:absolute after:-inset-x-1.5 after:inset-y-0"
        edge="end"
      />
    </TimelinePrimitive.Navigator>
  );
}

export {
  Timeline,
  TimelineClip,
  TimelineClipFade,
  TimelineClipFadeHandle,
  TimelineClipHandle,
  TimelineClipHeader,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
  TimelineTrack,
  TimelineTrackHeader,
  TimelineTrackResizeHandle,
  TimelineViewport,
};
