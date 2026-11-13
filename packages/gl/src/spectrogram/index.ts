import type Spectrogram from "gl-spectrogram";
import type { Axis, Cell, Scale } from "gl-spectrogram";
import {
  createLane,
  groundOf,
  type Lane,
  type LaneClip,
  type LaneContext,
  placeLane,
  sameSamples,
  type VisiblePart,
  visibleClips,
} from "../lane/index.ts";

/** The frequency axes a spectrogram is spaced on: octaves, mel, equal space per auditory filter, or hertz. */
export type SpectrogramScale = Scale;

/**
 * The frequencies a spectrogram shows, as shares of its axis from 0 (the
 * floor) to 1 (the Nyquist limit), whatever the axis spaces its rows by: the
 * clips draw this band, the axis labels it. `[0, 1]` is all of it. Anything
 * with this shape does: `createSource([0, 1])` of `@audio-ui/core` is one.
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

/** The axes the rows are spaced on, for labels that match them: `scales[name].at(f, lo, hi)` is where `f` hertz sits between `lo` and `hi`, 0 to 1. Loaded with the renderer, which is not until it is asked for. */
export async function loadScales(): Promise<Record<Scale, Axis>> {
  return (await import("gl-spectrogram")).scales;
}

/** What the pointer is over on a spectrogram: the cell's frequencies and level, the floor of the levels drawn, and where the pointer is. */
export interface SpectrogramHit {
  /** The quietest level drawn, in dB: a cell under it has nothing to read. */
  floor: number;
  /** The cell's highest and lowest frequency, in hertz. */
  high: number;
  /** The cell's level in dB under full scale: `-Infinity` for silence. */
  level: number;
  low: number;
  x: number;
  y: number;
}

/** What a spectrogram lane draws. */
export interface SpectrogramInputs {
  band?: SpectrogramBand;
  clips: readonly LaneClip[];
  scale: SpectrogramScale;
  /** The lane's pixels a second. */
  zoom: number;
}

/** What a spectrogram lane tells its host. */
export interface SpectrogramHooks {
  /** The pointer is over a cell, or no longer over one. */
  onHit?: (hit: SpectrogramHit | null) => void;
}

/** A part of the canvas a recording's renderer drew, where the pointer finds it again. */
interface Drawn {
  frames: [number, number];
  height: number;
  renderer: Spectrogram;
  width: number;
  x: number;
}

/** What the lane keeps between paints: a renderer a recording, all on one WebGL context, and what each drew where. */
interface Held {
  context: WebGL2RenderingContext | null;
  data: Map<string, ArrayLike<number>>;
  drawn: Drawn[];
  gone: boolean;
  renderers: Map<string, Spectrogram>;
  scales: Record<Scale, Axis> | null;
}

/** The renderer of a recording, made on the lane's one context: the first makes it, the others share it. */
async function rendererOf(
  canvas: HTMLCanvasElement,
  held: Held,
  entry: LaneClip,
  data: ArrayLike<number>
): Promise<Spectrogram | null> {
  const known = held.renderers.get(entry.source);
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
    held.data.set(entry.source, data);
    held.renderers.set(entry.source, renderer);
    return renderer;
  } catch {
    canvas.style.display = "none";
    return null;
  }
}

/** What every part of a paint shares. */
interface Shared {
  band: readonly [number, number];
  color: string;
  ground: string;
  height: number;
  ratio: number;
  scale: SpectrogramScale;
}

/** Updates a recording's renderer for a part of the canvas and draws it; true while it has columns not yet whole. */
function drawPart(
  held: Held,
  renderer: Spectrogram,
  entry: LaneClip,
  data: ArrayLike<number>,
  part: VisiblePart,
  shared: Shared
): boolean {
  const { band, color, ground, height, ratio, scale } = shared;
  const axis = held.scales?.[scale];
  const nyquist = entry.sampleRate / 2;
  const [low, high] = band;
  // The data is handed over only when it changed: the same samples are not uploaded again.
  const changed = !sameSamples(held.data.get(entry.source), data);
  held.data.set(entry.source, data);
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
    range: part.frames,
    sampleRate: entry.sampleRate,
    scale,
    viewport: [part.x, 0, part.width, height],
  });
  renderer.clear().render();
  held.drawn.push({
    frames: part.frames,
    height,
    renderer,
    width: part.width,
    x: part.x,
  });
  return renderer.pending;
}

