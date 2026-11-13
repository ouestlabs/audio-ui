/**
 * A lane of clips drawn on the GPU: one canvas in the lane's box, sized to the
 * stretch the view shows, with every clip in its own viewport of one WebGL
 * context. A browser keeps some sixteen contexts and drops the oldest past
 * that, so a canvas a clip would lose its picture once a sound is cut into
 * enough pieces. This is what the waveform and spectrogram lanes share, and
 * what a lane over another renderer would build on.
 */

/** A recording's samples, mixed to one: how many frames it holds, and a reader of the frames from `from` to `to`. */
export interface LaneSamples {
  frames: number;
  read: (
    from: number,
    to: number
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
}

/** A stretch of a clip that reads its recording straight on: its two times in the clip, in seconds from its start, and the frames of the recording at them. */
export interface LaneSegment {
  /** The frames of the recording at `from` and at `to`; `to` is the lower when the stretch is read backwards, which a lane does not draw. */
  frames: readonly [number, number];
  from: number;
  to: number;
}

/** A clip of a lane to draw: where it lies, how long it is, and how it reads its recording. */
export interface LaneClip {
  /** A gain factor on its picture, as the clip's level plays. */
  gain: number;
  id: string;
  /** How long the clip is on the lane, in seconds. */
  length: number;
  /** The recording's sample rate, in hertz. */
  sampleRate: number;
  samples: LaneSamples;
  /**
   * The stretches of the clip between two times of it, in seconds from its
   * start, in order, each a straight read of the recording: one for a clip
   * that plays on from its offset, one for each turn of a loop and each
   * stretch between warp markers, as a DAW paints them. The host knows how
   * the clip plays.
   */
  segments: (from: number, to: number) => readonly LaneSegment[];
  /** The recording the clip reads: clips of one recording share what is on the GPU for it, its peaks and its samples. */
  source: string;
  /** Where the clip starts on the lane, in seconds. */
  start: number;
}

/** A part of a clip the view shows: its part of the canvas in CSS px from the canvas' left, and the frames of the recording it reads there. */
export interface VisiblePart {
  frames: [number, number];
  width: number;
  x: number;
}

/** A clip the view shows, with its parts and its samples. */
export interface VisibleClip {
  data: ArrayLike<number>;
  entry: LaneClip;
  parts: VisiblePart[];
}

/** The pixels drawn past each edge of the view, so a scroll shows them at once. */
export const OVERSCAN = 256;

const THEME_ATTRIBUTES = ["class", "data-theme", "style"];
const TRANSPARENT = /^(transparent|rgba?\([^)]*,\s*0\))$/;

/** The nearest background that is not transparent, from `element` up: what a picture's silence lies over. */
export function groundOf(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const { backgroundColor } = getComputedStyle(node);
    if (!TRANSPARENT.test(backgroundColor)) {
      return backgroundColor;
    }
  }
  return "white";
}

/** Whether this browser can draw with WebGL 2: the lanes that need it say no, and the page draws them another way. */
export function hasWebGL2(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

/**
 * Whether two readings are the same samples: a reader may hand out a new view
 * of the same memory each time, which is not new data to upload.
 */
export function sameSamples(
  a: ArrayLike<number> | undefined,
  b: ArrayLike<number>
): boolean {
  if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
    return (
      a.buffer === b.buffer &&
      a.byteOffset === b.byteOffset &&
      a.byteLength === b.byteLength
    );
  }
  return a === b;
}

/** What `placeLane` gives: where the canvas starts on the lane, in CSS px, where it ends, and the device pixel ratio. */
export interface Placed {
  from: number;
  ratio: number;
  to: number;
}

/**
 * Sizes the canvas to the stretch of its lane the view shows, and gives that
 * stretch in CSS px from the lane's left with the device pixel ratio, or
 * hides the canvas when none shows.
 */
export function placeLane(
  canvas: HTMLCanvasElement,
  body: HTMLElement,
  view: HTMLElement | null
): Placed | null {
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
  // Resizing the drawing buffer reallocates it and empties it: only when the size is not the one it has.
  const width = Math.round((to - from) * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width) {
    canvas.width = width;
  }
  if (canvas.height !== height) {
    canvas.height = height;
  }
  return { from, ratio, to };
}

/**
 * The clips of a lane the view shows, each with its parts of the canvas and
 * the frames it reads there, and their samples read once a recording. `placed`
 * is what `placeLane` gave; `zoom` the lane's pixels a second. Clips off the
 * view are left out, and so are the parts of a clip off it.
 */
