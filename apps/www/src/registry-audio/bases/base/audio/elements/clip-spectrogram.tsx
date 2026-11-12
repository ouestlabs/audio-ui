import { formatFrequency, formatLevel } from "@audio-ui/engine/format";
import type Spectrogram from "gl-spectrogram";
import type { Axis, Cell, Scale } from "gl-spectrogram";
import {
  type ComponentProps,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type ClipReading,
  clipFramePositions,
} from "@/registry-audio/bases/base/lib/arrangement";

/** The frequency axes a spectrogram is spaced on: octaves, mel, equal space per auditory filter, or hertz. */
export type SpectrogramScale = Scale;

/** The pixels drawn past each edge of the view, so a scroll shows them at once. */
const OVERSCAN = 256;
const THEME_ATTRIBUTES = ["class", "data-theme", "style"];

const TRANSPARENT = /^(transparent|rgba?\([^)]*,\s*0\))$/;

/** The nearest background that is not transparent, from `element` up: what the spectrogram's silence lies over. */
function groundOf(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const { backgroundColor } = getComputedStyle(node);
    if (!TRANSPARENT.test(backgroundColor)) {
      return backgroundColor;
    }
  }
  return "white";
}

/**
 * Sizes the canvas to the stretch of its box the view shows, and gives that
 * stretch as shares of the box from 0 to 1, or hides it when none shows.
 */
function place(
  canvas: HTMLCanvasElement,
  body: HTMLElement,
  view: HTMLElement | null
): { from: number; ratio: number; to: number } | null {
  const box = body.getBoundingClientRect();
  const sees =
    view?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const from = Math.max(0, sees.left - box.left - OVERSCAN);
  const to = Math.min(box.width, sees.right - box.left + OVERSCAN);
  if (to <= from) {
    canvas.style.display = "none";
    return null;
  }
  canvas.style.display = "";
  canvas.style.left = `${from}px`;
  canvas.style.width = `${to - from}px`;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round((to - from) * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  return { from: from / box.width, ratio, to: to / box.width };
}

/** What a spectrogram keeps between paints: its renderer once made, and whether it is let go. */
interface Held {
  gone: boolean;
  paints: number;
  renderer: Spectrogram | null;
}

/** What one paint draws. */
interface Paint {
  clip: ClipReading;
  gain: number;
  sampleRate: number;
  samples: SpectrogramSamples;
  scale: SpectrogramScale;
}

/** The recording's samples, mixed to one. */
interface SpectrogramSamples {
  frames: number;
  read: (
    from: number,
    to: number
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
}

/** Draws the stretch of the clip the view shows, unless a later paint has begun or the element is gone. */
async function paintSpectrogram(
  canvas: HTMLCanvasElement,
  body: HTMLElement,
  view: HTMLElement | null,
  held: Held,
  { clip, gain, sampleRate, samples, scale }: Paint
): Promise<boolean> {
  held.paints += 1;
  const paint = held.paints;
  const placed = sampleRate > 0 ? place(canvas, body, view) : null;
  if (!placed) {
    return false;
  }
  const { length } = clip.value;
  const [start = 0, end = 0] = clipFramePositions(clip, samples.frames, 1, [
    placed.from * length,
    placed.to * length,
  ]);
  const data = await samples.read(0, samples.frames);
  if (!held.renderer) {
    const { default: Renderer } = await import("gl-spectrogram");
    if (held.gone || paint !== held.paints) {
      return false;
    }
    try {
      held.renderer = new Renderer(canvas, { data, sampleRate });
    } catch {
      canvas.style.display = "none";
      return false;
    }
  }
  if (held.gone || paint !== held.paints) {
    return false;
  }
  held.renderer
    .update({
      background: groundOf(body),
      color: getComputedStyle(canvas).color,
      data,
      gain,
      pixelRatio: placed.ratio,
      range: [Math.min(start, end), Math.max(start, end)],
      sampleRate,
      scale,
    })
    .clear()
    .render();
  return held.renderer.pending;
}

/**
 * A clip's recording as a spectrogram across the element it lies in: its
 * frequencies over the stretch of the clip the view shows, computed on the
 * GPU by `gl-spectrogram` at every zoom, in the text colour over the ground
 * under it. Place it as `ClipWaveform` is placed, with `className`; `scale`
 * is the frequency axis and `gain` a level to preview. A reversed, looped or
 * warped clip is drawn from its source in order. It needs WebGL 2, and draws
 * nothing without it.
 */
function ClipSpectrogram({
  className,
  clip,
  gain = 1,
  sampleRate,
  samples,
  scale = "log",
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  clip: ClipReading;
  /** A gain factor on the picture, as a clip's level plays. @default 1 */
  gain?: number;
  /** The recording's sample rate, in hertz. */
  sampleRate: number;
  /** The recording's samples, mixed to one. */
  samples: SpectrogramSamples;
  scale?: SpectrogramScale;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const body = canvas?.parentElement;
    if (!(canvas && body)) {
      return;
    }
    const view = canvas.closest<HTMLElement>('[data-slot="timeline-viewport"]');
    const held: Held = { gone: false, paints: 0, renderer: null };
    // The cell under the pointer: its frequency and level, read where the picture is drawn.
    const moved = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const cell =
        x >= 0 && y >= 0 && x <= box.width && y <= box.height
          ? (held.renderer?.pick(x, y) ?? null)
          : null;
      const own = body.getBoundingClientRect();
      setReading(
        cell
          ? {
              left: event.clientX - own.left,
              text: readingOf(cell, held.renderer?.levels[0] ?? -80),
              height: own.height,
              top: event.clientY - own.top,
              width: own.width,
            }
          : null
      );
    };
    const left = () => setReading(null);
    view?.addEventListener("pointermove", moved, { passive: true });
    view?.addEventListener("pointerleave", left);
    let frame = 0;
    let drawnLeft = 0;
    const draw = async () => {
      frame = 0;
      drawnLeft = view?.scrollLeft ?? 0;
      const more = await paintSpectrogram(canvas, body, view, held, {
        clip,
        gain,
        sampleRate,
        samples,
        scale,
      });
      if (more) {
        later();
      }
    };
    function later() {
      frame ||= requestAnimationFrame(draw);
    }
    const scrolled = () => {
      if (view && Math.abs(view.scrollLeft - drawnLeft) > OVERSCAN / 2) {
        later();
      }
    };
    later();
    const resized = new ResizeObserver(later);
    resized.observe(body);
    if (view) {
      resized.observe(view);
    }
    view?.addEventListener("scroll", scrolled, { passive: true });
    const themed = new MutationObserver(later);
    themed.observe(document.documentElement, {
      attributeFilter: THEME_ATTRIBUTES,
    });
    return () => {
      held.gone = true;
      cancelAnimationFrame(frame);
      resized.disconnect();
      themed.disconnect();
      view?.removeEventListener("scroll", scrolled);
      view?.removeEventListener("pointermove", moved);
      view?.removeEventListener("pointerleave", left);
      held.renderer?.destroy();
    };
  }, [clip, gain, sampleRate, samples, scale]);
  return (
    <>
      <canvas
        className={cn("pointer-events-none absolute", className)}
        data-slot="timeline-clip-spectrogram"
        ref={ref}
        {...props}
      />
      {reading ? (
        <span
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-sm bg-foreground px-1 font-mono text-[10px] text-background tabular-nums"
          data-slot="timeline-clip-spectrogram-reading"
          style={{
            left: Math.min(reading.left + 12, reading.width - 120),
            top:
              reading.top + 12 > reading.height - 18
                ? reading.top - 22
                : reading.top + 12,
          }}
        >
          {reading.text}
        </span>
      ) : null}
    </>
  );
}

