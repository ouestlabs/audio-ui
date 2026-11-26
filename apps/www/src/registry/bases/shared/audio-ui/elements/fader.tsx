import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/registry/lib/utils";
import { Fader as FaderPrimitive } from "@/registry/primitives/fader/react";

/**
 * How each part of the fader is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the fader's props: the React fader applies
 * these classes, and `registry:build` writes them as plain CSS on the parts for
 * every other framework. The root carries `data-orientation`, `data-size`,
 * `data-marks` (`ticks` or `labels`) and `data-readout` (`auto` or `always`).
 */
export const faderParts = {
  fader:
    "group/fader relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-disabled:cursor-not-allowed data-[marks=ticks]:data-[orientation=horizontal]:pb-3 data-[marks=ticks]:data-[orientation=vertical]:ps-3 data-[marks=labels]:data-[orientation=horizontal]:pb-6 data-[marks=labels]:data-[orientation=vertical]:ps-10",
  "fader-control":
    "relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-[var(--fader-min-height,10rem)] data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32 transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:pointer-events-none data-disabled:opacity-50",
  "fader-track":
    "cn-fader-track relative grow cursor-pointer select-none overflow-hidden",
  "fader-indicator":
    "cn-fader-range absolute select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full data-[orientation=vertical]:bottom-0",
  "fader-scale":
    "pointer-events-none absolute group-data-[orientation=vertical]/fader:inset-y-0 group-data-[orientation=vertical]/fader:end-[calc(50%+0.75rem)] group-data-[orientation=horizontal]/fader:inset-x-0 group-data-[orientation=horizontal]/fader:top-[calc(50%+0.75rem)]",
  // A graduation is its tick, then its label: beside a vertical track the label reads first.
  "fader-mark":
    "flex items-center gap-1 group-data-[orientation=vertical]/fader:end-0 group-data-[orientation=vertical]/fader:translate-y-1/2 group-data-[orientation=vertical]/fader:flex-row-reverse group-data-[orientation=horizontal]/fader:-translate-x-1/2 group-data-[orientation=horizontal]/fader:flex-col",
  "fader-mark-tick":
    "cn-fader-mark-tick group-data-[orientation=vertical]/fader:h-px group-data-[orientation=vertical]/fader:w-1.5 group-data-[orientation=horizontal]/fader:h-1.5 group-data-[orientation=horizontal]/fader:w-px",
  "fader-mark-label": "cn-fader-mark-label",
  "fader-thumb":
    "cn-fader-thumb before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none",
  "fader-thumb-inner":
    "flex h-full w-full items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
  "fader-thumb-mark": "cn-fader-thumb-mark",
  // Beside the thumb, shown on demand while the fader is hovered, dragged or focused.
  "fader-value":
    "cn-fader-value pointer-events-none absolute z-20 whitespace-nowrap data-editable:pointer-events-auto data-editable:cursor-text group-data-[orientation=vertical]/fader:start-full group-data-[orientation=vertical]/fader:top-1/2 group-data-[orientation=vertical]/fader:ms-2 group-data-[orientation=vertical]/fader:-translate-y-1/2 group-data-[orientation=horizontal]/fader:bottom-full group-data-[orientation=horizontal]/fader:left-1/2 group-data-[orientation=horizontal]/fader:mb-2 group-data-[orientation=horizontal]/fader:-translate-x-1/2 in-data-[readout=auto]:opacity-0 in-data-[readout=auto]:transition-opacity in-data-[readout=auto]:duration-150 in-data-[readout=auto]:ease-out in-data-[readout=auto]:motion-reduce:transition-none group-hover/fader:opacity-100 group-has-focus-visible/fader:opacity-100 group-has-data-dragging/fader:opacity-100 data-editing:opacity-100",
} as const;

/** The parts whose look changes with the fader's `data-size`, by size. */
export const faderSizes = {
  "fader-track": {
    default: "cn-fader-track-size-default",
    lg: "cn-fader-track-size-lg",
    sm: "cn-fader-track-size-sm",
  },
  "fader-thumb": {
    default: "cn-fader-thumb-size-default",
    lg: "cn-fader-thumb-size-lg",
    sm: "cn-fader-thumb-size-sm",
  },
  "fader-thumb-inner": {
    default: "cn-fader-thumb-inner-size-default",
    lg: "cn-fader-thumb-inner-size-lg",
    sm: "cn-fader-thumb-inner-size-sm",
  },
  "fader-thumb-mark": {
    default: "cn-fader-thumb-mark-size-default",
    lg: "cn-fader-thumb-mark-size-lg",
    sm: "cn-fader-thumb-mark-size-sm",
  },
} as const;