export async function visibleClips(
  clips: readonly LaneClip[],
  placed: Pick<Placed, "from" | "to">,
  zoom: number
): Promise<VisibleClip[]> {
  const seen = clips.flatMap((entry) => {
    const left = entry.start * zoom;
    const x0 = Math.max(left, placed.from);
    const x1 = Math.min(left + entry.length * zoom, placed.to);
    if (!(x1 > x0 && entry.sampleRate > 0)) {
      return [];
    }
    const parts = entry
      .segments((x0 - left) / zoom, (x1 - left) / zoom)
      .flatMap((segment): VisiblePart[] => {
        const a = Math.max(left + segment.from * zoom, x0);
        const b = Math.min(left + segment.to * zoom, x1);
        if (!(b > a)) {
          return [];
        }
        // A stretch read backwards is not drawn: the renderers have no such range.
        if (segment.frames[1] < segment.frames[0]) {
          return [];
        }
        // The stretch may have been cut to the view: its frames follow.
        const span = segment.to - segment.from;
        const at = (time: number) =>
          segment.frames[0] +
          ((time - segment.from) / span) *
            (segment.frames[1] - segment.frames[0]);
        const first = at((a - left) / zoom);
        const last = at((b - left) / zoom);
        return [{ frames: [first, last], width: b - a, x: a - placed.from }];
      });
    return parts.length > 0 ? [{ entry, parts }] : [];
  });
  // A recording is read once, whatever its clips.
  const reads = new Map<string, Promise<ArrayLike<number>>>();
  for (const { entry } of seen) {
    if (!reads.has(entry.source)) {
      reads.set(
        entry.source,
        Promise.resolve(entry.samples.read(0, entry.samples.frames))
      );
    }
  }
  return await Promise.all(
    seen.map(async (each) => ({
      ...each,
      data: await (reads.get(each.entry.source) as Promise<ArrayLike<number>>),
    }))
  );
}

/** What a lane hands its painter and its listeners. */
export interface LaneContext<Held, Inputs> {
  body: HTMLElement;
  canvas: HTMLCanvasElement;
  held: Held;
  /** What the lane draws now: read as often as needed, it changes without the lane starting over. */
  inputs: () => Inputs;
  /** Asks for a paint in the next frame. */
  later: () => void;
  view: HTMLElement | null;
}

/** What a lane is made of. */
export interface LaneOptions<Held extends { gone: boolean }, Inputs> {
  /** Listeners of the lane itself (the pointer, the wheel): given the context, gives back what undoes them. */
  attach?: (context: LaneContext<Held, Inputs>) => () => void;
  canvas: HTMLCanvasElement;
  /** What the lane keeps between paints. */
  create: () => Held;
  /** Lets go of what `create` made. */
  destroy: (held: Held) => void;
  /** What the lane draws first. */
  inputs: Inputs;
  /** Draws what the view shows; true while some of it is not yet whole, to be drawn again. Told to stop by `held.gone`. */
  paint: (context: LaneContext<Held, Inputs>) => Promise<boolean>;
  /** The element the lane scrolls in, whose edges are what shows. @default the nearest `[data-slot="timeline-viewport"]` */
  scroller?: HTMLElement | null;
  /** A change outside the inputs that draws again (a band zoomed): given `later`, gives back what undoes it. */
  subscribe?: (later: () => void) => () => void;
}

/** A lane that is drawing. */
export interface Lane<Inputs> {
  /** Lets go of its listeners and what it keeps on the GPU. */
  destroy: () => void;
  /** Draws again, now. */
  redraw: () => void;
  /** What the lane draws from now on: it draws again in the next frame, keeping what is on the GPU. */
  update: (inputs: Inputs) => void;
}

/**
 * Starts a lane on `canvas`, which sits in the lane's box: placed on the
 * stretch the view shows, drawn again when its inputs change, the lane
 * resizes, the view scrolls a good way or the theme changes, and let go of
 * with `destroy`. `paint` draws, from `inputs()` and the `held` it made; the
 * lane never starts over for a change of inputs, so what is kept on the GPU
 * stays.
 */
export function createLane<Held extends { gone: boolean }, Inputs>(
  options: LaneOptions<Held, Inputs>
): Lane<Inputs> {
  const { canvas } = options;
  const body = canvas.parentElement;
  const view =
    options.scroller === undefined
      ? canvas.closest<HTMLElement>('[data-slot="timeline-viewport"]')
      : options.scroller;
  let { inputs } = options;
  const held = options.create();
  let frame = 0;
  let drawnLeft = 0;
  let over = false;
  if (!body) {
    return {
      destroy: () => undefined,
      redraw: () => undefined,
      update: () => undefined,
    };
  }
  const context: LaneContext<Held, Inputs> = {
    body,
    canvas,
    held,
    inputs: () => inputs,
    later: () => later(),
    view,
  };
  const draw = async () => {
    frame = 0;
    drawnLeft = view?.scrollLeft ?? 0;
    if ((await options.paint(context)) && !over) {
      later();
    }
  };
  function later() {
    if (!over) {
      frame ||= requestAnimationFrame(draw);
    }
  }
  const detach = options.attach?.(context);
  const unsubscribe = options.subscribe?.(later);
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
  return {
    destroy: () => {
      over = true;
      held.gone = true;
      cancelAnimationFrame(frame);
      resized.disconnect();
      themed.disconnect();
      view?.removeEventListener("scroll", scrolled);
      unsubscribe?.();
      detach?.();
      options.destroy(held);
    },
    redraw: later,
    update: (next) => {
      inputs = next;
      later();
    },
  };
}
