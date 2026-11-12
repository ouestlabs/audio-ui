import { formatFrequency, formatLevel } from "@audio-ui/engine/format";
import type Spectrogram from "gl-spectrogram";
import type { Axis, Cell, Scale } from "gl-spectrogram";
import {
  type ComponentProps,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type ClipReading,
  clipFramePositions,
} from "@/registry-audio/bases/base/lib/arrangement";

/** The frequency axes a spectrogram is spaced on: octaves, mel, equal space per auditory filter, or hertz. */
export type SpectrogramScale = Scale;

/** A frequency held where the clips and the axis both reach it: the clips say it, the axis reads it. */
export interface PointerHertz {
  getSnapshot: () => number | null;
  set: (hertz: number | null) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * The frequencies a spectrogram shows, as shares of its axis from 0 (the
 * floor) to 1 (the Nyquist limit), whatever the axis spaces its rows by: the
 * clips draw this band, the axis labels it. `[0, 1]` is all of it.
 */
export interface SpectrogramBand {
  getSnapshot: () => readonly [number, number];
  set: (band: readonly [number, number]) => void;
  subscribe: (listener: () => void) => () => void;
}

/** The narrowest band a zoom reaches, as a share of the axis. */
const NARROWEST = 0.02;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The band `factor` times as wide (under 1 zooms in), the share `at` of it (0 at its foot) staying where it is. */
export function zoomBand(
  [low, high]: readonly [number, number],
  at: number,
  factor: number
): [number, number] {
  const span = Math.min(1, Math.max(NARROWEST, (high - low) * factor));
  const kept = low + at * (high - low);
  const from = Math.min(1 - span, Math.max(0, kept - at * span));
  return [from, from + span];
}

/** The band moved by `share` of its own width, up or down, kept inside the axis. */
export function panBand(
  [low, high]: readonly [number, number],
  share: number
): [number, number] {
  const span = high - low;
  const from = Math.min(1 - span, Math.max(0, low + share * span));
  return [from, from + span];
}

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
  scales: Record<Scale, Axis> | null;
}

