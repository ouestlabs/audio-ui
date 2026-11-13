import { formatFrequency, formatLevel } from "@audio-ui/engine/format";
import {
  createSpectrogramLane,
  hertzLabel,
  type Lane,
  loadScales,
  panBand,
  readHertz,
  type SpectrogramBand,
  type SpectrogramHit,
  type SpectrogramInputs,
  type SpectrogramScale,
  spectrogramAxis,
  zoomBand,
} from "@audio-ui/gl/spectrogram";
import {
  type ComponentProps,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "@/lib/utils";

/** A frequency held where the lane and the axis both reach it: the lane says it, the axis reads it. */
export interface PointerHertz {
  getSnapshot: () => number | null;
  set: (hertz: number | null) => void;
  subscribe: (listener: () => void) => () => void;
}

/** Where the pointer is on the lane, and what it reads there. */
interface Reading {
  height: number;
  left: number;
  text: string;
  top: number;
  width: number;
}

/** A cell as text: the middle of its frequencies and its level, the frequency alone under the floor, where there is nothing to read. */
const readingOf = (hit: SpectrogramHit) => {
  const hertz = formatFrequency((hit.low + hit.high) / 2);
  return hit.level < hit.floor
    ? hertz
    : `${hertz} · ${formatLevel(hit.level, "dB", { sign: false })}`;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The spectrograms of a lane's clips on one canvas and one WebGL context,
 * computed on the GPU by `gl-spectrogram` through `@audio-ui/gl/spectrogram`:
 * their frequencies over the stretch of the lane the view shows, in the text
 * colour over the ground under it, on the frequency `scale` you pick. Put it
 * in the lane's box, `zoom` being the lane's pixels a second. Shift and the
 * wheel over the picture zoom its frequencies (`band`), and the pointer reads
 * the frequency and level under it. A stretch read backwards is not drawn:
 * `hasWebGL2` of `@audio-ui/gl/lane` says whether to draw this way at all.
 */
function SpectrogramLane({
  band,
  className,
  clips,
  pointerHertz,
  scale = "log",
  zoom,
  ...props
}: Omit<ComponentProps<"canvas">, "ref"> & {
  /** The frequencies shown, as shares of the axis: Shift and the wheel over the picture zooms it, about the pointer. */
  band?: SpectrogramBand;
  clips: SpectrogramInputs["clips"];
  /** Told the frequency under the pointer, in hertz, or null off the picture: for `SpectrogramAxis` to mark. */
  pointerHertz?: Pick<PointerHertz, "set">;
  scale?: SpectrogramScale;
  /** The lane's pixels a second. */
  zoom: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const lane = useRef<Lane<SpectrogramInputs> | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const inputs = useMemo<SpectrogramInputs>(
    () => ({ band, clips, scale, zoom }),
    [band, clips, scale, zoom]
  );
  const first = useRef(inputs);
  const told = useRef(pointerHertz);
  told.current = pointerHertz;
  useLayoutEffect(() => {
    const canvas = ref.current;
    const body = canvas?.parentElement;
    if (!(canvas && body)) {
      return;
    }
    lane.current = createSpectrogramLane(canvas, first.current, {
      onHit: (hit) => {
        told.current?.set(hit ? (hit.low + hit.high) / 2 : null);
        const own = body.getBoundingClientRect();
        setReading(
          hit
            ? {
                height: own.height,
                left: hit.x - own.left,
                text: readingOf(hit),
                top: hit.y - own.top,
                width: own.width,
              }
            : null
        );
      },
    });
    return () => {
      lane.current?.destroy();
      lane.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    lane.current?.update(inputs);
  }, [inputs]);
  return (
    <>
      <canvas
        className={cn("pointer-events-none absolute inset-y-0", className)}
        data-slot="timeline-clip-spectrogram"
        ref={ref}
        {...props}
      />
      {reading ? (
        <span
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-sm bg-foreground px-1 font-mono text-[10px] text-background tabular-nums"
          data-slot="timeline-clip-spectrogram-reading"
          style={{
            left: Math.min(reading.left + 12, reading.width - 120),
            top:
              reading.top + 12 > reading.height - 18
                ? reading.top - 22
                : reading.top + 12,
          }}
        >
          {reading.text}
        </span>
      ) : null}
    </>
  );
}

const NO_SUBSCRIPTION = () => () => undefined;
const NO_POINTER = () => null;
const NO_BAND: readonly [number, number] = [0, 1];
const NO_BAND_SNAPSHOT = () => NO_BAND;

/**
 * The frequencies a spectrogram's rows stand for, as an axis down the left
 * edge of the lane, as audio.js draws it: labels roundest first (20k, 2k,
 * 200, then between as room allows), each with its tick at the row its
 * frequency sits on by the axis the picture is spaced on, and shorter ticks
 * between, laid out by `spectrogramAxis` of `@audio-ui/gl/spectrogram`.
 * `pointer`, a frequency, is marked on it as the pointer reads it. It holds
 * still as the lane scrolls. Put it in the lane's box with the clips, given
 * the same `scale` and the recording's `sampleRate`.
 */
function SpectrogramAxis({
  band,
  pointer,
  sampleRate,
  scale,
}: {
  /** The frequencies shown, as shares of the axis: the wheel over the axis moves it, with Ctrl or Command zooms it, a double-click shows all. */
  band?: SpectrogramBand;
  /** The frequency under the pointer, in hertz, to mark on the axis. */
  pointer?: PointerHertz;
  sampleRate: number;
  scale: SpectrogramScale;
}) {
  const [axes, setAxes] = useState<Awaited<
    ReturnType<typeof loadScales>
  > | null>(null);
  useEffect(() => {
    let live = true;
    loadScales().then(
      (scales) => {
        if (live) {
          setAxes(scales);
        }
      },
      () => undefined
    );
    return () => {
      live = false;
    };
  }, []);
  // As tall as the lane it sits in: a percentage of it does not resolve in a flex box.
  const holder = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const lane = holder.current?.parentElement;
    if (!lane) {
      return;
    }
    const measure = () => setHeight(lane.clientHeight);
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(lane);
    return () => resized.disconnect();
  }, []);
  // The wheel over the axis moves the band, and zooms it with Ctrl, Command or a pinch: before the lane scrolls time with it.
  useEffect(() => {
    const element = strip.current;
    if (!(element && band)) {
      return;
    }
    const wheeled = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const box = element.getBoundingClientRect();
      const current = band.getSnapshot();
      band.set(
        event.ctrlKey || event.metaKey
          ? zoomBand(
              current,
              clamp01(1 - (event.clientY - box.top) / box.height),
              Math.exp(event.deltaY * 0.01)
            )
          : panBand(current, -event.deltaY / box.height)
      );
    };
    const reset = () => band.set([0, 1]);
    element.addEventListener("wheel", wheeled, { passive: false });
    element.addEventListener("dblclick", reset);
    return () => {
      element.removeEventListener("wheel", wheeled);
      element.removeEventListener("dblclick", reset);
    };
  }, [band]);
  const heard = useSyncExternalStore(
    pointer?.subscribe ?? NO_SUBSCRIPTION,
    pointer?.getSnapshot ?? NO_POINTER,
    NO_POINTER
  );
  const shown = useSyncExternalStore(
    band?.subscribe ?? NO_SUBSCRIPTION,
    band?.getSnapshot ?? NO_BAND_SNAPSHOT,
    NO_BAND_SNAPSHOT
  );
  const axis = axes?.[scale];
  const layout = axis
    ? spectrogramAxis({
        axis,
        band: shown,
        height,
        nyquist: sampleRate / 2,
        pointer: heard,
        scale,
      })
    : null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none sticky start-0 z-10 w-0"
      data-slot="spectrogram-axis"
      ref={holder}
      style={{ height }}
    >
      {/* A strip of its own, on the picture's left: the labels read against a plain ground, each before its tick at the picture's edge. */}
      <div
        className="pointer-events-auto absolute inset-y-0 start-0 w-11 touch-none border-e bg-background"
        ref={strip}
      >
        {layout?.minor.map((tick) => (
          <span
            className="absolute end-0 h-px w-1 bg-foreground/30"
            key={tick}
            style={{ bottom: tick }}
          />
        ))}
        {layout?.labels.map((label) => (
          <span key={label.hertz}>
            <span
              className="absolute end-0 h-px w-1.5 bg-foreground/50"
              style={{ bottom: label.tick }}
            />
            <span
              className="absolute end-2 translate-y-1/2 text-[10px] text-muted-foreground tabular-nums"
              style={{ bottom: label.y }}
            >
              {label.text}
            </span>
          </span>
        ))}
        {layout?.marker === null ||
        layout?.marker === undefined ||
        heard === null ? null : (
          <>
            <span
              className="absolute end-0 h-px w-2 bg-foreground"
              style={{ bottom: layout.marker }}
            />
            <span
              className="absolute end-2 translate-y-1/2 rounded-s-sm bg-foreground px-1 text-[10px] text-background tabular-nums"
              data-slot="spectrogram-axis-pointer"
              style={{
                bottom: Math.min(height - 6, Math.max(6, layout.marker)),
              }}
            >
              {readHertz(heard)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export type { SpectrogramBand, SpectrogramScale };
export { hertzLabel, panBand, SpectrogramAxis, SpectrogramLane, zoomBand };
