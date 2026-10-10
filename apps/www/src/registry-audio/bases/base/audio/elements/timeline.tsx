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

function TimelineViewport({
  className,
  ...props
}: TimelinePrimitive.Viewport.Props) {
  return (
    <TimelinePrimitive.Viewport
      className={cn(
        "cn-timeline-viewport relative min-h-0 min-w-0 overscroll-x-contain",
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

export {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelinePlayhead,
  TimelineRuler,
  TimelineViewport,
};
