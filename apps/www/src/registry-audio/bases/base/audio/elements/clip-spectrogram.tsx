import { formatFrequency, formatLevel } from "@audio-ui/engine/format";
import type Spectrogram from "gl-spectrogram";
import type { Axis, Cell, Scale } from "gl-spectrogram";
import {
  type ComponentProps,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type GlLaneContext,
  groundOf,
  type LaneClip,
  placeLane,
  sameSamples,
  useGlLane,
  type VisibleClip,
  visibleClips,
} from "@/registry-audio/bases/base/hooks/use-gl-lane";

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

/** What one paint of the lane draws. */
interface SpectrogramInputs {
  band: SpectrogramBand | undefined;
  clips: readonly LaneClip[];
  pointerHertz: Pick<PointerHertz, "set"> | undefined;
  scale: SpectrogramScale;
  zoom: number;
}

/** What the lane keeps between paints: a renderer a clip, all on one WebGL context. */
interface Held {
  context: WebGL2RenderingContext | null;
  data: Map<string, ArrayLike<number>>;
  gone: boolean;
  renderers: Map<string, { renderer: Spectrogram; width: number; x: number }>;
  scales: Record<Scale, Axis> | null;
}

/** The renderer of a clip, made on the lane's one context: the first makes it, the others share it. */
async function rendererOf(
  canvas: HTMLCanvasElement,
  held: Held,
  entry: LaneClip,
  data: ArrayLike<number>
): Promise<Spectrogram | null> {
  const known = held.renderers.get(entry.id)?.renderer;
  if (known) {
    return known;
  }
  const { default: Renderer, scales } = await import("gl-spectrogram");
  if (held.gone) {
    return null;
  }
  try {
    const renderer = new Renderer(held.context ?? canvas, {
      data,
      sampleRate: entry.sampleRate,
    });
    held.context ??= renderer.gl as WebGL2RenderingContext;
    held.scales = scales;
    held.data.set(entry.id, data);
    held.renderers.set(entry.id, { renderer, width: 0, x: 0 });
    return renderer;
  } catch {
    canvas.style.display = "none";
    return null;
  }
}

/** Updates a clip's renderer for its part of the canvas and draws it; true while it has columns not yet whole. */
function drawClip(
  held: Held,
  renderer: Spectrogram,
  { data, entry, frames, width, x }: VisibleClip,
  shared: {
    band: readonly [number, number];
    color: string;
    ground: string;
    height: number;
    ratio: number;
    scale: SpectrogramScale;
  }
): boolean {
  const { band, color, ground, height, ratio, scale } = shared;
  const axis = held.scales?.[scale];
  const nyquist = entry.sampleRate / 2;
  const [low, high] = band;
  // The data is handed over only when it changed: the same samples are not uploaded again.
  const changed = !sameSamples(held.data.get(entry.id), data);
  held.data.set(entry.id, data);
  renderer.update({
    background: ground,
    band:
      axis && (low > 0 || high < 1)
        ? [axis.of(low, axis.low, nyquist), axis.of(high, axis.low, nyquist)]
        : null,
    color,
    ...(changed ? { data } : {}),
    gain: entry.gain,
    pixelRatio: ratio,
    range: frames,
    sampleRate: entry.sampleRate,
    scale,
    viewport: [x, 0, width, height],
  });
  renderer.clear().render();
  return renderer.pending;
}

/** Draws every clip of the lane the view shows, each into its own part of the one canvas; true while some column is not yet whole. */
async function paintLane({
  body,
  canvas,
  held,
  inputs,
  view,
}: GlLaneContext<Held, SpectrogramInputs>): Promise<boolean> {
  const { band, clips, scale, zoom } = inputs();
  const placed = zoom > 0 ? placeLane(canvas, body, view) : null;
  if (!placed) {
    return false;
  }
  const visible = await visibleClips(clips, placed, zoom);
  const renderers = await Promise.all(
    visible.map((each) => rendererOf(canvas, held, each.entry, each.data))
  );
  if (held.gone) {
    return false;
  }
  const shared = {
    band: band?.getSnapshot() ?? ([0, 1] as const),
    color: getComputedStyle(canvas).color,
    ground: groundOf(body),
    height: canvas.clientHeight,
    ratio: placed.ratio,
    scale,
  };
  // One clear for the whole canvas: the renderers only draw into their parts.
  const gl = held.context;
  gl?.clearColor(0, 0, 0, 0);
  gl?.clear(gl.COLOR_BUFFER_BIT);
  let pending = false;
  for (const [index, each] of visible.entries()) {
    const renderer = renderers[index];
    const slot = held.renderers.get(each.entry.id);
    if (renderer && slot) {
      slot.x = each.x;
      slot.width = each.width;
      pending = drawClip(held, renderer, each, shared) || pending;
    }
  }
  // Clips the lane no longer has let go of their textures.
  const alive = new Set(clips.map((entry) => entry.id));
  for (const [id, slot] of held.renderers) {
    if (!alive.has(id)) {
      slot.renderer.destroy();
      held.renderers.delete(id);
      held.data.delete(id);
    }
  }
  return pending;
}

