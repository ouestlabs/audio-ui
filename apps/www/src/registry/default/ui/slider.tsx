import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/registry/default/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  let _values = [min, max];

  if (Array.isArray(defaultValue)) {
    _values = defaultValue;
  }

  if (Array.isArray(value)) {
    _values = value;
  }

  return (
    <SliderPrimitive.Root
      className={cn("data-vertical:h-full data-horizontal:w-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      thumbAlignment="edge"
      value={value}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none select-none items-center data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col data-disabled:opacity-50">
        <SliderPrimitive.Track
          className="relative grow select-none overflow-hidden rounded-full bg-input/90 data-horizontal:h-2 data-vertical:h-full data-horizontal:w-full data-vertical:w-2"
          data-slot="slider-track"
        >
          <SliderPrimitive.Indicator
            className="select-none bg-primary data-horizontal:h-full data-vertical:w-full"
            data-slot="slider-range"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            className="block h-4 w-6 shrink-0 select-none rounded-full bg-white not-dark:bg-clip-padding shadow-md ring-1 ring-black/10 transition-[color,box-shadow,background-color] hover:ring-4 hover:ring-ring/30 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 data-vertical:h-6 data-vertical:w-4"
            data-slot="slider-thumb"
            key={String(index)}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
