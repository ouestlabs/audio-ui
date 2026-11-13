import type Waveform from "gl-waveform";
import {
  createLane,
  type Lane,
  type LaneClip,
  type LaneContext,
  placeLane,
  sameSamples,
  type VisibleClip,
  visibleClips,
} from "../lane/index.ts";

/** The three signals a sound is split into to colour it by its frequencies: what it has low, between and high. */
export interface WaveformBands {
  high: ArrayLike<number>;
  low: ArrayLike<number>;
  mid: ArrayLike<number>;
  /** The loudest sample of each band, 0 to 1: each is drawn as tall as its own loudest reaches, so a band that is quiet in the mix still shows. */
  peaks?: { high: number; low: number; mid: number };
}

/** A clip of the lane, with what its waveform needs besides what every lane clip has. */
export interface WaveformClip extends LaneClip {
  /** Read when the lane draws by band: the recording as three signals. Called once a recording, so it may be a lazy split. */
  bands?: () => WaveformBands;
  /** The loudest sample of the recording, 0 to 1: the waveform is drawn as tall as the loudest reaches the lane's height. */
  peak: number;
}

/** How the lane draws a waveform: as one, or as the three bands of the sound one over the other, the lows warm and the highs cool. */
export type WaveformLook = "bands" | "plain";

/**
 * How a recording with several channels is laid out: `mix` draws them as one
 * waveform; `split` draws each channel in a row of its own, as a DAW does on
 * a tall track; `auto` splits when each row would be at least `SPLIT_ROW_PX`
 * tall, and mixes below that, as a short track shows one lane. The band look
 * draws the mix.
 */
export type WaveformLayout = "auto" | "mix" | "split";

/** The least height of a channel's row, in CSS px, for `auto` to split. */
export const SPLIT_ROW_PX = 40;

/** What a waveform lane draws. */
export interface WaveformInputs {
  clips: readonly WaveformClip[];
  /** How channels are laid out. @default "auto" */
  layout?: WaveformLayout;
  look: WaveformLook;
  /** The lane's pixels a second. */
  zoom: number;
}

type Layer = "high" | "low" | "mid" | "plain";

/** What the lane keeps between paints: a renderer a recording and a layer, all on one WebGL context. */
interface Held {
  context: WebGL2RenderingContext | null;
  data: Map<string, ArrayLike<number>>;
  gone: boolean;
  renderers: Map<string, Waveform>;
}

/** Whether a colour (as a computed style gives it, `rgb(...)`) is light: the ink of a dark theme. */
function isLight(color: string) {
  const [red = 0, green = 0, blue = 0] = (color.match(/[\d.]+/g) ?? []).map(
    Number
  );
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.5;
}

/** The colour of a band: the lows warm, the mids the ink's own, the highs cool, at a lightness that reads on the screen. */
function colorOf(layer: Layer, ink: string, light: boolean): string {
  const lightness = light ? 0.78 : 0.55;
  if (layer === "low") {
    return `oklch(${lightness} 0.16 50)`;
  }
  if (layer === "high") {
    return `oklch(${lightness} 0.14 245)`;
  }
  return ink;
}

/** The renderer of a clip's layer, made on the lane's one context: the first makes it, the others share it. */
async function rendererOf(
  canvas: HTMLCanvasElement,
  held: Held,
  key: string,
  data: ArrayLike<number>
): Promise<Waveform | null> {
  const known = held.renderers.get(key);
  if (known) {
    return known;
  }
  const { default: Renderer } = await import("gl-waveform");
  if (held.gone) {
    return null;
  }
  try {
    const renderer = new Renderer(held.context ?? canvas, { data });
    held.context ??= renderer.gl as WebGL2RenderingContext;
    held.data.set(key, data);
    held.renderers.set(key, renderer);
    return renderer;
  } catch {
    canvas.style.display = "none";
    return null;
  }
}

