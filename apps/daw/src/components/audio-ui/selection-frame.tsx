import { dbToGain, gainToDb } from "@audio-ui/engine/analysis";
import { formatTime } from "@audio-ui/engine/format";
import {
  type FadeShape,
  fadeGain,
  type Timeline as TimelinePrimitive,
} from "@audio-ui/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import {
  TimelineClip,
  TimelineClipFadeHandle,
  TimelineClipHandle,
} from "@/components/audio-ui/timeline";
import { cn } from "@/lib/utils";

/** What fades and level on a selection set: the fades at its two ends, their curves, and its level in dB. */
export interface SelectionShape {
  fadeIn: number;
  fadeInShape: FadeShape;
  fadeOut: number;
  fadeOutShape: FadeShape;
  gain: number;
}

/** No fade and the level as it is. */
export const FLAT: SelectionShape = {
  fadeIn: 0,
  fadeInShape: "linear",
  fadeOut: 0,
  fadeOutShape: "linear",
  gain: 0,
};

/** How far Louder and Quieter move a selection's level, in dB. */
export const LEVEL_NUDGE = 3;

/** A selection's level range, in dB: silence at the bottom, a boost of 6 dB at the top. */
export const MIN_DB = -60;
export const MAX_DB = 6;

/** A level as the line reads it: "+1.5 dB", "-∞ dB" at the bottom of the range. */
export const formatDb = (db: number) =>
  db <= MIN_DB ? "-∞ dB" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;

/** A time to the millisecond, as an edge being dragged shows it: m:ss.mmm. */
const formatPrecise = (seconds: number) => formatTime(seconds, "precise");

/** How many points draw a fade's curve. */
const FADE_POINTS = 24;
/** The shortest a selection can be made by its edges, in seconds. */
const SHORTEST_SELECTION = 0.01;
/** How far the arrows move the level, in dB. */
const LEVEL_STEP = 0.5;

/** A fade's edge along the selection, from its start over `span`, as the gain it lets through, 0…1, at each point. */
function fadeEdge(
  from: number,
  span: number,
  rising: boolean,
  shape: FadeShape
) {
  return Array.from({ length: FADE_POINTS + 1 }, (_, index) => {
    const progress = index / FADE_POINTS;
    return [
      from + span * progress,
      fadeGain(shape, rising ? progress : 1 - progress),
    ] as const;
  });
}

/** The shade over what a fade takes away, above and below the waveform's middle, and the line along its edge. */
function fadePaths(edge: readonly (readonly [number, number])[]) {
  const first = edge[0]?.[0] ?? 0;
  const last = edge.at(-1)?.[0] ?? 0;
  const top = edge.map(([x, gain]) => `L${x} ${0.5 - gain / 2}`).join("");
  const bottom = edge.map(([x, gain]) => `L${x} ${0.5 + gain / 2}`).join("");
  return {
    line: `M${edge.map(([x, gain]) => `${x} ${0.5 - gain / 2}`).join("L")}M${edge.map(([x, gain]) => `${x} ${0.5 + gain / 2}`).join("L")}`,
    shade: `M${first} 0${top}L${last} 0ZM${first} 1${bottom}L${last} 1Z`,
  };
}

