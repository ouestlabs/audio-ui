import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const ledVariants = cva("cn-led inline-block shrink-0", {
  defaultVariants: {
    size: "default",
    tone: "primary",
  },
  variants: {
    size: {
      default: "cn-led-size-default",
      lg: "cn-led-size-lg",
      sm: "cn-led-size-sm",
    },
    /** Its color when lit: the theme's primary, or destructive for recording and clipping. */
    tone: {
      destructive: "cn-led-tone-destructive",
      primary: "cn-led-tone-primary",
    },
  },
});

export interface LedProps extends VariantProps<typeof ledVariants> {
  /** Blinks while lit: a take arming, a clip about to start. Still for reduced motion. @default false */
  blink?: boolean;
  className?: string;
  /** Names what it shows, for assistive technology: "Recording", "Signal". */
  label: string;
  /** Whether it is lit. */
  on: boolean;
}

/**
 * A status light: lit, it glows in its tone; off, a dim dot, so its place
 * still shows. It shows a state, it does not set one: its label reads the
 * state out ("Recording: on").
 */
export function Led({
  blink = false,
  className,
  label,
  on,
  size,
  tone,
}: LedProps) {
  return (
    <span
      aria-label={`${label}: ${on ? "on" : "off"}`}
      className={cn(ledVariants({ size, tone }), className)}
      data-blink={blink ? "" : undefined}
      data-on={on ? "" : undefined}
      data-size={size ?? "default"}
      data-slot="led"
      role="img"
    />
  );
}
