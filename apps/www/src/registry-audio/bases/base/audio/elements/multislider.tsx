"use client";

import { Multislider as MultisliderPrimitive } from "@audio-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/registry/bases/base/lib/utils";

const multisliderVariants = cva("", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "cn-multislider-size-default",
      lg: "cn-multislider-size-lg",
      sm: "cn-multislider-size-sm",
      xl: "cn-multislider-size-xl",
    },
  },
});

interface MultisliderProps
  extends MultisliderPrimitive.RootProps,
    VariantProps<typeof multisliderVariants> {
  thumbs?: "visible" | "hidden";
}

export function Multislider({
  className,
  size,
  thumbs = "hidden",
  ...props
}: MultisliderProps) {
  return (
    <MultisliderPrimitive.Root
      className={cn(
        "w-full data-[disabled=true]:cursor-not-allowed",
        className
      )}
      {...props}
    >
      <MultisliderPrimitive.Track
        className={cn(
          "cn-multislider relative flex w-full cursor-crosshair touch-none select-none overflow-hidden",
          "gap-px data-[orientation=horizontal]:flex-col",
          "focus-visible:outline-none",
          "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
          multisliderVariants({ size })
        )}
        data-slot="multislider"
      >
        <MultisliderPrimitive.Sliders>
          {(_value, index) => (
            <MultisliderPrimitive.Slider
              className="cn-multislider-slider relative flex-1 outline-none"
              index={index}
              key={`multislider-slider-${index}`}
            >
              <MultisliderPrimitive.Fill className="cn-multislider-fill absolute inset-0" />
              {thumbs === "visible" ? (
                <MultisliderPrimitive.Thumb className="cn-multislider-thumb absolute data-[orientation=horizontal]:top-0 data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:w-0.5 data-[orientation=vertical]:right-0 data-[orientation=vertical]:left-0 data-[orientation=vertical]:h-0.5" />
              ) : null}
            </MultisliderPrimitive.Slider>
          )}
        </MultisliderPrimitive.Sliders>
      </MultisliderPrimitive.Track>
    </MultisliderPrimitive.Root>
  );
}