/** What a clip draws in one row of the lane: a layer of its recording, its samples, the loudest of them, and the row's place and height. */
export interface WaveformRow {
  data: ArrayLike<number>;
  /** The row's height, in CSS px. */
  h: number;
  key: string;
  layer: Layer;
  peak: number;
  /** The row's top, in CSS px. */
  y: number;
}

/** Whether a clip draws each channel in a row of its own at this layout, look and height. */
export function splitsChannels(
  entry: WaveformClip,
  layout: WaveformLayout,
  look: WaveformLook,
  height: number
): boolean {
  const count = entry.channels?.length ?? 1;
  return (
    look === "plain" &&
    count > 1 &&
    (layout === "split" ||
      (layout === "auto" && height / count >= SPLIT_ROW_PX))
  );
}

/** The rows a clip draws in a lane `height` px tall, with the samples of each: a channel apiece (`channels`, read), its recording whole, or its three bands. */
export function waveformRows(
  entry: WaveformClip,
  data: ArrayLike<number>,
  channels: readonly ArrayLike<number>[] | null,
  look: WaveformLook,
  height: number
): WaveformRow[] {
  const { source } = entry;
  if (channels) {
    const h = height / channels.length;
    return channels.map((channel, index) => ({
      data: channel,
      h,
      key: `${source}:channel${index}`,
      layer: "plain",
      peak: entry.peak,
      y: index * h,
    }));
  }
  if (look === "bands" && entry.bands) {
    const { high, low, mid, peaks } = entry.bands();
    const whole = { h: height, y: 0 };
    return [
      {
        ...whole,
        data: low,
        key: `${source}:low`,
        layer: "low",
        peak: peaks?.low ?? entry.peak,
      },
      {
        ...whole,
        data: mid,
        key: `${source}:mid`,
        layer: "mid",
        peak: peaks?.mid ?? entry.peak,
      },
      {
        ...whole,
        data: high,
        key: `${source}:high`,
        layer: "high",
        peak: peaks?.high ?? entry.peak,
      },
    ];
  }
  return [
    {
      data,
      h: height,
      key: `${source}:plain`,
      layer: "plain",
      peak: entry.peak,
      y: 0,
    },
  ];
}

/** A clip the view shows, with the rows it draws. */
interface Planned {
  each: VisibleClip;
  rows: WaveformRow[];
}

/** The rows each visible clip draws, the channels of a recording read once a recording. */
async function plan(
  visible: readonly VisibleClip[],
  layout: WaveformLayout,
  look: WaveformLook,
  height: number
): Promise<Planned[]> {
  const read = new Map<string, Promise<ArrayLike<number>[]>>();
  return await Promise.all(
    visible.map(async (each) => {
      const entry = each.entry as WaveformClip;
      let channels: ArrayLike<number>[] | null = null;
      if (entry.channels && splitsChannels(entry, layout, look, height)) {
        const readers = entry.channels;
        if (!read.has(entry.source)) {
          read.set(
            entry.source,
            Promise.all(readers.map((reader) => reader.read(0, reader.frames)))
          );
        }
        channels = (await read.get(entry.source)) ?? null;
      }
      return {
        each,
        rows: waveformRows(entry, each.data, channels, look, height),
      };
    })
  );
}

