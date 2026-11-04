import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const lcdVariants = cva("cn-lcd inline-flex min-w-0 flex-col justify-center", {
  defaultVariants: { size: "default" },
  variants: {
    /** "sm" for a single line in a dense panel. */
    size: {
      default: "cn-lcd-size-default",
      sm: "cn-lcd-size-sm",
    },
  },
});

export interface LcdProps extends VariantProps<typeof lcdVariants> {
  children: ReactNode;
  className?: string;
  /** A small caption over the reading: the parameter's or the preset's name. */
  label?: ReactNode;
  /** Announces changes politely, for a reading that matters as it changes. @default false */
  live?: boolean;
}

/**
 * A small screen, as on a synth or a drum machine: the theme's foreground as
 * its glass and its background as the lit figures, so it reads as a screen
 * in light and dark alike. Holds a reading (a `ValueDisplay`, a preset's
 * name) under an optional caption.
 */
export function Lcd({
  children,
  className,
  label,
  live = false,
  size,
}: LcdProps) {
  return (
    <div
      aria-live={live ? "polite" : undefined}
      className={cn(lcdVariants({ size }), className)}
      data-size={size ?? "default"}
      data-slot="lcd"
    >
      {label ? (
        <span className="cn-lcd-label truncate" data-slot="lcd-label">
          {label}
        </span>
      ) : null}
      <span className="truncate" data-slot="lcd-reading">
        {children}
      </span>
    </div>
  );
}
