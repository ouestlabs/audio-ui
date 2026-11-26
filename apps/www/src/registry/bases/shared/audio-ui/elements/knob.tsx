import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/registry/lib/utils";
import { Knob as KnobPrimitive } from "@/registry/primitives/knob/react";

/**
 * How each part of the knob is drawn, by its `data-slot`. A part's look follows
 * its attributes, never the knob's props: the React knob applies these classes,
 * and `registry:build` writes them as plain CSS on the parts for every other
 * framework. The root carries `data-size`, `data-marks` (`ticks` or `labels`)
 * and `data-readout` (`auto` or `always`) for the parts to read.
 */
export const knobParts = {
  knob: "cn-knob group/knob relative inline-flex outline-none data-disabled:cursor-not-allowed data-[marks=ticks]:mx-2 data-[marks=ticks]:mt-2 data-[marks=ticks]:not-data-readout:mb-2 data-[marks=labels]:mx-5 data-[marks=labels]:mt-5 data-[marks=labels]:not-data-readout:mb-5 data-readout:mb-8 data-[marks=labels]:data-readout:mb-12",
  "knob-control":
    "cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-50 data-[drag-mode=vertical]:cursor-ns-resize data-[drag-mode=vertical]:active:cursor-ns-resize",
  "knob-body": "cn-knob-body absolute z-0",
  "knob-track":
    "cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22",
  "knob-arc":
    "cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full",
  "knob-thumb": "pointer-events-none absolute inset-0 z-2",
  "knob-indicator": "cn-knob-indicator block size-full",
  "knob-mark-tick":
    "cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2",
  "knob-mark-label":
    "cn-knob-mark-label -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]",
  // The readout hangs under the dial, below the labels at the ends of the sweep. Shown on demand, it appears while the knob is hovered, turned or focused.
  "knob-value":
    "cn-knob-value pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap in-data-[marks=labels]:mt-6 data-editable:pointer-events-auto data-editable:cursor-text in-data-[readout=auto]:opacity-0 in-data-[readout=auto]:transition-opacity in-data-[readout=auto]:duration-150 in-data-[readout=auto]:ease-out in-data-[readout=auto]:motion-reduce:transition-none group-hover/knob:opacity-100 group-has-focus-visible/knob:opacity-100 group-data-dragging/knob:opacity-100 data-editing:opacity-100",
} as const;

/** The parts whose look changes with the knob's `data-size`, by size. */
export const knobSizes = {
  knob: {
    default: "cn-knob-size-default",
    lg: "cn-knob-size-lg",
    sm: "cn-knob-size-sm",
    xl: "cn-knob-size-xl",
    xs: "cn-knob-size-xs",
  },
  "knob-body": {
    default: "cn-knob-body-size-default",
    lg: "cn-knob-body-size-lg",
    sm: "cn-knob-body-size-sm",
    xl: "cn-knob-body-size-xl",
    xs: "cn-knob-body-size-xs",
  },
} as const;

const knobVariants = cva(knobParts.knob, {
  defaultVariants: { size: "default" },
  variants: { size: knobSizes.knob },
});

const knobBodyVariants = cva(knobParts["knob-body"], {
  defaultVariants: { size: "default" },
  variants: { size: knobSizes["knob-body"] },
});

/** A graduation around the dial: a value, or a value and its label. */
export type KnobMark = number | { label?: ReactNode; value: number };

export type KnobProps = ComponentProps<typeof KnobPrimitive.Root> &
  VariantProps<typeof knobVariants> & {
    /** Prints the value in the readout and in what screen readers announce, e.g. as `"8.7 kHz"`. Defaults to `format`/`locale`. */
    formatValue?: (value: number) => string;
    /** Graduations drawn around the dial, on its scale. */
    marks?: readonly KnobMark[];
    /** Lets you type the value: a double click on the readout, or Enter while it has focus. */
    editableValue?: boolean;
    /** When the value shows under the dial: while hovered, turned or focused (`auto`), `always`, or `hidden`. */
    valueLabel?: "always" | "auto" | "hidden";
  };

const markValue = (mark: KnobMark) =>
  typeof mark === "number" ? mark : mark.value;
const markLabel = (mark: KnobMark) =>
  typeof mark === "number" ? undefined : mark.label;

/** What the scale holds, for the parts to leave it room: labels, ticks alone, or nothing. */
function scaleOf(marks: readonly KnobMark[] | undefined) {
  if (!marks) {
    return;
  }
  return marks.some((mark) => markLabel(mark) !== undefined)
    ? "labels"
    : "ticks";
}

function Knob({
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
  return (
    <KnobPrimitive.Root
      className={cn(knobVariants({ size }), className)}
      data-marks={scaleOf(marks)}
      data-readout={valueLabel === "hidden" ? undefined : valueLabel}
      data-size={size ?? "default"}
      data-slot="knob"
      dragMode={dragMode}
      {...props}
    >
      <KnobPrimitive.Control
        className={knobParts["knob-control"]}
        data-slot="knob-control"
      >
        <div className={knobBodyVariants({ size })} data-slot="knob-body" />
        <KnobPrimitive.Track
          className={knobParts["knob-track"]}
          data-slot="knob-track"
        />
        <KnobPrimitive.Indicator
          className={knobParts["knob-arc"]}
          data-slot="knob-arc"
        />
        <KnobPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={knobParts["knob-thumb"]}
          data-slot="knob-thumb"
          getAriaValueText={
            formatValue ? (_formatted, value) => formatValue(value) : undefined
          }
        >
          <svg
            aria-hidden="true"
            className={knobParts["knob-indicator"]}
            data-slot="knob-indicator"
            viewBox="0 0 48 48"
          >
            <line
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2.75}
              x1={24}
              x2={24}
              y1={11.53}
              y2={18.84}
            />
          </svg>
        </KnobPrimitive.Thumb>
      </KnobPrimitive.Control>
      {marks?.map((mark) => (
        <KnobPrimitive.Mark key={markValue(mark)} value={markValue(mark)}>
          <span
            className={knobParts["knob-mark-tick"]}
            data-slot="knob-mark-tick"
          />
          {markLabel(mark) === undefined ? null : (
            <span
              className={knobParts["knob-mark-label"]}
              data-slot="knob-mark-label"
            >
              {markLabel(mark)}
            </span>
          )}
        </KnobPrimitive.Mark>
      ))}
      {valueLabel === "hidden" ? null : (
        <KnobPrimitive.Value
          className={knobParts["knob-value"]}
          data-editable={editableValue ? "" : undefined}
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

export { Knob, knobVariants };
