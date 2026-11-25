import type { ComponentProps } from "react";
import {
  type KnobProps,
  knobVariants,
} from "@/registry/bases/shared/audio-ui/elements/knob";
import { cn } from "@/registry/lib/utils";
import { START_ANGLE, SWEEP_ANGLE } from "@/registry/primitives/knob/knob";
import { Knob as KnobPrimitive } from "@/registry/primitives/knob/react";

/** The printed scale: eleven ticks along the sweep, longer at both ends and in the middle. */
const TICKS = Array.from({ length: 11 }, (_, index) => ({
  angle: START_ANGLE + (index / 10) * SWEEP_ANGLE,
  index,
  long: index % 5 === 0,
}));

function PrintedScale() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -inset-2 size-[calc(100%+1rem)] text-[color:var(--audio-print,var(--muted-foreground))]"
      viewBox="0 0 100 100"
    >
      {TICKS.map(({ angle, index, long }) => (
        <line
          key={index}
          stroke="currentColor"
          strokeWidth={long ? 2 : 1}
          transform={`rotate(${angle} 50 50)`}
          x1={50}
          x2={50}
          y1={0}
          y2={long ? 7 : 4}
        />
      ))}
    </svg>
  );
}

/** The grip line, on the thumb, which the knob turns: from near the center to the rim of the cap. */
function GripThumb(props: ComponentProps<"div">) {
  return (
    <div {...props}>
      {props.children}
      <span
        aria-hidden="true"
        className="absolute top-[18%] left-1/2 h-[30%] w-0.5 -translate-x-1/2 rounded-full bg-[color:var(--audio-print,var(--foreground))]"
      />
    </div>
  );
}

const gripThumb = (props: ComponentProps<"div">) => <GripThumb {...props} />;

/**
 * The Hardware face of the knob: a dark socket, a matte cap lit from above, a
 * grip line that turns with it and a printed scale. Same props as `Knob`.
 */
export function HardwareKnob({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  dragMode,
  editableValue = false,
  formatValue,
  marks,
  size,
  valueLabel = "auto",
  ...props
}: KnobProps) {
  const hasLabels = marks?.some(
    (mark) => typeof mark !== "number" && mark.label !== undefined
  );
  return (
    <KnobPrimitive.Root
      className={cn(
        knobVariants({ size }),
        "group/knob m-2",
        hasLabels && "m-5",
        valueLabel !== "hidden" && (hasLabels ? "mb-12" : "mb-8"),
        className
      )}
      data-slot="knob"
      dragMode={dragMode}
      {...props}
    >
      {marks ? null : <PrintedScale />}
      <KnobPrimitive.Control
        className="relative isolate flex size-full cursor-grab touch-none select-none rounded-full outline-none [clip-path:circle(50%_at_50%_50%)] bg-[color:var(--audio-socket,var(--secondary))] shadow-[inset_0_1px_3px_rgb(0_0_0/0.5)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-[drag-mode=vertical]:cursor-ns-resize data-disabled:opacity-50"
        data-slot="knob-control"
      >
        <div
          className="audio-cap absolute inset-[12%] rounded-full"
          data-slot="knob-body"
        />
        <KnobPrimitive.Indicator
          className="pointer-events-none absolute inset-0 z-1 block size-full text-[color:var(--audio-accent,var(--primary))]"
          data-slot="knob-arc"
          strokeWidth={1.5}
        />
        <KnobPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className="pointer-events-none absolute inset-0 z-2"
          data-slot="knob-thumb"
          getAriaValueText={
            formatValue ? (_formatted, value) => formatValue(value) : undefined
          }
          render={gripThumb}
        />
      </KnobPrimitive.Control>
      {marks?.map((mark) => {
        const { label, value } =
          typeof mark === "number" ? { label: undefined, value: mark } : mark;
        return (
          <KnobPrimitive.Mark key={value} value={value}>
            <span className="-top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2 bg-[color:var(--audio-print,var(--muted-foreground))]" />
            {label === undefined ? null : (
              <span className="audio-print -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]">
                {label}
              </span>
            )}
          </KnobPrimitive.Mark>
        );
      })}
      {valueLabel === "hidden" ? null : (
        <KnobPrimitive.Value
          className={cn(
            "cn-knob-value absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap",
            editableValue ? "cursor-text" : "pointer-events-none",
            hasLabels && "mt-6",
            valueLabel === "auto" &&
              "opacity-0 transition-opacity duration-150 ease-out group-hover/knob:opacity-100 group-has-focus-visible/knob:opacity-100 group-data-dragging/knob:opacity-100 data-editing:opacity-100 motion-reduce:transition-none"
          )}
          data-slot="knob-value"
          editable={editableValue}
        >
          {({ formatted, value }) =>
            formatValue ? formatValue(value) : formatted
          }
        </KnobPrimitive.Value>
      )}
    </KnobPrimitive.Root>
  );
}
