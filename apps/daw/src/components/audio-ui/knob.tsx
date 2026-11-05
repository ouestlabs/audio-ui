"use client";

import { Knob as KnobPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const knobVariants = cva(
  "rounded-full border border-transparent ring-1 ring-foreground/10 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 hover:ring-2 hover:ring-ring/40 has-[[data-slot=knob-control]:active]:border-ring has-[[data-slot=knob-control]:active]:ring-3 has-[[data-slot=knob-control]:active]:ring-ring motion-reduce:transition-none relative inline-flex outline-none data-disabled:cursor-not-allowed",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "size-12",
        lg: "size-16",
        sm: "size-11",
        xl: "size-24",
        xs: "size-8",
      },
    },
  }
);

const knobControlClassName =
  "bg-secondary text-secondary-foreground shadow-xs transition-[color,background-color,box-shadow,border-color,opacity] duration-150 ease-out hover:bg-secondary/90 active:shadow-[inset_0_-14px_28px_-12px_rgb(0_0_0/0.14)] motion-reduce:transition-none dark:bg-secondary/60 dark:hover:bg-secondary/70 dark:active:shadow-[inset_0_-14px_28px_-12px_rgb(0_0_0/0.28)] transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-50";

const knobBodyVariants = cva("rounded-full bg-card text-card-foreground ring-1 ring-foreground/10 transition-transform duration-100 ease-out motion-reduce:transition-none absolute z-0", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "inset-1.5",
      lg: "inset-2",
      sm: "inset-1",
      xl: "inset-2.5",
      xs: "inset-1",
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
  dragMode,
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
      dragMode={dragMode}
      {...props}
    >
      <KnobPrimitive.Control
        className={cn(
          knobControlClassName,
          // Dragged up and down, it is a fader: the cursor says so.
          dragMode === "vertical" && "cursor-ns-resize active:cursor-ns-resize"
        )}
        data-slot="knob-control"
      >
        <div className={knobBodyVariants({ size })} data-slot="knob-body" />
        <KnobPrimitive.Track
          className="text-primary [&_path]:stroke-current pointer-events-none absolute inset-0 z-1 block size-full opacity-22"
          data-slot="knob-track"
        />
        <KnobPrimitive.Indicator
          className="text-primary [&_path]:stroke-current pointer-events-none absolute inset-0 z-1 block size-full"
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
            className="text-primary block size-full"
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
          <span className="bg-muted-foreground/40 transition-colors duration-150 ease-out in-data-[active]:data-[color]:bg-primary motion-reduce:transition-none -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2" />
          {markLabel(mark) === undefined ? null : (
            <span className="text-[10px] leading-none text-muted-foreground tabular-nums in-data-[active]:text-foreground -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]">
              {markLabel(mark)}
            </span>
          )}
        </KnobPrimitive.Mark>
      ))}
      {valueLabel === "hidden" ? null : (
        <KnobPrimitive.Value
          className={cn(
            "rounded-[min(var(--radius-sm),6px)] bg-foreground px-1.5 py-0.5 font-medium text-[10px] text-background tabular-nums leading-none shadow-sm absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap",
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