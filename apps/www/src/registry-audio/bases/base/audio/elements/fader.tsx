"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const faderVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "",
      lg: "",
      sm: "",
    },
  },
});

const faderTrackVariants = cva(
  "cn-fader-track relative grow cursor-pointer select-none overflow-hidden",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-fader-track-size-default",
        lg: "cn-fader-track-size-lg",
        sm: "cn-fader-track-size-sm",
      },
    },
  }
);

const faderThumbVariants = cva(
  "cn-fader-thumb before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-fader-thumb-size-default",
        lg: "cn-fader-thumb-size-lg",
        sm: "cn-fader-thumb-size-sm",
      },
    },
  }
);

const faderThumbInnerVariants = cva(
  "flex h-full w-full items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "cn-fader-thumb-inner-size-default",
        lg: "cn-fader-thumb-inner-size-lg",
        sm: "cn-fader-thumb-inner-size-sm",
      },
    },
  }
);

const faderThumbMarkVariants = cva("cn-fader-thumb-mark", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-fader-thumb-mark-size-default",
      lg: "cn-fader-thumb-mark-size-lg",
      sm: "cn-fader-thumb-mark-size-sm",
    },
  },
});

/** A graduation on the fader's scale: a value, or a value and its label. */
export type FaderMark = number | { label?: ReactNode; value: number };

interface FaderProps
  extends FaderPrimitive.Root.Props,
    VariantProps<typeof faderVariants> {
  /** Lets you type the value: a double click on the readout, or Enter while it has focus. */
  editableValue?: boolean;
  /** Prints the value in the readout, e.g. as `"-6 dB"`. Defaults to `format`/`locale`. */
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
  const hasLabels = marks?.some((mark) => markLabel(mark) !== undefined);
  return (
    <FaderPrimitive.Root
      className={cn(
        "group/fader relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-disabled:cursor-not-allowed",
        marks &&
          "data-[orientation=horizontal]:pb-3 data-[orientation=vertical]:ps-3",
        hasLabels &&
          "data-[orientation=horizontal]:pb-6 data-[orientation=vertical]:ps-10",
        className
      )}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Control
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          "data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32",
          "transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:pointer-events-none data-disabled:opacity-50",
          faderVariants({ size })
        )}
      >
        <FaderPrimitive.Track
          className={faderTrackVariants({ size })}
          data-slot="fader-track"
        >
          <FaderPrimitive.Indicator
            className={cn(
              "cn-fader-range absolute select-none",
              "data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
              "data-[orientation=vertical]:bottom-0"
            )}
          />
        </FaderPrimitive.Track>

        {marks ? (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute",
              orientation === "vertical"
                ? "inset-y-0 end-[calc(50%+0.75rem)]"
                : "inset-x-0 top-[calc(50%+0.75rem)]"
            )}
            data-slot="fader-scale"
          >
            {marks.map((mark) => (
              <FaderPrimitive.Mark
                className={cn(
                  "flex items-center gap-1",
                  orientation === "vertical"
                    ? "end-0 translate-y-1/2 flex-row"
                    : "-translate-x-1/2 flex-col"
                )}
                key={markValue(mark)}
                value={markValue(mark)}
              >
                {orientation === "vertical" ? (
                  <>
                    {markLabel(mark) === undefined ? null : (
                      <span className="cn-fader-mark-label">
                        {markLabel(mark)}
                      </span>
                    )}
                    <span className="cn-fader-mark-tick h-px w-1.5" />
                  </>
                ) : (
                  <>
                    <span className="cn-fader-mark-tick h-1.5 w-px" />
                    {markLabel(mark) === undefined ? null : (
                      <span className="cn-fader-mark-label">
                        {markLabel(mark)}
                      </span>
                    )}
                  </>
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
                  key={String(i)}
                />
              ))}
          </div>
          {valueLabel === "hidden" ? null : (
            <FaderPrimitive.Value
              className={cn(
                "cn-fader-value absolute z-20 whitespace-nowrap",
                editableValue ? "cursor-text" : "pointer-events-none",
                orientation === "vertical"
                  ? "start-full top-1/2 ms-2 -translate-y-1/2"
                  : "bottom-full left-1/2 mb-2 -translate-x-1/2",
                valueLabel === "auto" &&
                  "opacity-0 transition-opacity duration-150 ease-out group-hover/fader:opacity-100 group-has-focus-visible/fader:opacity-100 group-has-data-dragging/fader:opacity-100 data-editing:opacity-100 motion-reduce:transition-none"
              )}
              data-slot="fader-value"
              editable={editableValue}
            >
              {(formatted, values) =>
                formatValue && values[0] !== undefined
                  ? formatValue(values[0])
                  : formatted[0]
              }
            </FaderPrimitive.Value>
          )}
        </FaderPrimitive.Thumb>
      </FaderPrimitive.Control>
    </FaderPrimitive.Root>
  );
}
