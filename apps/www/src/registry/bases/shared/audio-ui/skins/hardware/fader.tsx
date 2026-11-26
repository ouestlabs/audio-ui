import type { ComponentProps, ReactNode } from "react";
import type {
  FaderMark,
  FaderProps,
} from "@/registry/bases/shared/audio-ui/elements/fader";
import { cn } from "@/registry/lib/utils";
import { DEFAULT_MAX, DEFAULT_MIN } from "@/registry/primitives/fader/fader";
import { Fader as FaderPrimitive } from "@/registry/primitives/fader/react";

/** The graduations of a fader in dB, down to its floor. */
const DECIBELS = [6, 0, -6, -12, -24, -48];
/** A range that reaches this low reads as one in dB. */
const DECIBEL_FLOOR = -48;
/** A floor this low is printed as silence. */
const SILENCE = -60;

/** The scale of a fader that was given none: dB for a range in dB, its ends and middle otherwise. */
function printedMarks(min: number, max: number): FaderMark[] {
  if (min <= DECIBEL_FLOOR && max <= 24) {
    const levels = DECIBELS.filter((level) => level > min && level <= max);
    return [
      ...levels.map((value) => ({
        label: value > 0 ? `+${value}` : value,
        value,
      })),
      { label: min <= SILENCE ? "-∞" : min, value: min },
    ];
  }
  return [min, (min + max) / 2, max].map((value) => ({ label: value, value }));
}

const markOf = (mark: FaderMark): { label?: ReactNode; value: number } =>
  typeof mark === "number" ? { value: mark } : mark;

const SIZES = {
  default: {
    horizontal: "h-7 w-11",
    vertical: "h-11 w-7",
  },
  lg: { horizontal: "h-8 w-12", vertical: "h-12 w-8" },
  // The footprint of the digital cap: a bank of small faders has no more room.
  sm: { horizontal: "h-4 w-5", vertical: "h-5 w-4" },
};

const RIBS = [0, 1, 2, 3, 4];

/** The scale as drawn: the marks given, else the printed one. A small fader stands in a bank and has no room for one. */
function scaleOf(
  marks: FaderProps["marks"],
  size: FaderProps["size"],
  min: number,
  max: number
) {
  return marks ?? (size === "sm" ? [] : printedMarks(min, max));
}

/** The cap, ribbed across the travel, its middle rib in the accent. */
function RibbedThumb(
  props: ComponentProps<"div"> & { "data-orientation"?: string }
) {
  const vertical = props["data-orientation"] !== "horizontal";
  return (
    <div {...props}>
      <span
        aria-hidden="true"
        className={cn(
          "audio-cap absolute inset-0 flex items-center justify-center gap-[3px] rounded-[calc(3px*var(--audio-roundness,1))]",
          vertical ? "flex-col" : "flex-row"
        )}
      >
        {RIBS.map((rib) => (
          <span
            className={cn(
              "rounded-full",
              vertical ? "h-px w-3/4" : "h-3/4 w-px",
              rib === 2
                ? "bg-[color:var(--audio-accent,var(--primary))]"
                : "bg-black/30"
            )}
            key={rib}
          />
        ))}
      </span>
      {props.children}
    </div>
  );
}

const ribbedThumb = (props: ComponentProps<"div">) => (
  <RibbedThumb {...props} />
);

/**
 * The Hardware face of the fader: a narrow inset slot, a ribbed cap and a
 * printed scale. Same props as `Fader`; `thumbMarks` is the digital cap's.
 */
export function HardwareFader({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  editableValue = false,
  formatValue,
  marks,
  max = DEFAULT_MAX,
  min = DEFAULT_MIN,
  orientation = "vertical",
  size,
  thumbMarks: _thumbMarks,
  valueLabel = "auto",
  ...props
}: FaderProps) {
  const vertical = orientation === "vertical";
  const scale = scaleOf(marks, size, min, max);
  return (
    <FaderPrimitive.Root
      className={cn(
        "group/fader relative data-disabled:cursor-not-allowed data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        scale.length > 0 &&
          "data-[orientation=horizontal]:pb-6 data-[orientation=vertical]:ps-10",
        className
      )}
      max={max}
      min={min}
      orientation={orientation}
      {...props}
    >
      <FaderPrimitive.Control
        className={cn(
          "relative flex w-full touch-none select-none items-center transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:pointer-events-none data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-[var(--fader-min-height,10rem)] data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center data-disabled:opacity-50",
          size === "sm"
            ? "data-[orientation=horizontal]:min-h-5 data-[orientation=vertical]:w-5"
            : "data-[orientation=horizontal]:min-h-11 data-[orientation=vertical]:w-11"
        )}
      >
        <FaderPrimitive.Track
          className="audio-groove relative grow cursor-pointer select-none rounded-full data-[orientation=horizontal]:h-1 data-[orientation=vertical]:w-1 data-[orientation=horizontal]:w-full"
          data-slot="fader-track"
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute",
            vertical
              ? "inset-y-0 end-[calc(50%+1rem)]"
              : "inset-x-0 top-[calc(50%+1rem)]"
          )}
          data-slot="fader-scale"
        >
          {scale.map((mark) => {
            const { label, value } = markOf(mark);
            return (
              <FaderPrimitive.Mark
                className={cn(
                  "flex items-center gap-1",
                  vertical
                    ? "end-0 translate-y-1/2 flex-row"
                    : "-translate-x-1/2 flex-col-reverse"
                )}
                key={value}
                value={value}
              >
                {label === undefined ? null : (
                  <span className="audio-print">{label}</span>
                )}
                <span
                  className={cn(
                    "bg-[color:var(--audio-print,var(--muted-foreground))]",
                    vertical ? "h-px w-1.5" : "h-1.5 w-px"
                  )}
                />
              </FaderPrimitive.Mark>
            );
          })}
        </div>
        <FaderPrimitive.Thumb
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            "absolute z-10 block shrink-0 cursor-grab select-none rounded-[calc(3px*var(--audio-roundness,1))] outline-none has-focus-visible:ring-3 has-focus-visible:ring-ring/50 active:cursor-grabbing data-disabled:pointer-events-none",
            SIZES[size ?? "default"][orientation]
          )}
          data-slot="fader-thumb"
          getAriaValueText={
            formatValue ? (_formatted, value) => formatValue(value) : undefined
          }
          render={ribbedThumb}
        >
          {valueLabel === "hidden" ? null : (
            <FaderPrimitive.Value
              className={cn(
                "cn-fader-value absolute z-20 whitespace-nowrap",
                editableValue ? "cursor-text" : "pointer-events-none",
                vertical
                  ? "start-full top-1/2 ms-2 -translate-y-1/2"
                  : "bottom-full left-1/2 mb-2 -translate-x-1/2",
                valueLabel === "auto" &&
                  "opacity-0 transition-opacity duration-150 ease-out group-hover/fader:opacity-100 group-has-focus-visible/fader:opacity-100 group-has-data-dragging/fader:opacity-100 data-editing:opacity-100 motion-reduce:transition-none"
              )}
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