/** One fade over the waveform: what it takes away shaded, the curve it follows drawn. */
function FadePaths({ edge }: { edge: readonly (readonly [number, number])[] }) {
  const { line, shade } = fadePaths(edge);
  return (
    <>
      <path className="fill-background/60" d={shade} />
      <path
        className="fill-none stroke-foreground/50"
        d={line}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

/** What a fade shade draws: a stretch's length, its fades and their curves. */
interface Fades {
  fadeIn: number;
  fadeInShape?: FadeShape;
  fadeOut: number;
  fadeOutShape?: FadeShape;
  length: number;
}

/** A stretch's fades over its waveform, as the arrangement draws a clip's: what each takes away shaded, the curve it follows drawn. */
export function FadeShade({ value }: { value: Fades }) {
  const { fadeIn, fadeOut, length } = value;
  if (!(length > 0 && (fadeIn > 0 || fadeOut > 0))) {
    return null;
  }
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full"
      preserveAspectRatio="none"
      viewBox={`0 0 ${length} 1`}
    >
      {fadeIn > 0 ? (
        <FadePaths
          edge={fadeEdge(0, fadeIn, true, value.fadeInShape ?? "linear")}
        />
      ) : null}
      {fadeOut > 0 ? (
        <FadePaths
          edge={fadeEdge(
            length - fadeOut,
            fadeOut,
            false,
            value.fadeOutShape ?? "linear"
          )}
        />
      ) : null}
    </svg>
  );
}

/** The gain a level lets through, 0…1: silence at the bottom of the range. */
const ratioOf = (db: number) => (db <= MIN_DB ? 0 : Math.min(1, dbToGain(db)));

/** What Up and Down do to the level, in dB. */
const LEVEL_KEYS: Record<string, number | undefined> = {
  ArrowDown: -LEVEL_STEP,
  ArrowUp: LEVEL_STEP,
};

/** The level at the pointer, up the frame the line is in: 0 dB at its top, silence at its bottom; `gain` while it has no height. */
function levelAt(event: PointerEvent<HTMLElement>, gain: number) {
  const box = event.currentTarget.parentElement?.getBoundingClientRect();
  if (!box || box.height <= 0) {
    return gain;
  }
  const ratio = Math.min(
    1,
    Math.max(0, 1 - (event.clientY - box.top) / box.height)
  );
  return ratio <= dbToGain(MIN_DB) ? MIN_DB : gainToDb(ratio);
}

/**
 * The level of the selection: a line across it where the gain it lets
 * through stands, 0 dB at the top and silence at the bottom, dragged up and
 * down from anywhere along it, or moved with Up and Down, which go on past
 * 0 dB to the top of the range, the line staying at the top. It shows the
 * level as it moves and takes effect as it lets go.
 */
function LevelHandle({
  gain,
  onChange,
  onCommit,
}: {
  gain: number;
  onChange: (db: number) => void;
  onCommit: (db: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const latest = useRef(gain);
  const top = `${(1 - ratioOf(gain)) * 100}%`;
  const press = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      latest.current = gain;
      setDragging(true);
    },
    [gain]
  );
  const move = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (dragging) {
        latest.current = levelAt(event, gain);
        onChange(latest.current);
      }
    },
    [dragging, gain, onChange]
  );
  const release = useCallback(() => {
    if (dragging) {
      setDragging(false);
      onCommit(latest.current);
    }
  }, [dragging, onCommit]);
  const key = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const step = LEVEL_KEYS[event.key];
      if (step !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onCommit(Math.min(MAX_DB, Math.max(MIN_DB, gain + step)));
      }
    },
    [gain, onCommit]
  );
  return (
    <>
      {/* The line is the grip, anywhere along it; its ends stay the edges' own, for a drag of the selection's start and end. */}
      <span
        aria-label="Selection level"
        aria-orientation="vertical"
        aria-valuemax={MAX_DB}
        aria-valuemin={MIN_DB}
        aria-valuenow={gain}
        aria-valuetext={formatDb(gain)}
        className="group/level pointer-events-auto absolute inset-x-2 z-10 h-3 -translate-y-1/2 cursor-ns-resize touch-none rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-dragging={dragging ? "" : undefined}
        data-slot="selection-frame-level"
        onKeyDown={key}
        onLostPointerCapture={release}
        onPointerDown={press}
        onPointerMove={move}
        onPointerUp={release}
        role="slider"
        style={{ top }}
        tabIndex={0}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-2 top-1/2 border-primary border-t border-dashed group-hover/level:border-solid group-data-dragging/level:border-solid"
        />
      </span>
      {dragging ? (
        <span
          className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 translate-y-2 rounded-sm bg-foreground px-1 text-[10px] text-background tabular-nums"
          style={{ top }}
        >
          {formatDb(gain)}
        </span>
      ) : null}
    </>
  );
}

/** A drag of the selection's edge, as the frame reports it. */
const TRIMS: Record<string, "end" | "start" | undefined> = {
  "trim-end": "end",
  "trim-start": "start",
};

/**
 * The selection as a frame over the waveform, as an audio editor draws one:
 * its edges drag, showing their time to the millisecond as they do; a handle
 * in each top corner fades it in and out (a double-click on one picks its
 * curve); the level's line across it sets how loud it plays. Put it inside a
 * `TimelineLane`. Fades and level take effect as a gesture ends, through
 * `onShapeCommit` with the name of the step; `shape` is what the selection has
 * now, `FLAT` where an edit bakes it into the sound.
 */