/** Where the pointer is on a clip, and what it reads there. */
interface Reading {
  height: number;
  left: number;
  text: string;
  top: number;
  width: number;
}

/** A cell as text: the middle of its frequencies and its level, or the floor it is under. */
const readingOf = (cell: Cell, floor: number) =>
  `${formatFrequency((cell.low + cell.high) / 2)} · ${
    cell.level < floor
      ? `under ${formatLevel(floor, "dB", { decimals: 0, sign: false })}`
      : formatLevel(cell.level, "dB", { sign: false })
  }`;

/** The labels of the frequency axis, in hertz: those that fit under the Nyquist limit are shown. */
const AXIS_TICKS = [
  50, 100, 200, 500, 1000, 2000, 5000, 10_000, 15_000, 20_000,
] as const;

/** The shortest gap between two labels, in CSS px. */
const LABEL_GAP = 14;

/** The labels that fit: from the top down, each at least `LABEL_GAP` px under the one before it. */
function spacedTicks(axis: Axis, nyquist: number, height: number) {
  const kept: { at: number; hertz: number }[] = [];
  let last = Number.POSITIVE_INFINITY;
  for (const hertz of [...AXIS_TICKS].reverse()) {
    if (hertz <= axis.low || hertz >= nyquist) {
      continue;
    }
    const at = axis.at(hertz, axis.low, nyquist);
    // Not at the very top, where the ruler's own labels are.
    if (at * height <= height - LABEL_GAP && last - at * height >= LABEL_GAP) {
      kept.push({ at, hertz });
      last = at * height;
    }
  }
  return kept;
}

/**
 * The frequencies a spectrogram's rows stand for, as labels down the left
 * edge of the lane: each at the row its frequency sits on, by the axis the
 * picture is spaced on. It holds still as the lane scrolls. Put it in the
 * lane's box with the clips, given the same `scale` and the recording's
 * `sampleRate`.
 */
function SpectrogramAxis({
  sampleRate,
  scale,
}: {
  sampleRate: number;
  scale: SpectrogramScale;
}) {
  const [axes, setAxes] = useState<Record<Scale, Axis> | null>(null);
  useEffect(() => {
    let live = true;
    import("gl-spectrogram").then(
      (module) => {
        if (live) {
          setAxes(module.scales);
        }
      },
      () => undefined
    );
    return () => {
      live = false;
    };
  }, []);
  // As tall as the lane it sits in: a percentage of it does not resolve in a flex box.
  const holder = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const lane = holder.current?.parentElement;
    if (!lane) {
      return;
    }
    const measure = () => setHeight(lane.clientHeight);
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(lane);
    return () => resized.disconnect();
  }, []);
  const axis = axes?.[scale];
  const ticks = axis ? spacedTicks(axis, sampleRate / 2, height) : [];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none sticky start-0 z-10 w-0"
      data-slot="spectrogram-axis"
      ref={holder}
      style={{ height }}
    >
      {/* A strip of its own, on the picture's left: the labels read against a plain ground, each with a tick at the picture's edge. */}
      <div className="absolute inset-y-0 start-0 w-12 border-e bg-background">
        {ticks.map(({ at, hertz }) => (
          <span
            className="absolute end-0 flex -translate-y-1/2 items-center gap-1 text-[10px] text-muted-foreground tabular-nums"
            key={hertz}
            style={{ bottom: Math.min(height - 8, Math.max(8, at * height)) }}
          >
            {formatFrequency(hertz)}
            <span className="h-px w-1.5 bg-foreground/40" />
          </span>
        ))}
      </div>
    </div>
  );
}

export { ClipSpectrogram, SpectrogramAxis };
