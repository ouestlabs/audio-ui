import { type ComponentProps, type RefObject, useEffect, useRef } from "react";
import type { Source } from "@/registry/bases/shared/primitives/primitive";
import { cn } from "@/registry/lib/utils";

/** The two channels of a sound, their latest samples from -1 to 1, and how alike they are: what the field is drawn from. */
export interface StereoFieldFrame {
  /** How alike the channels are, from -1 to 1. */
  correlation: number;
  left: ArrayLike<number>;
  right: ArrayLike<number>;
  /** Both channels silent: nothing is drawn and the correlation is not read. */
  silent: boolean;
}

/** How often the correlation is announced, in steps of the -1 to 1 scale. */
const ANNOUNCED_STEP = 0.1;
/** The quietest level the field is scaled up to fill, as an amplitude: under it, a sound stays small. */
const QUIETEST_FILLED = 0.02;
/** How much of its reach the scale keeps each frame once the sound gets quieter: it rises at once and settles over about a second. */
const SCALE_FALLBACK = 0.97;

/** The loudest sample of either channel. */
function loudestOf(left: ArrayLike<number>, right: ArrayLike<number>) {
  const count = Math.min(left.length, right.length);
  let loudest = 0;
  for (let index = 0; index < count; index += 1) {
    loudest = Math.max(
      loudest,
      Math.abs(left[index] as number),
      Math.abs(right[index] as number)
    );
  }
  return loudest;
}

interface StereoPainter {
  canvas: RefObject<HTMLCanvasElement | null>;
  /** Moved along the meter to the correlation, hidden in silence. */
  marker?: RefObject<HTMLElement | null>;
  /** The correlation as an ARIA meter, its value announced in steps. */
  meter: RefObject<HTMLElement | null>;
  /** How opaque each dot is. */
  opacity: number;
  /** The correlation as figures, its text node written in place. */
  readout: RefObject<HTMLElement | null>;
  source: Source<StereoFieldFrame>;
}

/**
 * Paints a source's stereo samples on a canvas, each time it changes and
 * without a React render: a dot per pair of samples, the sum up the middle and
 * the difference across, scaled to the loudest of the last moments, and the
 * correlation written where it is read. The color is the canvas's own, read
 * again when it is resized or the theme changes, never per frame.
 */
function useStereoPainter({
  canvas: canvasRef,
  marker: markerRef,
  meter: meterRef,
  opacity,
  readout: readoutRef,
  source,
}: StereoPainter) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const meter = meterRef.current;
    const marker = markerRef?.current;
    // One text node, its data written in place: no new node per frame.
    const readout = readoutRef.current?.firstChild as Text | null;
    if (!(canvas && context && meter && readout)) {
      return;
    }
    let color = "";
    let ratio = 1;
    let announced = Number.NaN;
    let reach = QUIETEST_FILLED;
    const paint = () => {
      const { correlation, left, right, silent } = source.getSnapshot();
      const { height, width } = canvas;
      context.clearRect(0, 0, width, height);
      if (marker) {
        marker.hidden = silent;
      }
      readout.data = silent ? "" : correlation.toFixed(2);
      if (silent) {
        return;
      }
      reach = Math.max(
        loudestOf(left, right),
        reach * SCALE_FALLBACK,
        QUIETEST_FILLED
      );
      // A mono sound at the loudest sample of the moment reaches the edge: the two sides summed, it stands that much taller than either.
      const spread = Math.min(width, height) / 2 / (reach * Math.SQRT2);
      const dot = Math.max(1, Math.round(ratio));
      context.fillStyle = color;
      context.globalAlpha = opacity;
      const count = Math.min(left.length, right.length);
      for (let index = 0; index < count; index += 1) {
        const l = left[index] as number;
        const r = right[index] as number;
        // The left and right axes turned 45 degrees: the sum up the middle, the difference across.
        const x = width / 2 + (r - l) * Math.SQRT1_2 * spread;
        const y = height / 2 - (l + r) * Math.SQRT1_2 * spread;
        context.fillRect(x, y, dot, dot);
      }
      if (marker) {
        marker.style.insetInlineStart = `${(correlation + 1) * 50}%`;
      }
      const step = Math.round(correlation / ANNOUNCED_STEP) * ANNOUNCED_STEP;
      if (step !== announced) {
        announced = step;
        meter.setAttribute("aria-valuenow", step.toFixed(1));
      }
    };
    const measure = () => {
      const { devicePixelRatio } = window;
      const { clientHeight, clientWidth } = canvas;
      ratio = devicePixelRatio || 1;
      canvas.width = Math.round(clientWidth * ratio);
      canvas.height = Math.round(clientHeight * ratio);
      ({ color } = getComputedStyle(canvas));
      paint();
    };
    const resize = new ResizeObserver(measure);
    resize.observe(canvas);
    // The theme may change the color: read it again, never per frame.
    const theme = new MutationObserver(measure);
    theme.observe(document.documentElement, {
      attributeFilter: ["class", "style", "data-theme"],
    });
    measure();
    const stop = source.subscribe(paint);
    return () => {
      stop();
      resize.disconnect();
      theme.disconnect();
    };
  }, [canvasRef, markerRef, meterRef, opacity, readoutRef, source]);
}

