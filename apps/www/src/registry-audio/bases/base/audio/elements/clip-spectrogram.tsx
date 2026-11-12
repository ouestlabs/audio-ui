import type Spectrogram from "gl-spectrogram";
import type { Scale } from "gl-spectrogram";
import { type ComponentProps, useLayoutEffect, useRef } from "react";
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
  useLayoutEffect(() => {
    const canvas = ref.current;
    const body = canvas?.parentElement;
    if (!(canvas && body)) {
      return;
    }
    const view = canvas.closest<HTMLElement>('[data-slot="timeline-viewport"]');
    const held: Held = { gone: false, paints: 0, renderer: null };
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
      held.renderer?.destroy();
    };
  }, [clip, gain, sampleRate, samples, scale]);
  return (
    <canvas
      className={cn("pointer-events-none absolute", className)}
      data-slot="timeline-clip-spectrogram"
      ref={ref}
      {...props}
    />
  );
}

export { ClipSpectrogram };