const sized = (part: keyof typeof faderSizes) =>
  cva(faderParts[part], {
    defaultVariants: { size: "default" },
    variants: { size: faderSizes[part] },
  });

const faderVariants = cva("", {
  defaultVariants: { size: "default" },
  variants: { size: { default: "", lg: "", sm: "" } },
});
const faderTrackVariants = sized("fader-track");
const faderThumbVariants = sized("fader-thumb");
const faderThumbInnerVariants = sized("fader-thumb-inner");
const faderThumbMarkVariants = sized("fader-thumb-mark");

/** A graduation on the fader's scale: a value, or a value and its label. */
export type FaderMark = number | { label?: ReactNode; value: number };

export interface FaderProps
  extends ComponentProps<typeof FaderPrimitive.Root>,
    VariantProps<typeof faderVariants> {
  /** Lets you type the value: a double click on the readout, or Enter while it has focus. */
  editableValue?: boolean;
  /** Prints the value in the readout and in what screen readers announce, e.g. as `"-6 dB"`. Defaults to `format`/`locale`. */
  formatValue?: (value: number) => string;
  /** Graduations drawn beside the track: a ruler for the value. */
  marks?: readonly FaderMark[];
  thumbMarks?: number | false;
  /** When the value shows beside the thumb: while hovered, dragged or focused (`auto`), `always`, or `hidden`. */
  valueLabel?: "always" | "auto" | "hidden";
}

const markValue = (mark: FaderMark) =>
  typeof mark === "number" ? mark : mark.value;
const markLabel = (mark: FaderMark) =>
  typeof mark === "number" ? undefined : mark.label;

/** What the scale holds, for the parts to leave it room: labels, ticks alone, or nothing. */
function scaleOf(marks: readonly FaderMark[] | undefined) {
  if (!marks) {
    return;
  }
  return marks.some((mark) => markLabel(mark) !== undefined)
    ? "labels"
    : "ticks";
}

export function Fader({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  editableValue = false,
  formatValue,
  marks,
  size,
  orientation = "vertical",
  thumbMarks = 3,
  valueLabel = "auto",
  ...props
}: FaderProps) {
  return (
    <FaderPrimitive.Root
      className={cn(faderParts.fader, className)}
      data-marks={scaleOf(marks)}
      data-readout={valueLabel === "hidden" ? undefined : valueLabel}
      data-size={size ?? "default"}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Control className={faderParts["fader-control"]}>
        <FaderPrimitive.Track
          className={faderTrackVariants({ size })}
          data-slot="fader-track"
        >
          <FaderPrimitive.Indicator className={faderParts["fader-indicator"]} />
        </FaderPrimitive.Track>

        {marks ? (
          <div
            aria-hidden="true"
            className={faderParts["fader-scale"]}
            data-slot="fader-scale"
          >
            {marks.map((mark) => (
              <FaderPrimitive.Mark
                className={faderParts["fader-mark"]}
                key={markValue(mark)}
                value={markValue(mark)}
              >
                <span
                  className={faderParts["fader-mark-tick"]}
                  data-slot="fader-mark-tick"
                />
                {markLabel(mark) === undefined ? null : (
                  <span
                    className={faderParts["fader-mark-label"]}
                    data-slot="fader-mark-label"
                  >
                    {markLabel(mark)}
                  </span>
                )}
              </FaderPrimitive.Mark>
            ))}
          </div>
        ) : null}

        <FaderPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={faderThumbVariants({ size })}
          data-slot="fader-thumb"
          getAriaValueText={
            formatValue ? (_formatted, value) => formatValue(value) : undefined
          }
        >
          <div
            className={faderThumbInnerVariants({ size })}
            data-orientation={orientation}
            data-slot="fader-thumb-inner"
          >
            {thumbMarks !== false &&
              Array.from({ length: thumbMarks }, (_, i) => (
                <div
                  className={faderThumbMarkVariants({ size })}
                  data-orientation={orientation}
                  data-slot="fader-thumb-mark"
                  key={String(i)}
                />
              ))}
          </div>
          {valueLabel === "hidden" ? null : (
            <FaderPrimitive.Value
              className={faderParts["fader-value"]}
              data-editable={editableValue ? "" : undefined}
              data-slot="fader-value"
              editable={editableValue}
            >
              {({ formatted, value }) =>
                formatValue ? formatValue(value) : formatted
              }
            </FaderPrimitive.Value>
          )}
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Control>
    </FaderPrimitive.Root>
  );
}