/** Draws every clip of the lane the view shows, each into its own parts of the one canvas; true while some column is not yet whole. */
async function paint({
  body,
  canvas,
  held,
  inputs,
  view,
}: LaneContext<Held, SpectrogramInputs>): Promise<boolean> {
  const { band, clips, scale, zoom } = inputs();
  const placed = zoom > 0 ? placeLane(canvas, body, view) : null;
  if (!placed) {
    return false;
  }
  const visible = await visibleClips(clips, placed, zoom);
  const renderers = new Map<string, Spectrogram | null>();
  await Promise.all(
    visible.map(async (each) => {
      if (!renderers.has(each.entry.source)) {
        renderers.set(each.entry.source, null);
        renderers.set(
          each.entry.source,
          await rendererOf(canvas, held, each.entry, each.data)
        );
      }
    })
  );
  if (held.gone) {
    return false;
  }
  const shared: Shared = {
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
  held.drawn = [];
  let pending = false;
  for (const each of visible) {
    const renderer = renderers.get(each.entry.source);
    if (!renderer) {
      continue;
    }
    for (const part of each.parts) {
      pending =
        drawPart(held, renderer, each.entry, each.data, part, shared) ||
        pending;
    }
  }
  // Recordings the lane no longer draws let go of their textures.
  const alive = new Set(clips.map((entry) => entry.source));
  for (const [source, renderer] of held.renderers) {
    if (!alive.has(source)) {
      renderer.destroy();
      held.renderers.delete(source);
      held.data.delete(source);
    }
  }
  return pending;
}

/** The cell under a pointer, read in the part of the canvas it is over. */
function hitAt(
  held: Held,
  canvas: HTMLCanvasElement,
  event: PointerEvent
): SpectrogramHit | null {
  const box = canvas.getBoundingClientRect();
  const x = event.clientX - box.left;
  const y = event.clientY - box.top;
  if (x < 0 || y < 0 || x > box.width || y > box.height) {
    return null;
  }
  const part = held.drawn.find(
    (each) => x >= each.x && x <= each.x + each.width
  );
  if (!part) {
    return null;
  }
  // A renderer draws several parts: it reads the one it last drew, so it is pointed at this one first.
  part.renderer.update({
    range: part.frames,
    viewport: [part.x, 0, part.width, part.height],
  });
  const cell: Cell | null = part.renderer.pick(x - part.x, y);
  return cell
    ? {
        floor: part.renderer.levels[0],
        high: cell.high,
        level: cell.level,
        low: cell.low,
        x: event.clientX,
        y: event.clientY,
      }
    : null;
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
 * Draws the spectrograms of a lane's clips on `canvas`, which sits in the
 * lane's box, each clip in its own part of it: their frequencies over the
 * stretch of the lane the view shows, computed on the GPU by `gl-spectrogram`
 * at every zoom, in the text colour over the ground under it. All the clips
 * share one WebGL context. `inputs.band` is the frequencies shown: Shift and
 * the wheel over the picture zoom it about the pointer, and `hooks.onHit`
 * tells what the pointer is over.
 */
export function createSpectrogramLane(
  canvas: HTMLCanvasElement,
  inputs: SpectrogramInputs,
  hooks: SpectrogramHooks = {}
): Lane<SpectrogramInputs> {
  let latest = inputs;
  const lane = createLane<Held, SpectrogramInputs>({
    attach: ({ canvas: target, held, view }) => {
      const moved = (event: PointerEvent) =>
        hooks.onHit?.(hitAt(held, target, event));
      const left = () => hooks.onHit?.(null);
      // Shift and the wheel zoom the frequencies over this picture, before the lane scrolls time with it.
      const wheeled = (event: WheelEvent) =>
        zoomOnWheel(event, target, latest.band);
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
    canvas,
    create: () => ({
      context: null,
      data: new Map(),
      drawn: [],
      gone: false,
      renderers: new Map(),
      scales: null,
    }),
    destroy: (held) => {
      for (const renderer of held.renderers.values()) {
        renderer.destroy();
      }
    },
    inputs,
    paint,
    subscribe: (later) => latest.band?.subscribe(later) ?? (() => undefined),
  });
  return {
    ...lane,
    update: (next) => {
      latest = next;
      lane.update(next);
    },
  };
}

/** A frequency the pointer reads, as the axis writes it: three significant digits, five characters at most (12.3k, 523, 52.3). */
export const readHertz = (hertz: number) =>
  hertz >= 1000
    ? `${+(hertz / 1000).toPrecision(3)}k`
    : `${+hertz.toPrecision(3)}`;

/** A frequency as the axis writes it, no unit: 500, 1.25k, 20k. */
export const hertzLabel = (hertz: number) =>
  hertz >= 1000
    ? `${+(hertz / 1000).toFixed(3)}k`
    : `${+hertz.toFixed(hertz < 100 ? 1 : 0)}`;

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

/** The room a label takes in the lane, in CSS px: its text and a gap. */
const LABEL_ROOM = 15;

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

/** What `spectrogramAxis` lays out: a frequency's place, the labels with their ticks, the ticks between, and where the pointer is. */
export interface SpectrogramAxisLayout {
  /** A frequency's px from the foot of the lane, in the band in view. */
  at: (hertz: number) => number;
  /** The labels that fit: the frequency, the text for it, the px of its tick and the px of its text, kept inside the lane. */
  labels: { hertz: number; text: string; tick: number; y: number }[];
  /** Where the pointer's frequency sits, px from the foot, or null. */
  marker: number | null;
  /** The px of the ticks between the labels, unlabelled. */
  minor: number[];
}

/**
 * Lays out a spectrogram's frequency axis for a lane `height` px tall, as
 * audio.js draws it: labels roundest first (20k, 2k, 200, then between as
 * room allows), each with its tick at the row its frequency sits on by the
 * axis the picture is spaced on, and shorter ticks between, the band in view
 * respected. `pointer`, a frequency, is marked and the labels near it give
 * way. `axis` is `(await loadScales())[scale]`.
 */
export function spectrogramAxis({
  axis,
  band = [0, 1],
  height,
  nyquist,
  pointer = null,
  scale,
}: {
  axis: Axis;
  band?: readonly [number, number];
  height: number;
  nyquist: number;
  pointer?: number | null;
  scale: SpectrogramScale;
}): SpectrogramAxisLayout {
  const [from, to] = band;
  const at = (hertz: number) =>
    ((axis.at(hertz, axis.low, nyquist) - from) / (to - from)) * height;
  const marker = pointer === null ? null : at(pointer);
  const full = from <= 0 && to >= 1;
  const candidates = candidatesFor(
    scale,
    full,
    axis.of(from, axis.low, nyquist),
    axis.of(to, axis.low, nyquist)
  );
  const kept: SpectrogramAxisLayout["labels"] = [];
  for (const hertz of candidates) {
    const tick = at(hertz);
    if (tick < 0 || tick > height) {
      continue;
    }
    // The tick stays where the frequency is; its text is kept inside the lane.
    const y = Math.min(height - 6, Math.max(6, tick));
    if (
      kept.every((other) => Math.abs(other.y - y) >= LABEL_ROOM) &&
      (marker === null || Math.abs(y - marker) >= LABEL_ROOM)
    ) {
      kept.push({ hertz, text: hertzLabel(hertz), tick, y });
    }
  }
  const shown = new Set(kept.map((label) => label.hertz));
  const minor = full
    ? minorHertz(scale, nyquist)
        .filter(
          (hertz) =>
            !shown.has(hertz) &&
            hertz >= axis.low &&
            at(hertz) >= 2 &&
            at(hertz) <= height - 2
        )
        .map(at)
    : [];
  return { at, labels: kept, marker, minor };
}

export {
  hasWebGL2,
  type Lane,
  type LaneClip,
  type LaneSamples,
} from "../lane/index.ts";