/** What one paint draws. */
interface Paint {
  band: SpectrogramBand | undefined;
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
  { band, clip, gain, sampleRate, samples, scale }: Paint
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
    const { default: Renderer, scales } = await import("gl-spectrogram");
    if (held.gone || paint !== held.paints) {
      return false;
    }
    try {
      held.renderer = new Renderer(canvas, { data, sampleRate });
      held.scales = scales;
    } catch {
      canvas.style.display = "none";
      return false;
    }
  }
  if (held.gone || paint !== held.paints) {
    return false;
  }
  const [from, to] = band?.getSnapshot() ?? [0, 1];
  const axis = held.scales?.[scale];
  const nyquist = sampleRate / 2;
  held.renderer
    .update({
      background: groundOf(body),
      band:
        axis && (from > 0 || to < 1)
          ? [axis.of(from, axis.low, nyquist), axis.of(to, axis.low, nyquist)]
          : null,
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

/** Shift and the wheel over a picture zoom its frequencies about the pointer: up is closer. */
function zoomOnWheel(
  event: WheelEvent,
  canvas: HTMLCanvasElement,
  band: SpectrogramBand | undefined
) {
  const box = canvas.getBoundingClientRect();
  const inside =
    event.clientX >= box.left &&
    event.clientX <= box.right &&
    event.clientY >= box.top &&
    event.clientY <= box.bottom;
  if (!(band && event.shiftKey && inside)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  // A shifted wheel may arrive on either axis.
  const delta = event.deltaY || event.deltaX;
  band.set(
    zoomBand(
      band.getSnapshot(),
      clamp01(1 - (event.clientY - box.top) / box.height),
      Math.exp(delta * 0.002)
    )
  );
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
  band,
  clip,
  gain = 1,
  pointerHertz,
  sampleRate,
  samples,
  scale = "log",
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  /** The frequencies shown, as shares of the axis: Shift and the wheel over the picture zooms it, about the pointer. */
  band?: SpectrogramBand;
  clip: ClipReading;
  /** A gain factor on the picture, as a clip's level plays. @default 1 */
  gain?: number;
  /** Told the frequency under the pointer, in hertz, or null off the picture: for `SpectrogramAxis` to mark. */
  pointerHertz?: Pick<PointerHertz, "set">;
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
    const held: Held = {
      gone: false,
      paints: 0,
      renderer: null,
      scales: null,
    };
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
      pointerHertz?.set(cell ? (cell.low + cell.high) / 2 : null);
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
    const left = () => {
      pointerHertz?.set(null);
      setReading(null);
    };
    view?.addEventListener("pointermove", moved, { passive: true });
    view?.addEventListener("pointerleave", left);
    // Shift and the wheel zoom the frequencies over this picture, before the lane scrolls time with it.
    const wheeled = (event: WheelEvent) => zoomOnWheel(event, canvas, band);
    view?.addEventListener("wheel", wheeled, { capture: true, passive: false });
    let frame = 0;
    let drawnLeft = 0;
    const draw = async () => {
      frame = 0;
      drawnLeft = view?.scrollLeft ?? 0;
      const more = await paintSpectrogram(canvas, body, view, held, {
        band,
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
    const unsubscribe = band?.subscribe(later);
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
      view?.removeEventListener("wheel", wheeled, { capture: true });
      unsubscribe?.();
      held.renderer?.destroy();
    };
  }, [band, clip, gain, pointerHertz, sampleRate, samples, scale]);
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

/** A cell as text: the middle of its frequencies and its level, the frequency alone under the floor, where there is nothing to read. */
const readingOf = (cell: Cell, floor: number) => {
  const hertz = formatFrequency((cell.low + cell.high) / 2);
  return cell.level < floor
    ? hertz
    : `${hertz} · ${formatLevel(cell.level, "dB", { sign: false })}`;
};

/**
 * The frequencies each axis labels, roundest first, a decade apart and then
 * between as room allows: a small lane keeps 20k, 2k, 200 and 20. Ordered on
 * each axis by what it spaces rows by, so the labels fall where the ear
 * looks for them.
 */
const AXIS_LABELS: Record<SpectrogramScale, readonly number[]> = {
  erb: [20_000, 2000, 200, 10_000, 5000, 1000, 500, 100],
  lin: [20_000, 10_000, 5000, 15_000],
  log: [20_000, 2000, 200, 20, 10_000, 1000, 100, 5000, 500, 50],
  mel: [20_000, 2000, 200, 10_000, 5000, 1000, 500, 3000],
};

const NO_SUBSCRIPTION = () => () => undefined;
const NO_POINTER = () => null;
const NO_BAND: readonly [number, number] = [0, 1];
const NO_BAND_SNAPSHOT = () => NO_BAND;

/** The room a label takes in the lane, in CSS px: its text and a gap. */
const LABEL_ROOM = 15;

/** A frequency the pointer reads, as the axis writes it: three significant digits, five characters at most (12.3k, 523, 52.3). */
const readHertz = (hertz: number) =>
  hertz >= 1000
    ? `${+(hertz / 1000).toPrecision(3)}k`
    : `${+hertz.toPrecision(3)}`;

/** A frequency as the axis writes it, no unit: 500, 1.25k, 20k. */
const hertzLabel = (hertz: number) =>
  hertz >= 1000
    ? `${+(hertz / 1000).toFixed(3)}k`
    : `${+hertz.toFixed(hertz < 100 ? 1 : 0)}`;

/**
 * The labels that fit, roundest first, each `LABEL_ROOM` px from the ones
 * kept and inside the lane, as `[hertz, px from the foot]`; `place` gives a
 * frequency's px from the foot, in the band in view.
 */
function labelled(
  candidates: readonly number[],
  rowOf: (hertz: number) => number,
  height: number
): [number, number][] {
  const kept: [number, number][] = [];
  for (const hertz of candidates) {
    const px = rowOf(hertz);
    if (px < 0 || px > height) {
      continue;
    }
    // The tick stays where the frequency is; its text is kept inside the lane.
    const text = Math.min(height - 6, Math.max(6, px));
    if (kept.every(([, other]) => Math.abs(other - text) >= LABEL_ROOM)) {
      kept.push([hertz, text]);
    }
  }
  return kept;
}

/** The 1-2-5 step just above `least`. */
function niceStep(least: number): number {
  const power = 10 ** Math.floor(Math.log10(least));
  return (
    [1, 2, 5, 10]
      .map((multiple) => multiple * power)
      .find((step) => step >= least * (1 - 1e-9)) ?? power * 10
  );
}

/**
 * The frequencies to label in the band from `low` to `high`, roundest first:
 * the axis' own list while all of it shows; zoomed in, the round values in
 * view, 1-2-5 a decade across a wide span of a log-spaced axis, even steps
 * across a narrow one.
 */
function candidatesFor(
  scale: SpectrogramScale,
  full: boolean,
  low: number,
  high: number
): number[] {
  if (full) {
    return [...AXIS_LABELS[scale]];
  }
  if (scale !== "lin" && high / low > 3) {
    const out: number[] = [];
    for (const multiple of [1, 5, 2, 3, 4, 6, 7, 8, 9]) {
      for (let decade = 1e4; decade >= 1; decade /= 10) {
        if (multiple * decade >= low && multiple * decade <= high) {
          out.push(multiple * decade);
        }
      }
    }
    return out;
  }
  const step = niceStep((high - low) / 6);
  const out: number[] = [];
  for (
    let hertz = Math.floor(high / step) * step;
    hertz >= low;
    hertz -= step
  ) {
    out.push(Number(hertz.toPrecision(12)));
  }
  return out;
}

/** The ticks between the labels, unlabelled: 1-2-5 a decade apart on a log-spaced axis, every 2.5k on a linear one. */
function minorHertz(scale: SpectrogramScale, nyquist: number): number[] {
  if (scale === "lin") {
    return Array.from(
      { length: Math.floor(nyquist / 2500) },
      (_, index) => (index + 1) * 2500
    );
  }
  const out: number[] = [];
  for (let decade = 10; decade < nyquist; decade *= 10) {
    for (const multiple of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const hertz = multiple * decade;
      if (hertz < nyquist) {
        out.push(hertz);
      }
    }
  }
  return out;
}

/**
 * The frequencies a spectrogram's rows stand for, as an axis down the left
 * edge of the lane, as audio.js draws it: labels roundest first (20k, 2k,
 * 200, then between as room allows), each with its tick at the row its
 * frequency sits on by the axis the picture is spaced on, and shorter ticks
 * between. `pointer`, a frequency, is marked on it as the pointer reads it.
 * It holds still as the lane scrolls. Put it in the lane's box with the
 * clips, given the same `scale` and the recording's `sampleRate`.
 */
function SpectrogramAxis({
  band,
  pointer,
  sampleRate,
  scale,
}: {
  /** The frequencies shown, as shares of the axis: the wheel over the axis moves it, with Ctrl or Command zooms it, a double-click shows all. */
  band?: SpectrogramBand;
  /** The frequency under the pointer, in hertz, to mark on the axis. */
  pointer?: PointerHertz;
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
  const strip = useRef<HTMLDivElement>(null);
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
  // The wheel over the axis moves the band, and zooms it with Ctrl, Command or a pinch: before the lane scrolls time with it.
  useEffect(() => {
    const element = strip.current;
    if (!(element && band)) {
      return;
    }
    const wheeled = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const box = element.getBoundingClientRect();
      const current = band.getSnapshot();
      band.set(
        event.ctrlKey || event.metaKey
          ? zoomBand(
              current,
              clamp01(1 - (event.clientY - box.top) / box.height),
              Math.exp(event.deltaY * 0.01)
            )
          : panBand(current, -event.deltaY / box.height)
      );
    };
    const reset = () => band.set([0, 1]);
    element.addEventListener("wheel", wheeled, { passive: false });
    element.addEventListener("dblclick", reset);
    return () => {
      element.removeEventListener("wheel", wheeled);
      element.removeEventListener("dblclick", reset);
    };
  }, [band]);
  const heard = useSyncExternalStore(
    pointer?.subscribe ?? NO_SUBSCRIPTION,
    pointer?.getSnapshot ?? NO_POINTER,
    NO_POINTER
  );
  const [from, to] = useSyncExternalStore(
    band?.subscribe ?? NO_SUBSCRIPTION,
    band?.getSnapshot ?? NO_BAND_SNAPSHOT,
    NO_BAND_SNAPSHOT
  );
  const axis = axes?.[scale];
  const nyquist = sampleRate / 2;
  const full = from <= 0 && to >= 1;
  // A frequency's px from the foot, in the band in view.
  const at = (hertz: number) =>
    axis
      ? ((axis.at(hertz, axis.low, nyquist) - from) / (to - from)) * height
      : 0;
  const marked = heard === null || !axis ? null : at(heard);
  const candidates = axis
    ? candidatesFor(
        scale,
        full,
        axis.of(from, axis.low, nyquist),
        axis.of(to, axis.low, nyquist)
      )
    : [];
  const labels = labelled(candidates, at, height).filter(
    ([, px]) => marked === null || Math.abs(px - marked) >= LABEL_ROOM
  );
  const kept = new Set(labels.map(([hertz]) => hertz));
  const minor =
    axis && full
      ? minorHertz(scale, nyquist).filter(
          (hertz) =>
            !kept.has(hertz) &&
            hertz >= axis.low &&
            at(hertz) >= 2 &&
            at(hertz) <= height - 2
        )
      : [];
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none sticky start-0 z-10 w-0"
      data-slot="spectrogram-axis"
      ref={holder}
      style={{ height }}
    >
      {/* A strip of its own, on the picture's left: the labels read against a plain ground, each before its tick at the picture's edge. */}
      <div
        className="pointer-events-auto absolute inset-y-0 start-0 w-11 touch-none border-e bg-background"
        ref={strip}
      >
        {minor.map((hertz) => (
          <span
            className="absolute end-0 h-px w-1 bg-foreground/30"
            key={hertz}
            style={{ bottom: at(hertz) }}
          />
        ))}
        {labels.map(([hertz, px]) => (
          <span key={hertz}>
            <span
              className="absolute end-0 h-px w-1.5 bg-foreground/50"
              style={{ bottom: at(hertz) }}
            />
            <span
              className="absolute end-2 translate-y-1/2 text-[10px] text-muted-foreground tabular-nums"
              style={{ bottom: px }}
            >
              {hertzLabel(hertz)}
            </span>
          </span>
        ))}
        {marked === null || heard === null ? null : (
          <>
            <span
              className="absolute end-0 h-px w-2 bg-foreground"
              style={{ bottom: marked }}
            />
            <span
              className="absolute end-2 translate-y-1/2 rounded-s-sm bg-foreground px-1 text-[10px] text-background tabular-nums"
              data-slot="spectrogram-axis-pointer"
              style={{ bottom: Math.min(height - 6, Math.max(6, marked)) }}
            >
              {readHertz(heard)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export { ClipSpectrogram, SpectrogramAxis };
