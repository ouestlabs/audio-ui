"use client";

import { type ComponentProps, useLayoutEffect, useRef } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  type ClipPeaks,
  type ClipReading,
  clipWaveformBands,
} from "@/registry-audio/bases/base/lib/arrangement";

/**
 * How far past each side of what shows an audio clip's waveform is drawn, in
 * px: a scroll finds it drawn, and draws it again only once past half of this.
 */
const WAVEFORM_OVERSCAN = 512;
const THEME_ATTRIBUTES = ["class", "data-theme", "style"];

/**
 * Paints a clip's waveform on its canvas, a column per pixel of the screen, for
 * the stretch of the clip the view shows: however wide the zoom makes the clip,
 * the canvas stays the size of the view, and a clip out of view paints nothing.
 */
function paintWaveform(
  canvas: HTMLCanvasElement,
  clip: ClipReading,
  peaks: ClipPeaks,
  view: HTMLElement | null
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
  context.fillStyle = getComputedStyle(canvas).color;
  const { length } = clip.value;
  const middle = rows / 2;
  const { max, min } = clipWaveformBands(clip, peaks, columns, [
    (from / box.width) * length,
    (to / box.width) * length,
  ]);
  for (let column = 0; column < columns; column += 1) {
    const top = middle - (max[column] ?? 0) * middle;
    const bottom = middle - (min[column] ?? 0) * middle;
    // Silence is still a line.
    const height = Math.max(1, bottom - top);
    context.fillRect(column, Math.min(top, middle - height / 2), 1, height);
  }
}

/**
 * A clip's recording across the element it lies in: what it plays, as
 * `clipWaveform` reads it, as sharp at any zoom. Its color is the text color.
 * A zoom is drawn between the layout and the paint, so the waveform and what is
 * around it never show at two widths. Place it with `className`.
 */
function ClipWaveform({
  className,
  clip,
  peaks,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  clip: ClipReading;
  peaks: ClipPeaks;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
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
    const draw = () => {
      frame = 0;
      drawnLeft = view?.scrollLeft ?? 0;
      drawnTop = view?.scrollTop ?? 0;
      paintWaveform(canvas, clip, peaks, view);
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
  }, [clip, peaks]);
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
