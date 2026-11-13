import type Waveform from "gl-waveform";
import { type ComponentProps, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type GlLaneContext,
  type LaneClip,
  placeLane,
  sameSamples,
  useGlLane,
  visibleClips,
} from "@/registry-audio/bases/base/hooks/use-gl-lane";

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

const LAYERS = ["low", "mid", "high"] as const;
type Layer = (typeof LAYERS)[number] | "plain";

/** What one paint of the lane draws. */
interface WaveformInputs {
  clips: readonly WaveformClip[];
  look: WaveformLook;
  zoom: number;
}

/** What the lane keeps between paints: a renderer a clip and a layer, all on one WebGL context. */
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

/** The layers a clip draws and their samples: its recording whole, or its three bands. */
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

/** Draws every clip of the lane the view shows, each into its own part of the one canvas. */
async function paintLane({
  body,
  canvas,
  held,
  inputs,
  view,
}: GlLaneContext<Held, WaveformInputs>): Promise<boolean> {
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
        key: `${each.entry.id}:${layer}`,
        layer,
        peak,
      })
    )
  );
  const renderers = await Promise.all(
    drawn.map((layer) => rendererOf(canvas, held, layer.key, layer.data))
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
  for (const [index, layer] of drawn.entries()) {
    const renderer = renderers[index];
    if (!renderer) {
      continue;
    }
    const { each } = layer;
    const entry = each.entry as WaveformClip;
    const scale = Math.max(layer.peak, 1e-6) / Math.max(entry.gain, 1e-6);
    // The data is handed over only when it changed: the same samples are not uploaded again.
    const changed = !sameSamples(held.data.get(layer.key), layer.data);
    held.data.set(layer.key, layer.data);
    renderer
      .update({
        amplitude: [-scale, scale],
        color: colorOf(layer.layer, ink, light),
        ...(changed ? { data: layer.data } : {}),
        pixelRatio: placed.ratio,
        range: each.frames,
        viewport: [each.x, 0, each.width, height],
      })
      .render();
  }
  // Layers the lane no longer draws let go of their textures.
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
 * The waveforms of a lane's clips on one canvas, each in its own part of it,
 * drawn on the GPU by `gl-waveform`: every pixel column shows the exact
 * lowest and highest of its samples with the RMS inside, and zoomed in a line
 * through the samples, however long the recording. All the clips share one
 * WebGL context, since a browser keeps some sixteen and drops the oldest past
 * that. Put it in the lane's box, `zoom` being the lane's pixels a second. A
 * clip is a stretch of its recording, as the audio editor has them; a looped,
 * reversed or warped clip is `ClipWaveform`'s. It needs WebGL 2, and draws
 * nothing without it: `hasWebGL2` says whether to draw another way.
 *
 * With `look="bands"` each clip is drawn as the three bands of its sound
 * (`bands`, from `splitBands` of `@audio-ui/engine/analysis`) one over the
 * other, the lows warm and the highs cool, as DJ software colours a sound.
 */
function WaveformLane({
  className,
  clips,
  look = "plain",
  zoom,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  clips: readonly WaveformClip[];
  look?: WaveformLook;
  /** The lane's pixels a second. */
  zoom: number;
}) {
  const inputs = useMemo<WaveformInputs>(
    () => ({ clips, look, zoom }),
    [clips, look, zoom]
  );
  const ref = useGlLane<Held, WaveformInputs>({
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
    paint: paintLane,
  });
  return (
    <canvas
      className={cn("pointer-events-none absolute inset-y-0", className)}
      data-slot="timeline-clip-waveform-gl"
      ref={ref}
      {...props}
    />
  );
}

export { WaveformLane };
