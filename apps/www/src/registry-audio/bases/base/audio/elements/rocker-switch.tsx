"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

const rockerSwitchVariants = cva(
  "cn-rocker-switch group/rocker inline-flex shrink-0 gap-0.5",
  {
    compoundVariants: [
      {
        className: "h-14 w-8 text-[0.6875rem]",
        orientation: "vertical",
        size: "default",
      },
      {
        className: "h-10 w-6 text-[0.5625rem]",
        orientation: "vertical",
        size: "sm",
      },
      {
        className: "h-8 w-14 text-[0.6875rem]",
        orientation: "horizontal",
        size: "default",
      },
      {
        className: "h-6 w-10 text-[0.5625rem]",
        orientation: "horizontal",
        size: "sm",
      },
    ],
    defaultVariants: { orientation: "vertical", size: "default" },
    variants: {
      /** Stood up, on at the top, or laid down, on at the right. */
      orientation: {
        horizontal: "flex-row-reverse",
        vertical: "flex-col",
      },
      size: {
        default: "",
        sm: "",
      },
    },
  }
);

export interface RockerSwitchProps
  extends Omit<SwitchPrimitive.Root.Props, "children" | "className">,
    VariantProps<typeof rockerSwitchVariants> {
  className?: string;
  /** What the off side reads. @default "O" */
  offLabel?: ReactNode;
  /** What the on side reads. @default "I" */
  onLabel?: ReactNode;
}

/**
 * A rocker, as on a mixer's or a synth's panel: two sides, the one pressed
 * down sunk into the panel. A switch underneath, with its role, its keyboard
 * (Space) and its form value; name it with `aria-label`.
 */
export function RockerSwitch({
  className,
  offLabel = "O",
  onLabel = "I",
  orientation,
  size,
  ...props
}: RockerSwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(rockerSwitchVariants({ orientation, size }), className)}
      data-orientation={orientation ?? "vertical"}
      data-size={size ?? "default"}
      data-slot="rocker-switch"
      {...props}
    >
      <span
        aria-hidden="true"
        className="cn-rocker-switch-side cn-rocker-switch-on flex flex-1 items-center justify-center"
        data-slot="rocker-switch-on"
      >
        {onLabel}
      </span>
      <span
        aria-hidden="true"
        className="cn-rocker-switch-side cn-rocker-switch-off flex flex-1 items-center justify-center"
        data-slot="rocker-switch-off"
      >
        {offLabel}
      </span>
    </SwitchPrimitive.Root>
  );
}
