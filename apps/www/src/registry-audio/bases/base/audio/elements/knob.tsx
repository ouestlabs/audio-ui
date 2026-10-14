"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const knobVariants = cva(
  "cn-knob relative inline-flex outline-none data-disabled:cursor-not-allowed",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-knob-size-default",
        lg: "cn-knob-size-lg",
        sm: "cn-knob-size-sm",
        xl: "cn-knob-size-xl",
      },
    },
  }
);

const knobControlClassName =
  "cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-50";

const knobBodyVariants = cva("cn-knob-body absolute z-0", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-knob-body-size-default",
      lg: "cn-knob-body-size-lg",
      sm: "cn-knob-body-size-sm",
      xl: "cn-knob-body-size-xl",
    },
  },
});

/** A graduation around the dial: a value, or a value and its label. */
export type KnobMark = number | { label?: ReactNode; value: number };

export type KnobProps = KnobPrimitive.Root.Props &
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

function Knob({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  editableValue = false,
  formatValue,
  marks,
  size,
  valueLabel = "auto",
  ...props
}: KnobProps) {
  const hasLabels = marks?.some((mark) => markLabel(mark) !== undefined);
  return (
    <KnobPrimitive.Root
      className={cn(
        knobVariants({ size }),
        "group/knob",
        marks && "m-2",
        hasLabels && "m-5",
        // The readout hangs under the dial: leave it room, or a panel clips it.
        valueLabel !== "hidden" && (hasLabels ? "mb-12" : "mb-8"),
        className
      )}
      data-slot="knob"
      {...props}
    >
      <KnobPrimitive.Control
        className={knobControlClassName}
        data-slot="knob-control"
      >
        <div className={knobBodyVariants({ size })} data-slot="knob-body" />
        <KnobPrimitive.Track
          className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22"
          data-slot="knob-track"
        />
        <KnobPrimitive.Indicator
          className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full"
          data-slot="knob-arc"
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
        >
          <svg
            aria-hidden="true"
            className="cn-knob-indicator block size-full"
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
          <span className="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2" />
          {markLabel(mark) === undefined ? null : (
            <span className="cn-knob-mark-label -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]">
              {markLabel(mark)}
            </span>
          )}
        </KnobPrimitive.Mark>
      ))}
      {valueLabel === "hidden" ? null : (
        <KnobPrimitive.Value
          className={cn(
            "cn-knob-value absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap",
            editableValue ? "cursor-text" : "pointer-events-none",
            // Below the labels at the ends of the sweep, not over them.
            hasLabels && "mt-6",
            valueLabel === "auto" &&
              "opacity-0 transition-opacity duration-150 ease-out group-hover/knob:opacity-100 group-has-focus-visible/knob:opacity-100 group-data-dragging/knob:opacity-100 data-editing:opacity-100 motion-reduce:transition-none"
          )}
          data-slot="knob-value"
          editable={editableValue}
        >
          {(formatted, value) => (formatValue ? formatValue(value) : formatted)}
        </KnobPrimitive.Value>
      )}
    </KnobPrimitive.Root>
  );
}

export { Knob, knobVariants };
