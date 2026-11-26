import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { cn } from "@/registry/lib/utils";
import { Waveform as WaveformPrimitive } from "@/registry/primitives/waveform/react";

/** Fades the canvas out at both ends, so bars don't stop on a hard edge. */
const EDGE_FADE =
  "[-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] mask-[linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]";

const HANDLE =
  "cn-waveform-region-handle pointer-events-auto absolute inset-y-0 w-1.5 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0 after:absolute after:-inset-x-1.5 after:inset-y-0 pointer-coarse:after:-inset-x-3";

/**
 * How each part of the waveform is drawn, by its `data-slot`. A part's look
 * follows its attributes, never the waveform's props: the React waveform
 * applies these classes, and `registry:build` writes them as plain CSS on the
 * parts for every other framework. The root carries `data-outside` while the
 * playhead is out of view; a region's handle its `data-edge`.
 */
export const waveformParts = Object.freeze({
  waveform: "group/waveform w-full min-w-0 data-disabled:cursor-not-allowed",
  "waveform-control":
    "cn-waveform relative w-full min-w-0 cursor-pointer touch-none select-none overflow-hidden py-1 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 data-disabled:pointer-events-none data-disabled:opacity-50 data-loading:cursor-progress",
  "waveform-canvas": `cn-waveform-canvas block size-full ${EDGE_FADE}`,
  "waveform-playhead":
    "cn-waveform-playhead group-data-outside/waveform:hidden",
  "waveform-thumb": "cn-waveform-thumb group-data-outside/waveform:hidden",
  "waveform-region": "cn-waveform-region pointer-events-none inset-y-0",
  "waveform-region-start": HANDLE,
  "waveform-region-end": HANDLE,
  "waveform-marker": "cn-waveform-marker pointer-events-none inset-y-0 w-px",
  "waveform-marker-label":
    "cn-waveform-marker-label absolute top-0 left-1 whitespace-nowrap",
  "waveform-hover":
    "cn-waveform-hover pointer-events-none inset-y-0 z-10 w-px indent-1 whitespace-nowrap",
});

type RootProps = ComponentProps<typeof WaveformPrimitive.Root>;
type CanvasProps = ComponentProps<typeof WaveformPrimitive.Canvas>;
type RegionCallbacks = Pick<RootProps, "onRegionChange" | "onRegionCommitted">;

/** What a region part reads: the regions' callbacks, and the name of the region it is in. */
const RegionHandlers = createContext<RefObject<
  Map<string, RegionCallbacks>
> | null>(null);
const RegionName = createContext<string | null>(null);

type LiveWaveformShape = NonNullable<CanvasProps["variant"]>;
/** A file is drawn from its levels: the raw trace is for live samples. */
type WaveformShape = Exclude<LiveWaveformShape, "scope">;

type WaveformProps = Omit<RootProps, "children" | "levels" | "peaks"> &
  Pick<ComponentProps<typeof WaveformPrimitive.Control>, "getAriaValueText"> &
  Pick<CanvasProps, "barGap" | "barWidth"> & {
    children?: ReactNode;
    /** How the amplitudes are drawn. */
    shape?: WaveformShape;
    /** The audio's shape, at any resolution: amplitudes (0-1), or `{ min, max }` samples (-1-1) per slice. */
    values: RootProps["peaks"];
    variant?: "default" | "playhead";
  };

function Waveform({
  "aria-describedby": ariaDescribedBy,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  barGap,
  barWidth,
  children,
  className,
  getAriaValueText,
  onRegionChange,
  onRegionCommitted,
  shape,
  values,
  variant = "default",
  ...props
}: WaveformProps) {
  const regions = useRef(new Map<string, RegionCallbacks>());
  // A region hears its own changes through its props; the waveform hears all of them.
  const changeRegion = useCallback<NonNullable<RootProps["onRegionChange"]>>(
    (value, details) => {
      regions.current.get(details.region)?.onRegionChange?.(value, details);
      onRegionChange?.(value, details);
    },
    [onRegionChange]
  );
  const commitRegion = useCallback<NonNullable<RootProps["onRegionCommitted"]>>(
    (value, details) => {
      regions.current.get(details.region)?.onRegionCommitted?.(value, details);
      onRegionCommitted?.(value, details);
    },
    [onRegionCommitted]
  );
  return (
    <RegionHandlers value={regions}>
      <WaveformPrimitive.Root
        className={waveformParts.waveform}
        data-slot="waveform"
        onRegionChange={changeRegion}
        onRegionCommitted={commitRegion}
        peaks={values}
        {...props}
      >
        <WaveformPrimitive.Control
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(waveformParts["waveform-control"], className)}
          data-slot="waveform-control"
          getAriaValueText={getAriaValueText}
        >
          <WaveformPrimitive.Canvas
            barGap={barGap}
            barWidth={barWidth}
            className={waveformParts["waveform-canvas"]}
            variant={shape}
          />
          {children}
          {variant === "playhead" ? (
            <>
              <WaveformPrimitive.Playhead
                className={waveformParts["waveform-playhead"]}
              />
              <WaveformPrimitive.Thumb
                className={waveformParts["waveform-thumb"]}
              />
            </>
          ) : null}
        </WaveformPrimitive.Control>
      </WaveformPrimitive.Root>
    </RegionHandlers>
  );
}

