import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const ledVariants = cva("rounded-full bg-muted-foreground/25 shadow-inner transition-[background-color,box-shadow] duration-100 data-on:bg-current data-on:shadow-[0_0_0.375rem_currentColor] data-blink:data-on:animate-pulse motion-reduce:transition-none motion-reduce:data-blink:data-on:animate-none inline-block shrink-0", {
  defaultVariants: {
    size: "default",
    tone: "primary",
  },
  variants: {
    size: {
      default: "size-2",
      lg: "size-3",
      sm: "size-1.5",
    },
    /** Its color when lit: the theme's primary, or destructive for recording and clipping. */
    tone: {
      destructive: "text-destructive",
      primary: "text-primary",
    },
  },
});

export interface LedProps extends VariantProps<typeof ledVariants> {
  /** Hides it from assistive technology, where what holds it already says its state: a button's pressed state. */
  "aria-hidden"?: boolean;
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
  "aria-hidden": hidden,
  blink = false,
  className,
  label,
  on,
  size,
  tone,
}: LedProps) {
  return (
    <span
      aria-hidden={hidden || undefined}
      aria-label={hidden ? undefined : `${label}: ${on ? "on" : "off"}`}
      className={cn(ledVariants({ size, tone }), className)}
      data-blink={blink ? "" : undefined}
      data-on={on ? "" : undefined}
      data-size={size ?? "default"}
      data-slot="led"
      role={hidden ? undefined : "img"}
    />
  );
}