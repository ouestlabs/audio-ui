import { type ComponentProps, useLayoutEffect, useRef } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type ClipPeaks,
  type ClipReading,
  clipFramePositions,
  clipPeakCount,
  clipWaveform,
  clipWaveformBands,
  framesToRead,
  sampleBands,
  sampleLine,
} from "@/registry-audio/bases/base/lib/arrangement";

/**
 * A recording's samples, for a waveform drawn closer than its peaks allow:
 * how many frames it holds, and a reader of the frames from `from` to `to`
 * (one level per frame, -1 to 1), at once or once read from where it is kept.
 */
export interface ClipSamples {
  frames: number;
  read: (
    from: number,
    to: number
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
}

/**
 * What each slice of a recording is made of, to colour its waveform by: the
 * share of its lows, mids and highs (each from 0 to 1) over as many slices as
 * its peaks, and how to colour them: `temperature` warm where the lows lead and
 * cool where the highs do, `bands` the lows as red, the mids green and the
 * highs blue.
 */
export interface ClipTint {
  high: ArrayLike<number>;
  low: ArrayLike<number>;
  mid: ArrayLike<number>;
  mode: "bands" | "temperature";
}

/** The samples last read for a view, frames `from` to `to`: being read, or read. */
interface SampleWindow {
  from: number;
  samples: ClipSamples;
  to: number;
  values: ArrayLike<number> | Promise<ArrayLike<number>>;
}

/** From this many CSS px between two samples, each one gets a dot, full size at twice that. */
const SAMPLE_DOT_PX = 6;
/** The most frames read at once: past it, the peaks are drawn instead. */
const MOST_FRAMES_READ = 2 ** 22;
/** Under this many peaks per column, the samples are read ahead, so the zoom that needs them finds them read. */
const READ_AHEAD = 2;

/**
 * How far past each side of what shows an audio clip's waveform is drawn, in
 * px: a scroll finds it drawn, and draws it again only once past half of this.
 */
const WAVEFORM_OVERSCAN = 512;
const THEME_ATTRIBUTES = ["class", "data-theme", "style"];

/** Where and how a paint inks: its context, its size and the zero line in device px, its color and pixel ratio. */
interface Ink {
  color: string;
  columns: number;
  context: CanvasRenderingContext2D;
  rows: number;
  scale: number;
  /** One colour a column, when the waveform is tinted. */
  tints?: string[];
  zero: number;
}

/** How many frames a column spans, the median of them all, so a loop's turn doesn't count. */
function framesPerColumnOf(positions: readonly number[]) {
  const steps = positions
    .slice(1)
    .map((position, column) => Math.abs(position - (positions[column] ?? 0)))
    .sort((a, b) => a - b);
  return steps[steps.length >> 1] ?? Number.POSITIVE_INFINITY;
}

/**
 * The samples a paint draws from: the window kept, when it holds frames
 * `first` to `last`, else a new read of them and of `margin` frames more on
 * each side at least, so the zooms and scrolls that follow find them read.
 */
function sampleWindow(
  kept: { current: SampleWindow | null },
  samples: ClipSamples,
  [first, last]: readonly [number, number],
  margin: number
): SampleWindow {
  const held = kept.current;
  if (
    held &&
    held.samples === samples &&
    held.from <= first &&
    held.to >= last
  ) {
    return held;
  }
  const wide = Math.min(
    Math.max(last - first, margin),
    (MOST_FRAMES_READ - (last - first)) / 2
  );
  const from = Math.max(0, Math.floor(first - wide));
  const to = Math.min(samples.frames, Math.ceil(last + wide));
  const stretch: SampleWindow = {
    from,
    samples,
    to,
    values: samples.read(from, to),
  };
  kept.current = stretch;
  const { values } = stretch;
  if ("then" in values) {
    values.then(
      (read) => {
        if (kept.current === stretch) {
          kept.current = { ...stretch, values: read };
        }
      },
      () => {
        // Not read: the next paint tries again.
        if (kept.current === stretch) {
          kept.current = null;
        }
      }
    );
  }
  return stretch;
}

/** Whether a colour (`rgb(...)`, as a computed style gives) is light: the ink of a dark theme. */
function isLight(color: string) {
  const [red = 0, green = 0, blue = 0] = (color.match(/[\d.]+/g) ?? []).map(
    Number
  );
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.5;
}

/**
 * A colour for each column from the share of lows, mids and highs it holds:
 * `temperature` goes from orange through the ink's own grey to blue as the
 * highs outweigh the lows, at a lightness that reads on the screen; `bands`
 * mixes the lows as red, the mids as green and the highs as blue.
 */
function tintColumns(
  tint: ClipTint,
  clip: ClipReading,
  columns: number,
  range: readonly [number, number],
  light: boolean
): string[] {
  const read = (values: ArrayLike<number>) =>
    clipWaveform(clip, values, columns, range);
  const low = read(tint.low);
  const mid = read(tint.mid);
  const high = read(tint.high);
  const lightness = light ? 0.82 : 0.48;
  return Array.from({ length: columns }, (_, column) => {
    const l = low[column] ?? 0;
    const m = mid[column] ?? 0;
    const h = high[column] ?? 0;
    const total = l + m + h;
    if (tint.mode === "bands") {
      const top = Math.max(l, m, h) || 1;
      const mix = [l, m, h].map((value) =>
        Math.round((light ? 90 : 20) + (value / top) * (light ? 165 : 190))
      );
      return `rgb(${mix[0]} ${mix[1]} ${mix[2]})`;
    }
    // 0 where the lows are all of it, 1 where the highs are, the mids between.
    const place = total > 0 ? (0.5 * m + h) / total : 0.5;
    const warm = place < 0.5;
    const chroma = 0.15 * Math.abs(2 * place - 1);
    return `oklch(${lightness} ${chroma.toFixed(3)} ${warm ? 55 : 250})`;
  });
}

/** A gradient along the canvas with one stop a column, so each column wears its own colour. */
function gradientOf(
  context: CanvasRenderingContext2D,
  colors: readonly string[]
) {
  const gradient = context.createLinearGradient(0, 0, colors.length, 0);
  const every = Math.max(1, Math.floor(colors.length / 1000));
  for (let column = 0; column < colors.length; column += every) {
    gradient.addColorStop(
      Math.min(1, (column + 0.5) / colors.length),
      colors[column] as string
    );
  }
  return gradient;
}

/**
 * Paints a clip's waveform on its canvas, a column per pixel of the screen, for
 * the stretch of the clip the view shows: however wide the zoom makes the clip,
 * the canvas stays the size of the view, and a clip out of view paints nothing.
 */
function paintWaveform(
  canvas: HTMLCanvasElement,
  {
    clip,
    current,
    kept,
    peaks,
    samples,
    tint,
    view,
  }: {
    clip: ClipReading;
    current: () => boolean;
    kept: { current: SampleWindow | null };
    peaks: ClipPeaks;
    samples: ClipSamples | undefined;
    tint: ClipTint | undefined;
    view: HTMLElement | null;
  }
) {
  const box = canvas.parentElement?.getBoundingClientRect();
  const context = canvas.getContext("2d");
  if (!(box && context)) {
    return;
  }
  const sees =
    view?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const from = Math.max(0, sees.left - box.left - WAVEFORM_OVERSCAN);
  const to = Math.min(box.width, sees.right - box.left + WAVEFORM_OVERSCAN);
  if (
    to <= from ||
    box.bottom < sees.top - WAVEFORM_OVERSCAN ||
    box.top > sees.bottom + WAVEFORM_OVERSCAN
  ) {
    canvas.style.display = "none";
    canvas.width = 0;
    return;
  }
  canvas.style.display = "";
  canvas.style.left = `${from}px`;
  canvas.style.width = `${to - from}px`;
  const scale = window.devicePixelRatio || 1;
  const columns = Math.round((to - from) * scale);
  const rows = Math.round(canvas.clientHeight * scale);
  canvas.width = columns;
  canvas.height = rows;
  const { length } = clip.value;
  const range = [
    (from / box.width) * length,
    (to / box.width) * length,
  ] as const;
  const ink: Ink = {
    color: getComputedStyle(canvas).color,
    columns,
    context,
    rows,
    scale,
    // A line as wide as the pixel ratio lies crisp on silence: on a pixel's middle when odd, on its edge when even.
    zero:
      Math.round(scale) % 2 ? Math.floor(rows / 2) + 0.5 : Math.round(rows / 2),
  };
  const drawPeaks = () => {
    canvas.dataset.detail = "peaks";
    // Tinted, each column wears the colour of what it holds; closer in, where it draws samples, the ink is plain.
    inkBands(
      tint
        ? {
            ...ink,
            tints: tintColumns(tint, clip, columns, range, isLight(ink.color)),
          }
        : ink,
      clipWaveformBands(clip, peaks, columns, range)
    );
  };
  if (!samples) {
    drawPeaks();
    return;
  }
  const positions = clipFramePositions(clip, samples.frames, columns, range);
  const needed = framesToRead(positions, samples.frames);
  const framesPerColumn = framesPerColumnOf(positions);
  const framesPerPeak = samples.frames / Math.max(1, clipPeakCount(peaks));
  // How many peaks a column covers: under one, its samples are drawn.
  const peaksPerColumn = framesPerColumn / framesPerPeak;
  if (
    peaksPerColumn >= READ_AHEAD ||
    needed[1] - needed[0] > MOST_FRAMES_READ
  ) {
    drawPeaks();
    return;
  }
  // As wide again as the closest zoom the peaks draw, on each side: a zoom or a scroll from here draws at once.
  const stretch = sampleWindow(kept, samples, needed, columns * framesPerPeak);
  if (peaksPerColumn >= 1) {
    drawPeaks();
    return;
  }
  const draw = (read: ArrayLike<number>) => {
    context.clearRect(0, 0, columns, rows);
    if (framesPerColumn >= 1) {
      canvas.dataset.detail = "samples";
      inkBands(ink, sampleBands(positions, read, stretch.from));
      return;
    }
    canvas.dataset.detail = "line";
    inkLine(
      ink,
      sampleLine(positions, read, stretch.from),
      1 / framesPerColumn / scale
    );
  };
  const { values } = stretch;
  if ("then" in values) {
    // Drawn from the peaks until the samples are read, then from them if this paint is still the last.
    drawPeaks();
    values.then(
      (samplesRead) => {
        if (current()) {
          draw(samplesRead);
        }
      },
      () => undefined
    );
    return;
  }
  draw(values);
}

/**
 * Fills the sound from its lowest to its highest level, each column's middle
 * joined to the next, and outlines it a pixel wide: no steps between columns,
 * and silence is still a line.
 */
function inkBands(
  { color, columns, context, rows, scale, tints, zero }: Ink,
  { max, min }: { max: readonly number[]; min: readonly number[] }
) {
  const height = rows / 2;
  const ink = tints ? gradientOf(context, tints) : color;
  context.fillStyle = ink;
  context.strokeStyle = ink;
  context.lineWidth = scale;
  context.lineJoin = "round";
  context.beginPath();
  for (let column = 0; column < columns; column += 1) {
    context.lineTo(column + 0.5, zero - (max[column] ?? 0) * height);
  }
  for (let column = columns - 1; column >= 0; column -= 1) {
    context.lineTo(column + 0.5, zero - (min[column] ?? 0) * height);
  }
  context.closePath();
  context.fill();
  context.stroke();
}

/**
 * Strokes the sound through its samples, `spacing` CSS px apart, with a dot
 * on each one that grows in from `SAMPLE_DOT_PX` apart to twice that.
 */
function inkLine(
  { color, columns, context, rows, scale, zero }: Ink,
  { levels, samples }: ReturnType<typeof sampleLine>,
  spacing: number
) {
  const height = rows / 2;
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = scale;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(0, zero - (levels[0] ?? 0) * height);
  for (const [column, level] of samples) {
    context.lineTo(column, zero - level * height);
  }
  context.lineTo(columns, zero - (levels.at(-1) ?? 0) * height);
  context.stroke();
  const grown = Math.min(
    1,
    Math.max(0, (spacing - SAMPLE_DOT_PX) / SAMPLE_DOT_PX)
  );
  if (grown === 0) {
    return;
  }
  // From the line's half width to 2 px, eased at both ends.
  const radius = scale * (0.5 + 1.5 * grown * grown * (3 - 2 * grown));
  context.beginPath();
  for (const [column, level] of samples) {
    const y = zero - level * height;
    context.moveTo(column + radius, y);
    context.arc(column, y, radius, 0, Math.PI * 2);
  }
  context.fill();
}

/**
 * A clip's recording across the element it lies in: what it plays, as
 * `clipWaveform` reads it, as sharp at any zoom. Its color is the text color.
 * Given its `samples`, it draws them once the zoom is closer than the peaks
 * have detail for, and `data-detail` says what it draws: `peaks`, `samples`
 * (their lowest and highest per pixel) or `line` (through the samples, past
 * a frame per pixel, with a dot on each one that grows in from 6 px apart).
 * The samples it reads are kept, with a margin on each side and read ahead
 * of the zoom that needs them, so a zoom or a scroll draws in the same frame.
 * A zoom is drawn between the layout and the paint, so the waveform and what is
 * around it never show at two widths. Place it with `className`.
 */
function ClipWaveform({
  className,
  clip,
  peaks,
  samples,
  tint,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  clip: ClipReading;
  peaks: ClipPeaks;
  /** The recording's samples, for a zoom closer than its peaks have detail for: drawn as the sound's lowest and highest samples, and past a frame per pixel, as a line through them. */
  samples?: ClipSamples;
  /** Colours each column by the lows, mids and highs it holds, over the peaks. */
  tint?: ClipTint;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kept = useRef<SampleWindow | null>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const body = canvas?.parentElement;
    if (!(canvas && body)) {
      return;
    }
    const view = canvas.closest<HTMLElement>('[data-slot="timeline-viewport"]');
    let drawnLeft = 0;
    let drawnTop = 0;
    let frame = 0;
    let paints = 0;
    const draw = () => {
      frame = 0;
      drawnLeft = view?.scrollLeft ?? 0;
      drawnTop = view?.scrollTop ?? 0;
      paints += 1;
      const paint = paints;
      paintWaveform(canvas, {
        clip,
        current: () => paint === paints,
        kept,
        peaks,
        samples,
        tint,
        view,
      });
    };
    const later = () => {
      frame ||= requestAnimationFrame(draw);
    };
    const scrolled = () => {
      if (
        view &&
        Math.max(
          Math.abs(view.scrollLeft - drawnLeft),
          Math.abs(view.scrollTop - drawnTop)
        ) >
          WAVEFORM_OVERSCAN / 2
      ) {
        later();
      }
    };
    draw();
    // Called between the layout and the paint: a zoom shows the clip and its waveform at the same width.
    let first = true;
    const resized = new ResizeObserver(() => {
      if (!first) {
        draw();
      }
      first = false;
    });
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
      cancelAnimationFrame(frame);
      resized.disconnect();
      themed.disconnect();
      view?.removeEventListener("scroll", scrolled);
    };
  }, [clip, peaks, samples, tint]);
  return (
    <canvas
      className={cn("pointer-events-none absolute", className)}
      data-slot="timeline-clip-waveform"
      ref={ref}
      {...props}
    />
  );
}

export { ClipWaveform };
