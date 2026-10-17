"use client";

import { Envelope as EnvelopePrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

/** Above this level a point's label sits under it, not over it. */
const LABEL_FLIP_ABOVE = 0.7;

interface AutomationEnvelopeProps extends EnvelopePrimitive.Root.Props {
  /** How long the arrangement is, in the timeline's units: the envelope spans it, `x` 0 at its start and 1 at its end. */
  duration: number;
  /** Prints a point's value, in its label and its accessible value text: `-6.0 dB`. */
  formatValue: (point: { x: number; y: number }) => string;
}

/**
 * A track's automation, laid over its lane in a timeline: the envelope runs
 * along the whole arrangement, under the same zoom and scroll as the clips.
 * Only the line and its points take the pointer, so a press beside them
 * reaches the lane and the clips under it. Drag a point to move it, the small
 * handle on a segment to bend it, double click the line to add a point and a
 * point to remove it; Shift drags finely and Cmd/Ctrl leaves the grid.
 */
export function AutomationEnvelope({
  className,
  duration,
  formatValue,
  ...props
}: AutomationEnvelopeProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-2 start-0 z-20",
        className
      )}
      data-slot="automation-envelope"
      style={{ width: `calc(var(--timeline-unit) * ${duration})` }}
    >
      <EnvelopePrimitive.Root
        className="group/automation relative size-full"
        role="group"
        {...props}
      >
        <EnvelopePrimitive.Graph className="size-full overflow-visible">
          <EnvelopePrimitive.Line className="cn-envelope-path [stroke-linejoin:round]" />
          {/* A wide, unseen copy of the line: what a double click on the line lands on. */}
          <EnvelopePrimitive.Line className="cursor-copy [pointer-events:stroke] stroke-[12px] stroke-transparent" />
        </EnvelopePrimitive.Graph>
        <EnvelopePrimitive.Segments>
          {(_point, index) => (
            <EnvelopePrimitive.Segment
              aria-label={`Curve ${index + 1}`}
              className="cn-envelope-curve pointer-events-auto size-2.5 cursor-ns-resize opacity-0 outline-none after:absolute after:-inset-2 group-hover/automation:opacity-100 data-dragging:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
              index={index}
              key={index}
            />
          )}
        </EnvelopePrimitive.Segments>
        <EnvelopePrimitive.Points>
          {(point, index, points) => (
            <EnvelopePrimitive.Point
              aria-label={`Point ${index + 1} of ${points.length}`}
              className="cn-envelope-point group/point pointer-events-auto size-3 cursor-grab touch-none select-none outline-none after:absolute after:-inset-2 focus-visible:bg-primary active:cursor-grabbing data-dragging:bg-primary pointer-coarse:after:-inset-3"
              getAriaValueText={formatValue}
              index={index}
              key={index}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "cn-envelope-point-value -translate-x-1/2 pointer-events-none absolute left-1/2 z-10 hidden whitespace-nowrap group-hover/point:block group-focus-visible/point:block group-data-dragging/point:block",
                  point.y > LABEL_FLIP_ABOVE
                    ? "top-full mt-1.5"
                    : "bottom-full mb-1.5"
                )}
              >
                {formatValue(point)}
              </span>
            </EnvelopePrimitive.Point>
          )}
        </EnvelopePrimitive.Points>
      </EnvelopePrimitive.Root>
    </div>
  );
}
