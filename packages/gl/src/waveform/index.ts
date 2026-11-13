import type Waveform from "gl-waveform";
import {
  createLane,
  type Lane,
  type LaneClip,
  type LaneContext,
  placeLane,
  sameSamples,
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

/** What a waveform lane draws. */
export interface WaveformInputs {
  clips: readonly WaveformClip[];
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

/** The layers a clip draws, each with its samples and the loudest of them: its recording whole, or its three bands. */
function layersOf(
  entry: WaveformClip,
  data: ArrayLike<number>,
  look: WaveformLook
): [Layer, ArrayLike<number>, number][] {
  if (look === "bands" && entry.bands) {
    const { high, low, mid, peaks } = entry.bands();
    return [
      ["low", low, peaks?.low ?? entry.peak],
      ["mid", mid, peaks?.mid ?? entry.peak],
      ["high", high, peaks?.high ?? entry.peak],
    ];
  }
  return [["plain", data, entry.peak]];
}

/** Draws every clip of the lane the view shows, each into its own parts of the one canvas. A recording has one renderer, drawn once for each part of each clip that reads it. */
async function paint({
  body,
  canvas,
  held,
  inputs,
  view,
}: LaneContext<Held, WaveformInputs>): Promise<boolean> {
  const { clips, look, zoom } = inputs();
  const placed = zoom > 0 ? placeLane(canvas, body, view) : null;
  if (!placed) {
    return false;
  }
  const visible = await visibleClips(clips, placed, zoom);
  const drawn = visible.flatMap((each) =>
    layersOf(each.entry as WaveformClip, each.data, look).map(
      ([layer, data, peak]) => ({
        data,
        each,
        key: `${each.entry.source}:${layer}`,
        layer,
        peak,
      })
    )
  );
  const renderers = new Map<string, Waveform | null>();
  await Promise.all(
    drawn.map(async (layer) => {
      if (!renderers.has(layer.key)) {
        renderers.set(layer.key, null);
        renderers.set(
          layer.key,
          await rendererOf(canvas, held, layer.key, layer.data)
        );
      }
    })
  );
  if (held.gone) {
    return false;
  }
  const ink = getComputedStyle(canvas).color;
  const light = isLight(ink);
  const height = canvas.clientHeight;
  // One clear for the whole canvas: the renderers only draw, a clip's layers one over the other.
  const gl = held.context;
  gl?.clearColor(0, 0, 0, 0);
  gl?.clear(gl.COLOR_BUFFER_BIT);
  for (const layer of drawn) {
    const renderer = renderers.get(layer.key);
    if (!renderer) {
      continue;
    }
    const entry = layer.each.entry as WaveformClip;
    const scale = Math.max(layer.peak, 1e-6) / Math.max(entry.gain, 1e-6);
    // The data is handed over only when it changed: the same samples are not uploaded again.
    const changed = !sameSamples(held.data.get(layer.key), layer.data);
    held.data.set(layer.key, layer.data);
    for (const part of layer.each.parts) {
      renderer
        .update({
          amplitude: [-scale, scale],
          color: colorOf(layer.layer, ink, light),
          ...(changed ? { data: layer.data } : {}),
          pixelRatio: placed.ratio,
          range: part.frames,
          viewport: [part.x, 0, part.width, height],
        })
        .render();
    }
  }
  // Recordings the lane no longer draws let go of their textures.
  const alive = new Set(drawn.map((layer) => layer.key));
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
