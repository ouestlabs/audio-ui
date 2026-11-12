import { cn } from "@/registry/bases/base/lib/utils";

/** A stretch of time selected on a track, drawn over its lane: put it inside a `TimelineLane`. */
function TimelineTimeSelection({
  className,
  range,
}: {
  className?: string;
  /** Where it starts and ends, in the timeline's units. */
  range: readonly [number, number];
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-y-0 z-10 bg-primary/15 ring-1 ring-primary/40 ring-inset",
        className
      )}
      data-slot="timeline-time-selection"
      style={{
        left: `calc(var(--timeline-unit) * ${range[0]})`,
        width: `calc(var(--timeline-unit) * ${range[1] - range[0]})`,
      }}
    />
  );
}

export { TimelineTimeSelection };
