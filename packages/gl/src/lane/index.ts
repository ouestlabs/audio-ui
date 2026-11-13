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
  /**
   * The recording summed up 256 frames at a time, `[min, max, Σx², count]`
   * each, as `waveformLeaves` of `@audio-ui/gl/waveform` makes them: for a
   * recording streamed from a file, which a lane then never reads whole. A
   * waveform lane draws it from them zoomed out, and zoomed in reads only the
   * frames it shows, `CHUNK_FRAMES` at a time. Left out, a lane reads the
   * recording whole, once.
   */
  leaves?: () => ArrayLike<number> | Promise<ArrayLike<number>>;
  read: (
    from: number,
    to: number
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
  /**
   * For a recording streamed from a file: its spectra, as
   * `spectrogramSpectra` of `@audio-ui/engine/analysis` makes them. A
   * spectrogram lane draws it from them zoomed out, and zoomed in reads only
   * the frames it shows, `CHUNK_FRAMES` at a time. Left out, a spectrogram lane
   * reads the recording whole, once.
   */
  spectra?: () => LaneSpectra | Promise<LaneSpectra>;
}

/** A recording's spectra: a column every `hop` frames, each bin's level to Nyquist over windows of `size` frames, a byte each, (dB + 150) · 1.6, 0 silence: what `gl-spectrogram` draws a recording it does not hold from. */
export interface LaneSpectra {
  hop: number;
  levels: Uint8Array;
  size: number;
}

/** The frames a renderer keeps its samples in, and a streamed recording is read in: 65536. */
export const CHUNK_FRAMES = 1 << 16;

/** The most chunks a renderer keeps of a streamed recording beyond those the view reads: some four million frames. */
const MOST_HELD = 64;

/** What a renderer holds of a recording it streams: the chunks handed over, oldest first, and those being read. */
export interface ChunkFeed {
  held: number[];
  reading: Set<number>;
}

/** What a renderer that streams its samples does with them: `gl-waveform` and `gl-spectrogram` both do. */
export interface ChunkRenderer {
  drop: (from: number, to: number) => unknown;
  set: (samples: ArrayLike<number>, offset: number) => unknown;
}

/**
 * Hands a renderer the chunks of a streamed recording that `ranges` read, in
 * frames: those it lacks are read, each handed over once read, and `ready`
 * draws again. The chunks it held before stay, up to `MOST_HELD`, the oldest
 * the view no longer reads let go of first. `alive` says whether the renderer
 * is still the one to hand them to. True when every chunk `ranges` read is held.
 */
