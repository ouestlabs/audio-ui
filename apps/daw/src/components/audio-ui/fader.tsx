"use client";

import { Fader as FaderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  "rounded-full bg-input/90 relative grow cursor-pointer select-none overflow-hidden",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default:
          "data-[orientation=horizontal]:h-2 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2",
        lg: "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-2.5",
        sm: "data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1.5",
      },
    },
  }
);

const faderThumbVariants = cva(
  "border-ring border bg-card transition-[color,box-shadow] hover:ring-2 hover:ring-ring/40 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:ring-3 active:ring-ring/50 motion-reduce:transition-none before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default:
          "rounded-[min(var(--radius-md),10px)] data-[orientation=horizontal]:h-4 data-[orientation=vertical]:h-6 data-[orientation=horizontal]:w-6 data-[orientation=vertical]:w-4",
        lg: "rounded-[min(var(--radius-lg),12px)] data-[orientation=horizontal]:h-5 data-[orientation=vertical]:h-7 data-[orientation=horizontal]:w-7 data-[orientation=vertical]:w-5",
        sm: "rounded-[min(var(--radius-sm),8px)] data-[orientation=horizontal]:h-3.5 data-[orientation=vertical]:h-5 data-[orientation=horizontal]:w-5 data-[orientation=vertical]:w-3.5",
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
        default:
          "data-[orientation=horizontal]:px-1.5 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-1.5",
        lg: "data-[orientation=horizontal]:px-2 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1 data-[orientation=vertical]:py-2",
        sm: "data-[orientation=horizontal]:px-1 data-[orientation=horizontal]:py-0.5 data-[orientation=vertical]:px-0.5 data-[orientation=vertical]:py-1",
      },
    },
  }
);

const faderThumbMarkVariants = cva("bg-primary opacity-50", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default:
        "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2.5",
      lg: "data-[orientation=horizontal]:h-3 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-3",
      sm: "data-[orientation=horizontal]:h-2.5 data-[orientation=vertical]:h-px data-[orientation=horizontal]:w-px data-[orientation=vertical]:w-2.5",
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
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-[var(--fader-min-height,10rem)] data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
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
              "bg-primary absolute select-none",
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
                      <span className="text-[10px] leading-none text-muted-foreground tabular-nums in-data-[active]:text-foreground">
                        {markLabel(mark)}
                      </span>
                    )}
                    <span className="bg-muted-foreground/40 transition-colors duration-150 ease-out in-data-[active]:data-[color]:bg-primary motion-reduce:transition-none h-px w-1.5" />
                  </>
                ) : (
                  <>
                    <span className="bg-muted-foreground/40 transition-colors duration-150 ease-out in-data-[active]:data-[color]:bg-primary motion-reduce:transition-none h-1.5 w-px" />
                    {markLabel(mark) === undefined ? null : (
                      <span className="text-[10px] leading-none text-muted-foreground tabular-nums in-data-[active]:text-foreground">
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
                  key={String(i)}
                />
              ))}
          </div>
          {valueLabel === "hidden" ? null : (
            <FaderPrimitive.Value
              className={cn(
                "rounded-[min(var(--radius-sm),6px)] bg-foreground px-1.5 py-0.5 font-medium text-[10px] text-background tabular-nums leading-none shadow-sm absolute z-20 whitespace-nowrap",
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