interface StereoFieldProps extends Omit<ComponentProps<"div">, "children"> {
  /** The live samples, such as the `stereo` of a point of a device's signal. */
  source: Source<StereoFieldFrame>;
}

/**
 * Where a sound sits between the speakers, live: each pair of samples is a
 * dot, the sound both sides share up the middle and what differs between them
 * out to the left and the right. A mono sound stands as a vertical line, a
 * wide one spreads into a cloud, and one that cancels in mono lies flat. The
 * field is scaled to the loudest of the last moments, as a goniometer's gain
 * control does, so its shape reads at any level. Under it, how alike the two
 * sides are, from -1 to 1. It is painted on a canvas each time the source
 * changes, without a React render. Give it a width: it is square.
 */
export function StereoField({ className, source, ...props }: StereoFieldProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  useStereoPainter({ canvas, marker, meter, opacity: 0.55, readout, source });

  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-slot="stereo-field"
      {...props}
    >
      <div className="cn-plot relative aspect-square w-full overflow-hidden">
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full stroke-border"
          preserveAspectRatio="none"
          viewBox="0 0 2 2"
        >
          {/* The middle, where a mono sound stands, and the two speakers' own axes. */}
          <line vectorEffect="non-scaling-stroke" x1="1" x2="1" y1="0" y2="2" />
          <line vectorEffect="non-scaling-stroke" x1="0" x2="2" y1="0" y2="2" />
          <line vectorEffect="non-scaling-stroke" x1="2" x2="0" y1="0" y2="2" />
        </svg>
        <canvas
          aria-label="Stereo field"
          className="cn-plot-graph absolute inset-0 size-full"
          ref={canvas}
          role="img"
        />
      </div>
      <div
        aria-label="Correlation"
        aria-valuemax={1}
        aria-valuemin={-1}
        aria-valuenow={0}
        className="relative h-1.5 rounded-full bg-input/70"
        ref={meter}
        role="meter"
      >
        <span
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-primary rtl:translate-x-1/2"
          hidden
          ref={marker}
          style={{ insetInlineStart: "50%" }}
        />
      </div>
      <div
        aria-hidden="true"
        className="grid grid-cols-3 text-[10px] text-muted-foreground tabular-nums"
      >
        <span>-1</span>
        <span className="text-center text-foreground" ref={readout}>
          {" "}
        </span>
        <span className="text-end">+1</span>
      </div>
    </div>
  );
}

interface StereoFieldLayerProps
  extends Omit<ComponentProps<"div">, "children"> {
  /** The live samples, such as the `stereo` of a point of a device's signal. */
  source: Source<StereoFieldFrame>;
}

/**
 * The stereo field as a layer of another surface, such as a device's plot:
 * it fills the surface, under what is drawn on it and taking no pointer, its
 * dots fainter than the full field's, and the correlation, from -1 to 1, as
 * figures in its corner. Put it first in a `Plot`, so the plot's curve and
 * handles stay on top.
 */
export function StereoFieldLayer({
  className,
  source,
  ...props
}: StereoFieldLayerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  useStereoPainter({
    canvas,
    meter,
    opacity: 0.35,
    readout: meter,
    source,
  });

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className
      )}
      data-slot="stereo-field-layer"
      {...props}
    >
      <canvas
        aria-label="Stereo field"
        className="cn-plot-graph absolute inset-0 size-full"
        ref={canvas}
        role="img"
      />
      <span
        aria-label="Correlation"
        aria-valuemax={1}
        aria-valuemin={-1}
        aria-valuenow={0}
        className="absolute end-1.5 top-1 text-[10px] text-muted-foreground tabular-nums"
        ref={meter}
        role="meter"
      >
        {" "}
      </span>
    </div>
  );
}
