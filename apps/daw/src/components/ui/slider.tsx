import {
  SliderControl,
  SliderIndicator,
  Slider as SliderPrimitive,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function thumbCount(value: unknown, defaultValue: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (Array.isArray(defaultValue)) {
    return defaultValue.length;
  }
  return 2;
}

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueCommitted,
  ...props
}: ComponentProps<typeof SliderPrimitive> & {
  // The shadcn name for `onValueCommit`.
  onValueCommitted?: ComponentProps<typeof SliderPrimitive>["onValueCommit"];
}) {
  const thumbs = Array.from(
    { length: thumbCount(value, defaultValue) },
    (_, index) => index
  );

  return (
    <SliderPrimitive
      className={cn(
        "data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        className
      )}
      defaultValue={defaultValue}
      max={max}
      min={min}
      onValueCommit={onValueCommitted}
      value={value}
      {...props}
    >
      <SliderControl className="data-[orientation=vertical]:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col">
        <SliderTrack className="bg-muted rounded-full data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1 relative grow overflow-hidden select-none">
          <SliderIndicator className="bg-primary select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full" />
        </SliderTrack>
        {thumbs.map((thumb) => (
          <SliderThumb
            className="border-ring ring-ring/50 relative size-3 rounded-full border bg-white transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
            index={thumb}
            key={thumb}
          />
        ))}
      </SliderControl>
    </SliderPrimitive>
  );
}

export { Slider };