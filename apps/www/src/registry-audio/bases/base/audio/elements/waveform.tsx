"use client";

import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import { cn } from "@/registry/bases/base/lib/utils";

type WaveformProps = Omit<WaveformPrimitive.Root.Props, "peaks"> &
  Pick<WaveformPrimitive.Control.Props, "getAriaValueText"> & {
    /** Amplitudes of the audio, 0-1 each, at any resolution. */
    values: ArrayLike<number>;
    variant?: "default" | "playhead";
  };

function Waveform({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  getAriaValueText,
  values,
  variant = "default",
  ...props
}: WaveformProps) {
  return (
    <WaveformPrimitive.Root
      className="w-full min-w-0 data-disabled:cursor-not-allowed"
      peaks={values}
      {...props}
    >
      <WaveformPrimitive.Control
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          "cn-waveform relative w-full min-w-0 cursor-pointer touch-none select-none overflow-hidden py-1",
          "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          "data-disabled:pointer-events-none data-disabled:opacity-50",
          className
        )}
        data-slot="waveform"
        getAriaValueText={getAriaValueText}
      >
        <WaveformPrimitive.Canvas className="cn-waveform-canvas block size-full [-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]" />
        {variant === "playhead" ? (
          <>
            <WaveformPrimitive.Playhead className="cn-waveform-playhead" />
            <WaveformPrimitive.Thumb className="cn-waveform-thumb" />
          </>
        ) : null}
      </WaveformPrimitive.Control>
    </WaveformPrimitive.Root>
  );
}

export { Waveform };