type WaveformRegionProps = Omit<
  ComponentProps<typeof WaveformPrimitive.Region>,
  "region"
> & {
  /** The region's name, in what the waveform reports. Defaults to one of its own. */
  region?: string;
  /** A move or a resize, as `[start, end]`. */
  onValueChange?: RegionCallbacks["onRegionChange"];
  onValueCommitted?: RegionCallbacks["onRegionCommitted"];
};

/** A stretch of the audio, `[start, end]`, with handles to move and resize it. */
function WaveformRegion({
  className,
  onValueChange,
  onValueCommitted,
  region,
  ...props
}: WaveformRegionProps) {
  const own = useId();
  const name = region ?? own;
  const regions = use(RegionHandlers);
  useEffect(() => {
    const handlers = regions?.current;
    handlers?.set(name, {
      onRegionChange: onValueChange,
      onRegionCommitted: onValueCommitted,
    });
    return () => {
      handlers?.delete(name);
    };
  }, [name, onValueChange, onValueCommitted, regions]);
  return (
    <RegionName value={name}>
      <WaveformPrimitive.Region
        className={cn(waveformParts["waveform-region"], className)}
        data-slot="waveform-region"
        region={name}
        {...props}
      />
    </RegionName>
  );
}

function WaveformRegionHandle({
  className,
  ...props
}: Omit<ComponentProps<typeof WaveformPrimitive.RegionHandle>, "region">) {
  const region = use(RegionName);
  return (
    <WaveformPrimitive.RegionHandle
      className={cn(HANDLE, className)}
      region={region ?? ""}
      {...props}
    />
  );
}

function WaveformMarker({
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof WaveformPrimitive.Marker>, "children"> & {
  children?: ReactNode;
}) {
  return (
    <WaveformPrimitive.Marker
      className={cn(waveformParts["waveform-marker"], className)}
      data-slot="waveform-marker"
      {...props}
    >
      {children ? (
        <span
          className={waveformParts["waveform-marker-label"]}
          data-slot="waveform-marker-label"
        >
          {children}
        </span>
      ) : null}
    </WaveformPrimitive.Marker>
  );
}

/** A line under the pointer, with its position written beside it by `format`: left out, only the line shows. */
function WaveformHover({
  className,
  ...props
}: ComponentProps<typeof WaveformPrimitive.Hover>) {
  return (
    <WaveformPrimitive.Hover
      className={cn(waveformParts["waveform-hover"], className)}
      data-slot="waveform-hover"
      {...props}
    />
  );
}

type LiveWaveformProps = Omit<
  ComponentProps<"div">,
  "children" | "defaultValue"
> &
  Pick<CanvasProps, "gain" | "idle" | "mirrored" | "mode" | "scrollSpeed"> & {
    /** Shows a sweep while the signal is on its way. */
    loading?: boolean;
    /** How the signal is drawn. `scope` traces raw samples instead of levels. */
    shape?: LiveWaveformShape;
    /** A live signal, such as `useAudioSignal(analyser).level` to scroll, `.bands` to dance or `.samples` for a scope. */
    source?: RootProps["levels"] | null;
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
    ComponentProps<typeof WaveformPrimitive.Bars>,
    "count" | "gain" | "idle" | "minLevel" | "mirrored"
  > & {
    /** Where the bars grow from. */
    align?: "center" | "end" | "start";
    /** Shows a sweep while the signal is on its way. */
    loading?: boolean;
    orientation?: "horizontal" | "vertical";
    /** A live signal, such as `useAudioSignal(analyser).bands`. */
    source?: RootProps["levels"] | null;
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
