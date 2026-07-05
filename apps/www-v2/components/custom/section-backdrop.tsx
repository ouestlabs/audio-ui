import { cn } from "@/lib/utils";
import { PixelBlast } from "./pixel-blast";

const MASK_VARIANTS = {
  default:
    "mask-[radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]",
  separator:
    "mask-[radial-gradient(ellipse_80%_50%_at_50%_50%,#000_50%,transparent_100%)]",
} as const;

export interface SectionBackdropProps {
  variant?: keyof typeof MASK_VARIANTS;
  opacity?: number;
  className?: string;
}

/**
 * Diagonal stripe background for hero sections.
 */
export function SectionBackdrop({
  variant = "default",
  className,
}: SectionBackdropProps) {
  const inset = variant === "separator" ? "inset-0" : "-inset-x-6 inset-y-0";

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-0",
        inset,
        MASK_VARIANTS[variant],
        className
      )}
    >
      <PixelBlast
        enableRipples
        pixelSize={5}
        pixelSizeJitter={0.5}
        rippleIntensityScale={1.5}
        rippleSpeed={0.5}
        speed={0.6}
        transparent
        variant="square"
      />
    </div>
  );
}
