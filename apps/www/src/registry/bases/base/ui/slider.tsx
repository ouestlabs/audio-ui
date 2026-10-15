import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/registry/bases/base/lib/utils";

/** How many thumbs the slider has: one per value, or a range of two. */
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
  ...props
}: SliderPrimitive.Root.Props) {
  // A thumb is known by its place: the first, the second.
  const thumbs = Array.from(
    { length: thumbCount(value, defaultValue) },
    (_, index) => index
  );

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control className="cn-slider relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          className="cn-slider-track relative grow overflow-hidden select-none"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className="cn-slider-range select-none data-horizontal:h-full data-vertical:w-full"
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {thumbs.map((thumb) => (
          <SliderPrimitive.Thumb
            className="cn-slider-thumb block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
            data-slot="slider-thumb"
            index={thumb}
            key={thumb}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
