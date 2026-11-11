import { formatDb, formatHz } from "@audio-ui/engine/analysis";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

/** What a value is, which says how it reads. */
export type ValueKind =
  | "bpm"
  | "db"
  | "hz"
  | "pan"
  | "percent"
  | "semitones"
  | "time";

const SIGNED = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

/** Minutes, seconds and milliseconds: 1:02.345. */
function formatTime(seconds: number) {
  const whole = Math.max(0, seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, "0")}`;
}

/** A pan from -1 to 1: C in the middle, L or R and how far, in percent. */
function formatPan(pan: number) {
  const amount = Math.round(Math.abs(pan) * 100);
  if (amount === 0) {
    return "C";
  }
  return `${pan < 0 ? "L" : "R"} ${amount}`;
}

/** How a value of each kind reads: as a DAW shows it. */
export function formatValue(value: number, kind: ValueKind): string {
  switch (kind) {
    case "bpm":
      return `${value.toFixed(2)} BPM`;
    case "db":
      return formatDb(value);
    case "hz":
      return formatHz(value);
    case "pan":
      return formatPan(value);
    case "percent":
      return `${Math.round(value * 100)} %`;
    case "semitones":
      return `${SIGNED.format(value)} st`;
    default:
      return formatTime(value);
  }
}

const valueDisplayVariants = cva("cn-value-display inline-block", {
  defaultVariants: { size: "default" },
  variants: {
    /** "lg" for the main value of a panel. */
    size: {
      default: "cn-value-display-size-default",
      lg: "cn-value-display-size-lg",
      sm: "cn-value-display-size-sm",
    },
  },
});

export interface ValueDisplayProps
  extends VariantProps<typeof valueDisplayVariants> {
  className?: string;
  /** How it reads: a tempo, a level, a frequency, a pan, a share, a pitch, a time. */
  kind: ValueKind;
  /** Names it for assistive technology, which reads it with its value: "Cutoff". */
  label?: string;
  value: number;
}

/**
 * A value as it reads, in monospace figures that do not jump as they change:
 * 120.00 BPM, -6.0 dB, 1.2 kHz, L 30, 50 %, +3 st, 1:02.345. `formatValue`
 * gives the same text, for a title or an announcement.
 */
export function ValueDisplay({
  className,
  kind,
  label,
  size,
  value,
}: ValueDisplayProps) {
  const text = formatValue(value, kind);
  return (
    <output
      aria-label={label ? `${label}: ${text}` : undefined}
      className={cn(valueDisplayVariants({ size }), className)}
      data-kind={kind}
      data-size={size ?? "default"}
      data-slot="value-display"
    >
      {text}
    </output>
  );
}
