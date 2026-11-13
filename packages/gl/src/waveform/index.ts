import type Waveform from "gl-waveform";
import {
  type ChunkFeed,
  clearLane,
  createLane,
  feedChunks,
  keepContext,
  type Lane,
  type LaneClip,
  type LaneContext,
  type LaneSamples,
  partsInView,
  placeLane,
  readKept,
  releaseContext,
  type SampleCache,
  sameSamples,
  type VisiblePart,
} from "../lane/index.ts";

/** The three signals a sound is split into to colour it by its frequencies: what it has low, between and high. */
export interface WaveformBands {
  /** Each band's samples at hand, or for a recording streamed from a file a reader of them that gives its `leaves`, read as a channel is. */
  high: ArrayLike<number> | LaneSamples;
  low: ArrayLike<number> | LaneSamples;
  mid: ArrayLike<number> | LaneSamples;
  /** The loudest sample of each band, 0 to 1: each is drawn as tall as its own loudest reaches, so a band that is quiet in the mix still shows. Left out, a streamed band's is read from its leaves. */
  peaks?: { high: number; low: number; mid: number };
}

/** Whether a band is a reader of its samples, not the samples themselves. */
const isReader = (band: ArrayLike<number> | LaneSamples): band is LaneSamples =>
  typeof (band as LaneSamples).read === "function";

/** A clip of the lane, with what its waveform needs besides what every lane clip has. */
export interface WaveformClip extends LaneClip {
  /** Read when the lane draws by band: the recording as three signals. Called once a recording, so it may be a lazy split. */
  bands?: () => WaveformBands;
  /** The loudest sample of the recording, 0 to 1: the waveform is drawn as tall as the loudest reaches the lane's height. Left out, the lane reads it, from a streamed recording's leaves or from its samples once read: the loudest of its channels when it draws them a row each. */
  peak?: number;
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
  /** The lane's pixels a second. Left out, the lane fits its clips to its box: the end of the last at its right edge, as a clip's own lane is. */
  zoom?: number;
}

/** How a waveform lane draws. */
export interface WaveformLaneOptions {
  /**
   * Draw on the page's one WebGL context, shared by every lane made so, and
   * copy the picture onto `canvas`, a 2D canvas: a page then has as many
   * lanes as it likes, past the sixteen contexts a browser keeps, as a lane a
   * clip does, and lanes reading one recording share what is on the GPU for
   * it. @default false
   */
  shared?: boolean;
}

type Layer = "high" | "low" | "mid" | "plain";

/** The frames a leaf of `waveformLeaves` sums up. */
export const LEAF_FRAMES = 256;

/**
 * The leaves of `samples`, from its first frame: `[min, max, Σx², count]` of
 * each 256 frames, the last leaf of what is left, NaN left out (a leaf of
 * nothing else is `[Infinity, -Infinity, 0, 0]`). What `LaneSamples.leaves`
 * gives for a recording streamed from a file: made once, as the recording is
 * written, and kept beside it. The leaves of stretches that follow one another,
 * each a multiple of 256 frames long but the last, laid end to end, are the
 * leaves of the whole.
 */