function SelectionFrame({
  duration,
  onRangeChange,
  onShapeCommit,
  range,
  shape,
}: {
  /** How long what the selection lies in is, in the timeline's units: its edges stay inside. */
  duration: number;
  /** An edge was dragged. */
  onRangeChange: (range: readonly [number, number]) => void;
  /** A fade, its curve or the level was set: "Fade", "Fade-in curve", "Fade-out curve" or "Level". */
  onShapeCommit: (shape: SelectionShape, label: string) => void;
  /** Where it starts and ends, in the timeline's units. */
  range: readonly [number, number];
  shape: SelectionShape;
}) {
  const [preview, setPreview] = useState<SelectionShape | null>(null);
  const [edge, setEdge] = useState<"end" | "start" | null>(null);
  const fading = useRef<boolean>(false);
  const current = preview ?? shape;
  const [from, to] = range;
  const change = useCallback(
    (
      next: TimelinePrimitive.Clip.Value,
      details: TimelinePrimitive.Clip.ChangeEventDetails
    ) => {
      const trim = TRIMS[details.target];
      fading.current = !trim;
      if (trim) {
        setEdge(trim);
        onRangeChange([next.start, next.start + next.length]);
      } else {
        setPreview({ ...current, fadeIn: next.fadeIn, fadeOut: next.fadeOut });
      }
    },
    [current, onRangeChange]
  );
  const commit = useCallback(
    (next: TimelinePrimitive.Clip.Value) => {
      setEdge(null);
      if (fading.current) {
        fading.current = false;
        onShapeCommit(
          { ...current, fadeIn: next.fadeIn, fadeOut: next.fadeOut },
          "Fade"
        );
        setPreview(null);
      }
    },
    [current, onShapeCommit]
  );
  const level = useCallback(
    (gain: number) => setPreview({ ...current, gain }),
    [current]
  );
  const settleLevel = useCallback(
    (gain: number) => {
      onShapeCommit({ ...current, gain }, "Level");
      setPreview(null);
    },
    [current, onShapeCommit]
  );
  const curveIn = useCallback(
    (fadeInShape: FadeShape) =>
      onShapeCommit({ ...current, fadeInShape }, "Fade-in curve"),
    [current, onShapeCommit]
  );
  const curveOut = useCallback(
    (fadeOutShape: FadeShape) =>
      onShapeCommit({ ...current, fadeOutShape }, "Fade-out curve"),
    [current, onShapeCommit]
  );
  const value = {
    fadeIn: current.fadeIn,
    fadeInShape: current.fadeInShape,
    fadeOut: current.fadeOut,
    fadeOutShape: current.fadeOutShape,
    length: to - from,
    offset: from,
    start: from,
  };
  return (
    <TimelineClip
      aria-label="Selection"
      className="pointer-events-none z-20"
      minLength={SHORTEST_SELECTION}
      movable={false}
      onValueChange={change}
      onValueCommitted={commit}
      // It is the selection already: a press on a handle does not pick it as a clip.
      selected={false}
      sourceLength={duration}
      value={value}
    >
      {/* The fades as they will be, while a corner drags; the sound draws them once they are. */}
      {preview ? <FadeShade value={value} /> : null}
      <TimelineClipHandle
        aria-label="Selection start"
        className="pointer-events-auto"
        edge="start"
      />
      <TimelineClipHandle
        aria-label="Selection end"
        className="pointer-events-auto"
        edge="end"
      />
      <TimelineClipFadeHandle
        aria-label="Fade in"
        // Always shown: they belong to the selection, which has no hover of its own.
        className="pointer-events-auto opacity-100"
        edge="in"
        onShapeChange={curveIn}
        shape={current.fadeInShape}
      />
      <TimelineClipFadeHandle
        aria-label="Fade out"
        // Always shown: they belong to the selection, which has no hover of its own.
        className="pointer-events-auto opacity-100"
        edge="out"
        onShapeChange={curveOut}
        shape={current.fadeOutShape}
      />
      <LevelHandle
        gain={current.gain}
        onChange={level}
        onCommit={settleLevel}
      />
      {edge ? (
        <span
          className={cn(
            "pointer-events-none absolute bottom-1 z-20 rounded-sm bg-foreground px-1 text-[10px] text-background tabular-nums",
            edge === "start" ? "left-1" : "right-1"
          )}
        >
          {edge === "start"
            ? `Start ${formatPrecise(from)}`
            : `End ${formatPrecise(to)}`}
        </span>
      ) : null}
    </TimelineClip>
  );
}

export { SelectionFrame };