export function feedChunks(
  feed: ChunkFeed,
  samples: LaneSamples,
  ranges: readonly (readonly [number, number])[],
  renderer: ChunkRenderer,
  ready: () => void,
  alive: () => boolean
): boolean {
  const count = Math.ceil(samples.frames / CHUNK_FRAMES);
  const wanted = new Set<number>();
  for (const [from, to] of ranges) {
    const last = Math.min(count, Math.ceil(to / CHUNK_FRAMES));
    for (
      let chunk = Math.max(0, Math.floor(from / CHUNK_FRAMES));
      chunk < last;
      chunk += 1
    ) {
      wanted.add(chunk);
    }
  }
  const held = new Set(feed.held);
  let whole = true;
  for (const chunk of wanted) {
    if (held.has(chunk)) {
      continue;
    }
    whole = false;
    if (feed.reading.has(chunk)) {
      continue;
    }
    feed.reading.add(chunk);
    const at = chunk * CHUNK_FRAMES;
    Promise.resolve(
      samples.read(at, Math.min(samples.frames, at + CHUNK_FRAMES))
    ).then(
      (read) => {
        feed.reading.delete(chunk);
        if (alive()) {
          renderer.set(read, at);
          feed.held.push(chunk);
          ready();
        }
      },
      () => feed.reading.delete(chunk)
    );
  }
  // What is being read counts: once it lands, no more than the most are held.
  const extra =
    feed.held.length + feed.reading.size - Math.max(MOST_HELD, wanted.size);
  if (extra > 0) {
    const gone = new Set(
      feed.held.filter((chunk) => !wanted.has(chunk)).slice(0, extra)
    );
    for (const chunk of gone) {
      renderer.drop(chunk * CHUNK_FRAMES, (chunk + 1) * CHUNK_FRAMES);
    }
    feed.held = feed.held.filter((chunk) => !gone.has(chunk));
  }
  return whole;
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
  /** The recording's channels, one reader each, for a waveform that draws them one over the other: left out for a mono recording. `samples` is their mix. */
  channels?: readonly LaneSamples[];
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

/**
 * Clears the whole canvas of a lane's context. The renderers leave the scissor
 * test on, cut to the last viewport they drew, and a clear is cut by it: a
 * plain clear would leave every other part of the canvas as it was, the
 * picture of the frame before showing under the new one.
 */
export function clearLane(gl: WebGL2RenderingContext | null) {
  if (!gl) {
    return;
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
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
 * hides the canvas when none shows: the lane scrolled out of sight to either
 * side, or up or down.
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
  // A lane scrolled out of sight, up or down, draws nothing until it comes near.
  const away =
    box.bottom < sees.top - OVERSCAN || box.top > sees.bottom + OVERSCAN;
  if (to <= from || away) {
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

/** How far, in CSS px, a junction between parts may stray from the one line they are joined into. */
const JOIN_TOLERANCE = 0.25;

/** Two numbers equal but for rounding. */
const near = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

/** Whether the parts of a run read as one line: each junction within `JOIN_TOLERANCE` px of where that line puts its frame. */
function readsAsOne(run: readonly VisiblePart[]): boolean {
  const [first] = run;
  const last = run.at(-1);
  if (!(first && last)) {
    return false;
  }
  const [from, to] = [first.frames[0], last.frames[1]];
  const width = last.x + last.width - first.x;
  return (
    to > from &&
    run
      .slice(1)
      .every(
        (part) =>
          Math.abs(
            first.x + ((part.frames[0] - from) / (to - from)) * width - part.x
          ) <= JOIN_TOLERANCE
      )
  );
}

/**
 * Parts that follow one another on the canvas and in the recording, joined
 * into one while every junction between them stays within a quarter of a
 * pixel of where the one line reading them all puts it: a warped clip's
 * stretches, a pixel or two wide zoomed out, are drawn as one part, not
 * hundreds, and stay apart zoomed in, where a junction would show. The turns
 * of a loop, which read the recording again, are never joined.
 */
export function joinParts(parts: readonly VisiblePart[]): VisiblePart[] {
  const joined: VisiblePart[] = [];
  let run: VisiblePart[] = [];
  const close = () => {
    const [first] = run;
    const last = run.at(-1);
    if (first && last) {
      joined.push({
        frames: [first.frames[0], last.frames[1]],
        width: last.x + last.width - first.x,
        x: first.x,
      });
    }
  };
  for (const part of parts) {
    const last = run.at(-1);
    const follows =
      last &&
      near(last.x + last.width, part.x) &&
      near(last.frames[1], part.frames[0]);
    if (follows && readsAsOne([...run, part])) {
      run.push(part);
    } else {
      close();
      run = [part];
    }
  }
  close();
  return joined;
}

/** The clips of a lane the view shows, each with its parts, before their samples are read: stretches that read as one line joined (`joinParts`). */
export function partsInView(
  clips: readonly LaneClip[],
  placed: Pick<Placed, "from" | "to">,
  zoom: number
): { entry: LaneClip; parts: VisiblePart[] }[] {
  return clips.flatMap((entry) => {
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
        // A stretch read backwards is not drawn: the renderers have no such range.
        if (!(b > a) || segment.frames[1] < segment.frames[0]) {
          return [];
        }
        // The stretch may have been cut to the view: its frames follow.
        const span = segment.to - segment.from;
        const at = (time: number) =>
          segment.frames[0] +
          ((time - segment.from) / span) *
            (segment.frames[1] - segment.frames[0]);
        return [
          {
            frames: [at((a - left) / zoom), at((b - left) / zoom)],
            width: b - a,
            x: a - placed.from,
          },
        ];
      });
    return parts.length > 0 ? [{ entry, parts: joinParts(parts) }] : [];
  });
}

/**
 * What a lane has read of its recordings, by `source`: a recording is read
 * once, not at every paint, since a reader may copy or mix the whole of it
 * each time it is asked. Read again only when the clip hands another reader.
 */
export type SampleCache = KeptCache<ArrayLike<number>>;

/** What a lane has read of its recordings, by key: what it read, or is reading, and the reader it read it with. */
export type KeptCache<Read> = Map<
  string,
  { read: Read | Promise<Read>; samples: LaneSamples }
>;

/**
 * What `read` gives for `samples`, from `cache` under `key` when that reader
 * is the one it was read with, else read now and kept: once a promise is
 * settled, the cache holds what it gave, so the next paint has it at once.
 */
export function readKept<Read = ArrayLike<number>>(
  cache: KeptCache<Read> | undefined,
  key: string,
  samples: LaneSamples,
  read: () => Read | Promise<Read>
): Read | Promise<Read> {
  const kept = cache?.get(key);
  if (kept && kept.samples === samples) {
    return kept.read;
  }
  const reading = read();
  cache?.set(key, { read: reading, samples });
  if (reading instanceof Promise) {
    reading.then(
      (done) => {
        if (cache?.get(key)?.read === reading) {
          cache.set(key, { read: done, samples });
        }
      },
      () => cache?.delete(key)
    );
  }
  return reading;
}

/** A recording's samples, from the cache when its reader is the one it was read with, else read now and kept. */
export function readOnce(
  entry: LaneClip,
  cache: SampleCache | undefined
): ArrayLike<number> | Promise<ArrayLike<number>> {
  return readKept(cache, entry.source, entry.samples, () =>
    entry.samples.read(0, entry.samples.frames)
  );
}

/** Whether a reading came back at once, not as a promise. */
const isNow = (
  read: ArrayLike<number> | Promise<ArrayLike<number>>
): read is ArrayLike<number> => !(read instanceof Promise);

/**
 * The clips of a lane the view shows, as `visibleClips` gives them, when
 * every recording they read hands its samples at once: what lets a lane draw
 * a zoom in the frame it happens. `null` when one reads them later.
 */
export function visibleClipsNow(
  clips: readonly LaneClip[],
  placed: Pick<Placed, "from" | "to">,
  zoom: number,
  cache?: SampleCache
): VisibleClip[] | null {
  const seen = partsInView(clips, placed, zoom);
  const reads = new Map<string, ArrayLike<number>>();
  for (const { entry } of seen) {
    if (!reads.has(entry.source)) {
      const read = readOnce(entry, cache);
      if (!isNow(read)) {
        return null;
      }
      reads.set(entry.source, read);
    }
  }
  return seen.map((each) => ({
    ...each,
    data: reads.get(each.entry.source) as ArrayLike<number>,
  }));
}

/**
 * The clips of a lane the view shows, each with its parts of the canvas and
 * the frames it reads there, and their samples read once a recording. `placed`
 * is what `placeLane` gave; `zoom` the lane's pixels a second; `cache` keeps
 * what was read across paints, so a lane reads a recording once. Clips off
 * the view are left out, and so are the parts of a clip off it.
 */
export async function visibleClips(
  clips: readonly LaneClip[],
  placed: Pick<Placed, "from" | "to">,
  zoom: number,
  cache?: SampleCache
): Promise<VisibleClip[]> {
  const seen = partsInView(clips, placed, zoom);
  // A recording is read once, whatever its clips, and with a cache once whatever the paints.
  const reads = new Map<string, Promise<ArrayLike<number>>>();
  for (const { entry } of seen) {
    if (!reads.has(entry.source)) {
      reads.set(entry.source, Promise.resolve(readOnce(entry, cache)));
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
  /** Draws what the view shows, at once when it can and later when it waits on something; true while some of it is not yet whole, to be drawn again. Told to stop by `held.gone`. */
  paint: (context: LaneContext<Held, Inputs>) => boolean | Promise<boolean>;
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
  /** What the lane draws from now on: it draws again at once, keeping what is on the GPU, and waits only for what it does not hold yet. */
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
  let drawnTop = 0;
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
  const draw = () => {
    frame = 0;
    drawnLeft = view?.scrollLeft ?? 0;
    drawnTop = view?.scrollTop ?? 0;
    const more = options.paint(context);
    if (more instanceof Promise) {
      more.then(
        (again) => {
          if (again && !over) {
            later();
          }
        },
        () => undefined
      );
    } else if (more && !over) {
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
    if (
      view &&
      Math.max(
        Math.abs(view.scrollLeft - drawnLeft),
        Math.abs(view.scrollTop - drawnTop)
      ) >
        OVERSCAN / 2
    ) {
      later();
    }
  };
  later();
  // A resize is drawn at once: the observer runs between the layout and the paint, so the waveform never shows at the old width.
  const resized = new ResizeObserver(() => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (!over) {
      draw();
    }
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
    // Drawn at once: called while the page lays out (a React layout effect), a zoom shows in the frame it happens, the waveform and the lane at one width.
    update: (next) => {
      inputs = next;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (!over) {
        draw();
      }
    },
  };
}
