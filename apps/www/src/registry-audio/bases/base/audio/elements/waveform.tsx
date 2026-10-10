"use client";

import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import type { ComponentProps } from "react";
import { cn } from "@/registry/bases/base/lib/utils";

/** Fades the canvas out at both ends, so bars don't stop on a hard edge. */
const EDGE_FADE =
  "[-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]";

type LiveWaveformShape = NonNullable<WaveformPrimitive.Canvas.Props["variant"]>;
/** A file is drawn from its levels: the raw trace is for live samples. */
type WaveformShape = Exclude<LiveWaveformShape, "scope">;

type WaveformProps = Omit<WaveformPrimitive.Root.Props, "levels" | "peaks"> &
  Pick<WaveformPrimitive.Control.Props, "getAriaValueText"> & {
    /** How the amplitudes are drawn. */
    shape?: WaveformShape;
    /** Amplitudes of the audio, 0-1 each, at any resolution. */
    values: ArrayLike<number>;
    variant?: "default" | "playhead";
  };

function Waveform({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  className,
  getAriaValueText,
  shape,
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
          "data-disabled:pointer-events-none data-disabled:opacity-50 data-loading:cursor-progress",
          className
        )}
        data-slot="waveform"
        getAriaValueText={getAriaValueText}
      >
        <WaveformPrimitive.Canvas
          className={cn("cn-waveform-canvas block size-full", EDGE_FADE)}
          variant={shape}
        />
        {children}
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

function WaveformRegion({
  className,
  ...props
}: WaveformPrimitive.Region.Props) {
  return (
    <WaveformPrimitive.Region
      className={cn(
        "cn-waveform-region inset-y-0 cursor-grab data-dragging:cursor-grabbing data-disabled:cursor-not-allowed",
        className
      )}
      data-slot="waveform-region"
      {...props}
    />
  );
}

function WaveformRegionHandle({
  className,
  ...props
}: WaveformPrimitive.RegionHandle.Props) {
  return (
    <WaveformPrimitive.RegionHandle
      className={cn(
        "cn-waveform-region-handle absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0",
        "after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3",
        className
      )}
      data-slot="waveform-region-handle"
      {...props}
    />
  );
}

function WaveformMarker({
  children,
  className,
  ...props
}: WaveformPrimitive.Marker.Props) {
  return (
    <WaveformPrimitive.Marker
      className={cn(
        "cn-waveform-marker pointer-events-none inset-y-0 w-px",
        className
      )}
      data-slot="waveform-marker"
      {...props}
    >
      {children ? (
        <span className="cn-waveform-marker-label absolute top-0 left-1 whitespace-nowrap">
          {children}
        </span>
      ) : null}
    </WaveformPrimitive.Marker>
  );
}

type WaveformHoverProps = Omit<WaveformPrimitive.Hover.Props, "children"> & {
  /** Prints the hovered position, e.g. as a time. Left out, only the line shows. */
  format?: (value: number) => string;
};

function WaveformHover({ className, format, ...props }: WaveformHoverProps) {
  const label = format
    ? (value: number) => (
        <span className="cn-waveform-hover-label absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {format(value)}
        </span>
      )
    : undefined;
  return (
    <WaveformPrimitive.Hover
      className={cn(
        "cn-waveform-hover pointer-events-none inset-y-0 w-px",
        className
      )}
      data-slot="waveform-hover"
      {...props}
    >
      {label}
    </WaveformPrimitive.Hover>
  );
}

type LiveWaveformProps = Omit<
  ComponentProps<"div">,
  "children" | "defaultValue"
> &
  Pick<
    WaveformPrimitive.Canvas.Props,
    "gain" | "idle" | "mirrored" | "mode" | "scrollSpeed"
  > & {
    /** Shows a sweep while the signal is on its way. */
    loading?: boolean;
    /** How the signal is drawn. `scope` traces raw samples instead of levels. */
    shape?: LiveWaveformShape;
    /** A live signal, such as `useAudioSignal(analyser).level` to scroll, `.bands` to dance or `.samples` for a scope. */
    source?: WaveformPrimitive.Root.Levels | null;
  };

function LiveWaveform({
  className,
  gain,
  idle,
  loading,
  mirrored,
  mode,
  scrollSpeed,
  shape,
  source,
  ...props
}: LiveWaveformProps) {
  return (
    <WaveformPrimitive.Root
      className={cn("cn-live-waveform relative w-full min-w-0", className)}
      data-slot="live-waveform"
      levels={source ?? undefined}
      loading={loading}
      role="img"
      {...props}
    >
      <WaveformPrimitive.Canvas
        className={cn("cn-live-waveform-canvas block size-full", EDGE_FADE)}
        gain={gain}
        idle={idle}
        mirrored={mirrored}
        mode={mode}
        scrollSpeed={scrollSpeed}
        variant={shape}
      />
    </WaveformPrimitive.Root>
  );
}

type BarVisualizerProps = Omit<
  ComponentProps<"div">,
  "children" | "defaultValue"
> &
  Pick<
    WaveformPrimitive.Bars.Props,
    "count" | "gain" | "idle" | "minLevel" | "mirrored"
  > & {
    /** Where the bars grow from. */
    align?: "center" | "end" | "start";
    /** Shows a sweep while the signal is on its way. */
    loading?: boolean;
    orientation?: "horizontal" | "vertical";
    /** A live signal, such as `useAudioSignal(analyser).bands`. */
    source?: WaveformPrimitive.Root.Levels | null;
  };

function BarVisualizer({
  align = "center",
  className,
  count,
  gain,
  idle,
  loading,
  minLevel,
  mirrored,
  orientation = "horizontal",
  source,
  ...props
}: BarVisualizerProps) {
  return (
    <WaveformPrimitive.Root
      className={cn(
        "cn-bar-visualizer min-h-0 min-w-0 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full",
        className
      )}
      data-orientation={orientation}
      data-slot="bar-visualizer"
      levels={source ?? undefined}
      loading={loading}
      role="img"
      {...props}
    >
      <WaveformPrimitive.Bars
        className={cn(
          "cn-bar-visualizer-bars flex size-full justify-center",
          orientation === "vertical" && "flex-col",
          align === "start" && "items-start",
          align === "center" && "items-center",
          align === "end" && "items-end"
        )}
        count={count}
        gain={gain}
        idle={idle}
        minLevel={minLevel}
        mirrored={mirrored}
      >
        {(index) => (
          <WaveformPrimitive.Bar
            className={cn(
              "cn-bar-visualizer-bar min-h-0 min-w-0 flex-1",
              orientation === "vertical"
                ? "max-h-1.5 w-[calc(var(--waveform-level)*100%)]"
                : "h-[calc(var(--waveform-level)*100%)] max-w-1.5"
            )}
            index={index}
            key={index}
          />
        )}
      </WaveformPrimitive.Bars>
    </WaveformPrimitive.Root>
  );
}

export {
  BarVisualizer,
  LiveWaveform,
  Waveform,
  WaveformHover,
  WaveformMarker,
  WaveformRegion,
  WaveformRegionHandle,
};