/** Draws the planned rows, each part of each clip into its place on the canvas, one clear for all of it. */
function drawPlanned(
  held: Held,
  planned: readonly Planned[],
  renderers: ReadonlyMap<string, Waveform | null>,
  canvas: HTMLCanvasElement,
  ratio: number
) {
  const ink = getComputedStyle(canvas).color;
  const light = isLight(ink);
  // One clear for the whole canvas: the renderers only draw, a clip's layers one over the other.
  const gl = held.context;
  gl?.clearColor(0, 0, 0, 0);
  gl?.clear(gl.COLOR_BUFFER_BIT);
  for (const { each, rows } of planned) {
    const entry = each.entry as WaveformClip;
    for (const row of rows) {
      const renderer = renderers.get(row.key);
      if (!renderer) {
        continue;
      }
      const scale = Math.max(row.peak, 1e-6) / Math.max(entry.gain, 1e-6);
      // The data is handed over only when it changed: the same samples are not uploaded again.
      const changed = !sameSamples(held.data.get(row.key), row.data);
      held.data.set(row.key, row.data);
      // Rows of channels are told apart by a pixel of ground between them.
      const gap = rows.length > 1 && row.layer === "plain" ? 1 : 0;
      for (const part of each.parts) {
        renderer
          .update({
            amplitude: [-scale, scale],
            color: colorOf(row.layer, ink, light),
            ...(changed ? { data: row.data } : {}),
            pixelRatio: ratio,
            range: part.frames,
            viewport: [part.x, row.y, part.width, Math.max(1, row.h - gap)],
          })
          .render();
      }
    }
  }
}

/** Draws every clip of the lane the view shows, each into its own parts of the one canvas. A recording has one renderer a row, drawn once for each part of each clip that reads it. */
async function paint({
  body,
  canvas,
  held,
  inputs,
  view,
}: LaneContext<Held, WaveformInputs>): Promise<boolean> {
  const { clips, layout = "auto", look, zoom } = inputs();
  const placed = zoom > 0 ? placeLane(canvas, body, view) : null;
  if (!placed) {
    return false;
  }
  const planned = await plan(
    await visibleClips(clips, placed, zoom),
    layout,
    look,
    canvas.clientHeight
  );
  const renderers = new Map<string, Waveform | null>();
  await Promise.all(
    planned.flatMap(({ rows }) =>
      rows.map(async (row) => {
        if (!renderers.has(row.key)) {
          renderers.set(row.key, null);
          renderers.set(
            row.key,
            await rendererOf(canvas, held, row.key, row.data)
          );
        }
      })
    )
  );
  if (held.gone) {
    return false;
  }
  drawPlanned(held, planned, renderers, canvas, placed.ratio);
  // Rows the lane no longer draws let go of their textures.
  const alive = new Set(
    planned.flatMap(({ rows }) => rows.map((row) => row.key))
  );
  for (const [key, renderer] of held.renderers) {
    if (!alive.has(key)) {
      renderer.destroy();
      held.renderers.delete(key);
      held.data.delete(key);
    }
  }
  return false;
}

/**
 * Draws the waveforms of a lane's clips on `canvas`, which sits in the lane's
 * box, each clip in its own parts of it, on the GPU by `gl-waveform`: every
 * pixel column shows the exact lowest and highest of its samples with the RMS
 * inside, and zoomed in a line through the samples, however long the
 * recording. All the clips share one WebGL context, and clips of one
 * recording share what is on the GPU for it. A clip is read in stretches, as a
 * DAW paints it (`LaneClip.segments`); a stretch read backwards is not drawn,
 * `gl-waveform` has no such range, so a reversed clip is the host's own
 * drawing, and `hasWebGL2` of `@audio-ui/gl/lane` says whether to draw this
 * way at all. The color is the canvas' text color.
 *
 * With `look: "bands"` each clip is drawn as the three bands of its sound one
 * over the other, the lows warm and the highs cool, as DJ software colours a
 * sound.
 */
export function createWaveformLane(
  canvas: HTMLCanvasElement,
  inputs: WaveformInputs
): Lane<WaveformInputs> {
  return createLane<Held, WaveformInputs>({
    canvas,
    create: () => ({
      context: null,
      data: new Map(),
      gone: false,
      renderers: new Map(),
    }),
    destroy: (held) => {
      for (const renderer of held.renderers.values()) {
        renderer.destroy();
      }
    },
    inputs,
    paint,
  });
}

export {
  hasWebGL2,
  type Lane,
  type LaneClip,
  type LaneSamples,
} from "../lane/index.ts";