export function waveformLeaves(
  samples: ArrayLike<number>
): Float32Array<ArrayBuffer> {
  const count = Math.ceil(samples.length / LEAF_FRAMES);
  const leaves = new Float32Array(count * 4);
  for (let leaf = 0; leaf < count; leaf += 1) {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let power = 0;
    let held = 0;
    const end = Math.min(samples.length, (leaf + 1) * LEAF_FRAMES);
    for (let index = leaf * LEAF_FRAMES; index < end; index += 1) {
      const value = samples[index] as number;
      if (!Number.isNaN(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
        power += value * value;
        held += 1;
      }
    }
    leaves[leaf * 4] = min;
    leaves[leaf * 4 + 1] = max;
    leaves[leaf * 4 + 2] = power;
    leaves[leaf * 4 + 3] = held;
  }
  return leaves;
}

/** The loudest sample the leaves sum up, 0 to 1 for a recording at full scale at most: what a streamed clip's `peak` is. */
export function leavesPeak(leaves: ArrayLike<number>): number {
  let loudest = 0;
  for (let at = 0; at + 3 < leaves.length; at += 4) {
    if ((leaves[at + 3] as number) > 0) {
      loudest = Math.max(
        loudest,
        Math.abs(leaves[at] as number),
        Math.abs(leaves[at + 1] as number)
      );
    }
  }
  return loudest;
}

/** The loudest of leaves read so far, by the leaves: read once, not at every paint. */
const leafPeaks = new WeakMap<object, number>();

const peakOfLeaves = (leaves: ArrayLike<number>) => {
  const kept = leafPeaks.get(leaves);
  if (kept !== undefined) {
    return kept;
  }
  const peak = leavesPeak(leaves);
  leafPeaks.set(leaves, peak);
  return peak;
};

/** The loudest of samples read so far, by the samples: read once, not at every paint. */
const samplePeaks = new WeakMap<object, number>();

const peakOfSamples = (samples: ArrayLike<number>) => {
  const kept = samplePeaks.get(samples);
  if (kept !== undefined) {
    return kept;
  }
  let peak = 0;
  for (const value of Array.prototype.values.call(
    samples
  ) as Iterable<number>) {
    peak = Math.max(peak, Math.abs(value) || 0);
  }
  samplePeaks.set(samples, peak);
  return peak;
};

/**
 * Where lanes' renderers live: a WebGL context and what is on it, a renderer
 * a row, with how many lanes draw each. A lane has one of its own, or shares
 * the page's.
 */
interface Stage {
  /** The canvas the shared renderers draw on, off the page; null for a lane's own, which draws on its canvas. */
  canvas: HTMLCanvasElement | null;
  context: WebGL2RenderingContext | null;
  /** What each row's renderer was last handed: its samples, or a streamed recording's leaves. */
  data: Map<string, ArrayLike<number>>;
  /** The chunks each streamed row's renderer holds. */
  feeds: Map<string, ChunkFeed>;
  /** What draws each row again, for every lane that draws it: a chunk read for one is drawn by all. */
  lanes: Map<string, Set<() => void>>;
  renderers: Map<string, Waveform>;
  /** What was read for each row, its samples or a streamed recording's leaves, so it is read once, not at every paint. */
  samples: SampleCache;
}

const emptyStage = (canvas: HTMLCanvasElement | null): Stage => ({
  canvas,
  context: null,
  data: new Map(),
  feeds: new Map(),
  lanes: new Map(),
  renderers: new Map(),
  samples: new Map(),
});

/** The page's stage, made when a shared lane first draws: its canvas is never on the page. */
let pageStage: Stage | null = null;

/** What a lane keeps between paints: its stage, and the rows it holds there. */
interface Held {
  gone: boolean;
  /** The rows the lane drew last: it holds their renderers on the stage. */
  holds: Set<string>;
  /** What draws the lane again, once it has drawn. */
  later: (() => void) | null;
  stage: Stage;
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

/** `gl-waveform`, once loaded: loaded when a lane first draws, then at hand, so a lane draws at once from then on. */
let loaded: typeof import("gl-waveform").default | null = null;

/** Loads `gl-waveform`, once. */
async function loadRenderer() {
  loaded ??= (await import("gl-waveform")).default;
  return loaded;
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

/** A row before its samples are read: the channel it draws, or a band's samples at hand. */
interface RowPlan extends Omit<WaveformRow, "data" | "peak"> {
  channel?: number;
  data?: ArrayLike<number>;
  /** How tall it is drawn: left out, read from what its renderer is handed. */
  peak?: number;
  /** Whether its peak is read from its leaves: a streamed band given none. */
  peakOfLeaves?: boolean;
  /** A band's own reader. */
  reader?: LaneSamples;
}

/** The rows a clip draws in a lane `height` px tall: a row for each of `channels` channels, its three bands, or its recording whole. */
function rowsOf(
  entry: WaveformClip,
  channels: number,
  look: WaveformLook,
  height: number
): RowPlan[] {
  const { source } = entry;
  if (channels > 0) {
    const h = height / channels;
    return Array.from({ length: channels }, (_, index) => ({
      channel: index,
      h,
      key: `${source}:channel${index}`,
      layer: "plain",
      peak: entry.peak,
      y: index * h,
    }));
  }
  if (look === "bands" && entry.bands) {
    const { high, low, mid, peaks } = entry.bands();
    const band = (
      layer: Layer,
      value: ArrayLike<number> | LaneSamples,
      peak?: number
    ): RowPlan => ({
      ...(isReader(value)
        ? { peakOfLeaves: peak === undefined, reader: value }
        : { data: value }),
      h: height,
      key: `${source}:${layer}`,
      layer,
      peak: peak ?? entry.peak,
      y: 0,
    });
    return [
      band("low", low, peaks?.low),
      band("mid", mid, peaks?.mid),
      band("high", high, peaks?.high),
    ];
  }
  return [
    {
      h: height,
      key: `${source}:plain`,
      layer: "plain",
      peak: entry.peak,
      y: 0,
    },
  ];
}

/** The rows a clip draws in a lane `height` px tall, with the samples of each: a channel apiece (`channels`, read), its recording whole, or its three bands. */
export function waveformRows(
  entry: WaveformClip,
  data: ArrayLike<number>,
  channels: readonly ArrayLike<number>[] | null,
  look: WaveformLook,
  height: number
): WaveformRow[] {
  return rowsOf(entry, channels?.length ?? 0, look, height).map(
    ({
      channel,
      data: band,
      peak,
      peakOfLeaves: _peak,
      reader: _reader,
      ...row
    }) => ({
      ...row,
      peak: peak ?? 1,
      data:
        band ?? (channel === undefined ? data : (channels?.[channel] ?? data)),
    })
  );
}

/** The reader of a row: its channel's, or the recording's mix. */
const readerOf = (entry: WaveformClip, row: RowPlan): LaneSamples =>
  row.reader ??
  (row.channel === undefined ? undefined : entry.channels?.[row.channel]) ??
  entry.samples;

/** Whether a row is drawn from a streamed recording's leaves, not from its samples read whole. */
const streams = (entry: WaveformClip, row: RowPlan) =>
  !row.data && Boolean(readerOf(entry, row).leaves);

/** What a row is drawn from, read once: a band's samples, a streamed recording's leaves, or its samples whole. At once when at hand, else a promise. */
function readRow(
  stage: Stage,
  entry: WaveformClip,
  row: RowPlan
): ArrayLike<number> | Promise<ArrayLike<number>> {
  if (row.data) {
    return row.data;
  }
  const reader = readerOf(entry, row);
  if (reader.leaves) {
    return readKept(
      stage.samples,
      `${row.key}:leaves`,
      reader,
      () => reader.leaves?.() ?? []
    );
  }
  return readKept(stage.samples, row.key, reader, () =>
    reader.read(0, reader.frames)
  );
}

/** A clip the view shows, with its parts and the rows it draws. */
interface Planned {
  entry: WaveformClip;
  parts: VisiblePart[];
  rows: RowPlan[];
}

/**
 * The renderer of a row, handed what it draws from: made on the lane's one
 * context the first time (the first makes it, the others share it), then
 * handed only what changed, so the same samples are not uploaded again. A
 * streamed row is handed its leaves, and starts over for new ones. Null when
 * it cannot be made, and the canvas hides.
 */
function rendererOf(
  Renderer: typeof import("gl-waveform").default,
  canvas: HTMLCanvasElement,
  stage: Stage,
  key: string,
  data: ArrayLike<number>,
  streamed: boolean
): Waveform | null {
  let made = stage.renderers.get(key);
  const changed = !sameSamples(stage.data.get(key), data);
  if (made && changed && streamed) {
    made.destroy();
    stage.renderers.delete(key);
    stage.feeds.delete(key);
    made = undefined;
  }
  if (made) {
    if (changed) {
      made.update({ data });
    }
  } else {
    try {
      made = new Renderer(
        stage.context ?? stage.canvas ?? canvas,
        streamed ? {} : { data }
      );
      if (streamed) {
        made.peaks(data, 0);
      }
      stage.context ??= made.gl as WebGL2RenderingContext;
      stage.renderers.set(key, made);
    } catch {
      canvas.style.display = "none";
      return null;
    }
  }
  stage.data.set(key, data);
  return made;
}

/** The frames of a device pixel in a part, the closest zoom of it. */
const framesPerPixel = (part: VisiblePart, ratio: number) =>
  (part.frames[1] - part.frames[0]) / Math.max(1, part.width * ratio);

/**
 * Hands each streamed row the chunks its parts read where a leaf is wider
 * than a device pixel: zoomed out, the leaves draw it alone.
 */
function feedRows(
  context: LaneContext<Held, WaveformInputs>,
  planned: readonly Planned[],
  renderers: ReadonlyMap<string, Waveform | null>,
  ratio: number
) {
  const { stage } = context.held;
  const ranges = new Map<
    string,
    { reader: LaneSamples; frames: [number, number][] }
  >();
  for (const { entry, parts, rows } of planned) {
    for (const row of rows.filter((each) => streams(entry, each))) {
      const kept = ranges.get(row.key) ?? {
        frames: [],
        reader: readerOf(entry, row),
      };
      ranges.set(row.key, kept);
      for (const part of parts) {
        if (framesPerPixel(part, ratio) < LEAF_FRAMES) {
          kept.frames.push(part.frames);
        }
      }
    }
  }
  for (const [key, { frames, reader }] of ranges) {
    const renderer = renderers.get(key);
    if (!renderer) {
      continue;
    }
    const feed = stage.feeds.get(key) ?? { held: [], reading: new Set() };
    stage.feeds.set(key, feed);
    feedChunks(
      feed,
      reader,
      frames,
      renderer,
      // Every lane that draws the row draws the chunk in.
      () => {
        for (const later of stage.lanes.get(key) ?? []) {
          later();
        }
      },
      () => stage.renderers.get(key) === renderer
    );
  }
}

/**
 * What the lane draws at this zoom, as the renderer does: `columns` while a
 * pixel column holds a sample or more, each its exact lowest and highest,
 * `line` once a sample is wider than a pixel, a line through the samples with
 * a dot on each. Set on the canvas as `data-detail`, for a page to style or
 * test by.
 */
function detailOf(planned: readonly Planned[], ratio: number): string {
  const closest = planned
    .flatMap(({ parts }) => parts.map((part) => framesPerPixel(part, ratio)))
    .reduce(
      (least, perPixel) => Math.min(least, perPixel),
      Number.POSITIVE_INFINITY
    );
  return closest < 1 ? "line" : "columns";
}

/** The renderer of every row the clips draw, made where it lacks, by the row's key. */
function renderersOf(
  Renderer: typeof import("gl-waveform").default,
  { canvas, held: { stage } }: LaneContext<Held, WaveformInputs>,
  planned: readonly Planned[],
  reads: ReadonlyMap<string, ArrayLike<number>>
): Map<string, Waveform | null> {
  const renderers = new Map<string, Waveform | null>();
  for (const { entry, rows } of planned) {
    for (const row of rows) {
      const data = reads.get(row.key);
      if (data && !renderers.has(row.key)) {
        renderers.set(
          row.key,
          rendererOf(
            Renderer,
            canvas,
            stage,
            row.key,
            data,
            streams(entry, row)
          )
        );
      }
    }
  }
  return renderers;
}

/** Draws each part of each clip into its place on the canvas, every row of it, one clear for all of it. */
/** The loudest a row's renderer was handed: from its leaves, or its samples. */
const peakOfRow = (stage: Stage, entry: WaveformClip, row: RowPlan): number => {
  const data = stage.data.get(row.key) ?? [];
  return streams(entry, row) ? peakOfLeaves(data) : peakOfSamples(data);
};

/**
 * How tall each row of a clip is drawn: as its band's own loudest, a band
 * given none read from its leaves; the rest at the clip's peak, read from the
 * rows when it is given none, the loudest of them, so channels compare.
 */
function peaksOf(stage: Stage, entry: WaveformClip, rows: readonly RowPlan[]) {
  const plain = rows.filter((row) => row.layer === "plain");
  const clip =
    entry.peak ??
    Math.max(0, ...plain.map((row) => peakOfRow(stage, entry, row)));
  return rows.map((row) => {
    if (row.layer === "plain") {
      return clip;
    }
    return row.peakOfLeaves || row.peak === undefined
      ? peakOfRow(stage, entry, row)
      : row.peak;
  });
}

function drawRows(
  { canvas, held: { stage } }: LaneContext<Held, WaveformInputs>,
  planned: readonly Planned[],
  renderers: ReadonlyMap<string, Waveform | null>,
  ratio: number
) {
  const ink = getComputedStyle(canvas).color;
  const light = isLight(ink);
  // One clear for the whole canvas: the renderers only draw, a clip's layers one over the other.
  clearLane(stage.context);
  for (const { entry, parts, rows } of planned) {
    const peaks = peaksOf(stage, entry, rows);
    for (const [index, row] of rows.entries()) {
      const renderer = renderers.get(row.key);
      const scale =
        Math.max(peaks[index] ?? 1, 1e-6) / Math.max(entry.gain, 1e-6);
      // Rows of channels are told apart by a pixel of ground between them.
      const gap = rows.length > 1 && row.layer === "plain" ? 1 : 0;
      for (const part of renderer ? parts : []) {
        renderer
          ?.update({
            amplitude: [-scale, scale],
            color: colorOf(row.layer, ink, light),
            pixelRatio: ratio,
            range: part.frames,
            viewport: [part.x, row.y, part.width, Math.max(1, row.h - gap)],
          })
          .render();
      }
    }
  }
}

/** Draws the rows on the canvas, making the renderers they lack, handing streamed ones what the view reads, and letting go of the ones no row draws. */
function draw(
  Renderer: typeof import("gl-waveform").default,
  context: LaneContext<Held, WaveformInputs>,
  planned: readonly Planned[],
  reads: ReadonlyMap<string, ArrayLike<number>>,
  ratio: number
): boolean {
  const { canvas, held } = context;
  if (held.gone) {
    return false;
  }
  const { stage } = held;
  if (stage.canvas) {
    fitStage(stage.canvas, canvas);
  }
  const renderers = renderersOf(Renderer, context, planned, reads);
  held.later = context.later;
  hold(held, new Set(renderers.keys()));
  feedRows(context, planned, renderers, ratio);
  drawRows(context, planned, renderers, ratio);
  if (stage.canvas) {
    copyStage(stage.canvas, canvas);
  }
  canvas.dataset.detail = detailOf(planned, ratio);
  return false;
}

/** The page's canvas at least as large as a lane's: it only grows, as a resize empties it. */
function fitStage(stage: HTMLCanvasElement, canvas: HTMLCanvasElement) {
  if (stage.width < canvas.width) {
    stage.width = canvas.width;
  }
  if (stage.height < canvas.height) {
    stage.height = canvas.height;
  }
}

/** What the page's canvas holds of a lane, from its top left corner, onto the lane's own. */
function copyStage(stage: HTMLCanvasElement, canvas: HTMLCanvasElement) {
  const flat = canvas.getContext("2d");
  if (!flat) {
    return;
  }
  flat.clearRect(0, 0, canvas.width, canvas.height);
  flat.drawImage(
    stage,
    0,
    0,
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
}

/**
 * The lane holds the rows it draws now, and lets go of those it drew before
 * and no longer does: a row no lane holds lets go of its renderer.
 */
function hold(held: Held, now: ReadonlySet<string>) {
  const { later, stage } = held;
  for (const key of now) {
    if (later && !held.holds.has(key)) {
      const lanes = stage.lanes.get(key) ?? new Set();
      lanes.add(later);
      stage.lanes.set(key, lanes);
    }
  }
  for (const key of held.holds) {
    if (!now.has(key)) {
      release(stage, key, later);
    }
  }
  held.holds = new Set(now);
}

/** A lane no longer draws a row: once none does, its renderer and what it read are let go of. */
function release(stage: Stage, key: string, later: (() => void) | null) {
  const lanes = stage.lanes.get(key);
  if (later) {
    lanes?.delete(later);
  }
  if (lanes && lanes.size > 0) {
    return;
  }
  stage.lanes.delete(key);
  stage.renderers.get(key)?.destroy();
  stage.renderers.delete(key);
  stage.data.delete(key);
  stage.feeds.delete(key);
  // A lane's own stage keeps what it read, for a view it comes back to; the page's lets it go, for recordings no longer drawn.
  if (stage === pageStage) {
    stage.samples.delete(key);
    stage.samples.delete(`${key}:leaves`);
  }
}

/**
 * Draws every clip of the lane the view shows, each into its own parts of the
 * one canvas: at once when the renderer is loaded and what its rows draw from
 * is at hand, so a zoom shows in the frame it happens, else once it is. A
 * recording has one renderer a row, drawn once for each part of each clip that
 * reads it.
 */
function paint(
  context: LaneContext<Held, WaveformInputs>
): boolean | Promise<boolean> {
  const { body, canvas, held, inputs, view } = context;
  const { clips, layout = "auto", look } = inputs();
  // Fitted, the end of the last clip is at the box's right edge.
  const zoom =
    inputs().zoom ??
    body.getBoundingClientRect().width /
      Math.max(1e-9, ...clips.map((clip) => clip.start + clip.length));
  const placed = zoom > 0 ? placeLane(canvas, body, view) : null;
  if (!placed) {
    return false;
  }
  const height = canvas.clientHeight;
  const planned = partsInView(clips, placed, zoom).map(({ entry, parts }) => {
    const clip = entry as WaveformClip;
    const split = splitsChannels(clip, layout, look, height);
    return {
      entry: clip,
      parts,
      rows: rowsOf(
        clip,
        split ? (clip.channels?.length ?? 0) : 0,
        look,
        height
      ),
    };
  });
  const reads = new Map<
    string,
    ArrayLike<number> | Promise<ArrayLike<number>>
  >();
  for (const { entry, rows } of planned) {
    for (const row of rows) {
      if (!reads.has(row.key)) {
        reads.set(row.key, readRow(held.stage, entry, row));
      }
    }
  }
  const later = [...reads.values()].some((read) => read instanceof Promise);
  if (loaded && !later) {
    return draw(
      loaded,
      context,
      planned,
      reads as Map<string, ArrayLike<number>>,
      placed.ratio
    );
  }
  return (async () => {
    const Renderer = await loadRenderer();
    const settled = new Map(
      await Promise.all(
        [...reads].map(async ([key, read]) => [key, await read] as const)
      )
    );
    return draw(Renderer, context, planned, settled, placed.ratio);
  })();
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
 * A recording streamed from a file gives its `leaves` (`LaneSamples.leaves`)
 * and is never read whole: zoomed out it is drawn from them, and once a leaf
 * is wider than a device pixel the lane reads the frames it shows, a chunk of
 * `CHUNK_FRAMES` at a time, letting go of the oldest it no longer shows.
 *
 * With `look: "bands"` each clip is drawn as the three bands of its sound one
 * over the other, the lows warm and the highs cool, as DJ software colours a
 * sound.
 */
export function createWaveformLane(
  canvas: HTMLCanvasElement,
  inputs: WaveformInputs,
  { shared = false }: WaveformLaneOptions = {}
): Lane<WaveformInputs> {
  keepContext(canvas);
  return createLane<Held, WaveformInputs>({
    canvas,
    create: () => {
      if (shared) {
        pageStage ??= emptyStage(document.createElement("canvas"));
      }
      return {
        gone: false,
        holds: new Set(),
        later: null,
        stage: shared && pageStage ? pageStage : emptyStage(null),
      };
    },
    destroy: (held) => {
      // A shared lane lets go of its rows; the page's stage stays for the other lanes.
      if (held.stage === pageStage) {
        hold(held, new Set());
        return;
      }
      for (const renderer of held.stage.renderers.values()) {
        renderer.destroy();
      }
      releaseContext(canvas, held.stage.context);
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