/** Shift and the wheel over the picture zoom its frequencies about the pointer: up is closer. */
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
 * The spectrograms of a lane's clips on one canvas, each in its own part of
 * it: their frequencies over the stretch of the lane the view shows, computed
 * on the GPU by `gl-spectrogram` at every zoom, in the text colour over the
 * ground under it. All of them share one WebGL context, since a browser
 * keeps some sixteen and drops the oldest past that. Put it in the lane's
 * box, `zoom` being the lane's pixels a second; `scale` is the frequency
 * axis. A reversed, looped or warped clip is drawn from its source in order.
 * It needs WebGL 2, and draws nothing without it.
 */
function SpectrogramLane({
  band,
  className,
  clips,
  pointerHertz,
  scale = "log",
  zoom,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  /** The frequencies shown, as shares of the axis: Shift and the wheel over the picture zooms it, about the pointer. */
  band?: SpectrogramBand;
  clips: readonly LaneClip[];
  /** Told the frequency under the pointer, in hertz, or null off the picture: for `SpectrogramAxis` to mark. */
  pointerHertz?: Pick<PointerHertz, "set">;
  scale?: SpectrogramScale;
  /** The lane's pixels a second. */
  zoom: number;
}) {
  const [reading, setReading] = useState<Reading | null>(null);
  const inputs = useMemo<SpectrogramInputs>(
    () => ({ band, clips, pointerHertz, scale, zoom }),
    [band, clips, pointerHertz, scale, zoom]
  );
  const ref = useGlLane<Held, SpectrogramInputs>({
    attach: ({ body, canvas, held, inputs: now, view }) => {
      // The cell under the pointer: its frequency and level, read in the clip it is over.
      const moved = (event: PointerEvent) => {
        const box = canvas.getBoundingClientRect();
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        let cell: Cell | null = null;
        let floor = -80;
        if (x >= 0 && y >= 0 && x <= box.width && y <= box.height) {
          for (const slot of held.renderers.values()) {
            if (x >= slot.x && x <= slot.x + slot.width) {
              cell = slot.renderer.pick(x - slot.x, y);
              [floor] = slot.renderer.levels;
              break;
            }
          }
        }
        const own = body.getBoundingClientRect();
        now().pointerHertz?.set(cell ? (cell.low + cell.high) / 2 : null);
        setReading(
          cell
            ? {
                height: own.height,
                left: event.clientX - own.left,
                text: readingOf(cell, floor),
                top: event.clientY - own.top,
                width: own.width,
              }
            : null
        );
      };
      const left = () => {
        now().pointerHertz?.set(null);
        setReading(null);
      };
      // Shift and the wheel zoom the frequencies over this picture, before the lane scrolls time with it.
      const wheeled = (event: WheelEvent) =>
        zoomOnWheel(event, canvas, now().band);
      view?.addEventListener("pointermove", moved, { passive: true });
      view?.addEventListener("pointerleave", left);
      view?.addEventListener("wheel", wheeled, {
        capture: true,
        passive: false,
      });
      return () => {
        view?.removeEventListener("pointermove", moved);
        view?.removeEventListener("pointerleave", left);
        view?.removeEventListener("wheel", wheeled, { capture: true });
      };
    },
    create: () => ({
      context: null,
      data: new Map(),
      gone: false,
      renderers: new Map(),
      scales: null,
    }),
    destroy: (held) => {
      for (const { renderer } of held.renderers.values()) {
        renderer.destroy();
      }
    },
    inputs,
    paint: paintLane,
    subscribe: (later) => band?.subscribe(later) ?? (() => undefined),
  });
  return (
    <>
      <canvas
        className={cn("pointer-events-none absolute inset-y-0", className)}
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

export { SpectrogramAxis, SpectrogramLane };
