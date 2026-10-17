"use client";

import {
  addWarpMarker,
  moveWarpMarker,
  removeWarpMarker,
  scaleWarp,
  unwarpedTime,
  type WarpMarker,
  warpedTime,
  warpRate,
} from "@audio-ui/core/time";
import { Waveform as WaveformPrimitive } from "@audio-ui/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ClipBox,
  ClipField,
  ClipRow,
  ClipTitle,
  ClipToggle,
  ClipView,
  PositionField,
} from "@/registry-audio/bases/base/audio/elements/clip-view";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelineRange,
  TimelineRangeHandle,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";

/** What the panel sets on a clip. Times are in the source's own time, from its start, or with `warp` on the clip's. */
export interface ClipSettings {
  /** In dB. */
  gain: number;
  /** How long the clip plays. */
  length: number;
  /** The stretch of the source that repeats, or null when the clip plays it once. */
  loop: readonly [number, number] | null;
  /** Where in the source the clip starts playing. */
  offset: number;
  reversed: boolean;
  /** How long the source is. */
  sourceLength: number;
  /** In semitones. */
  transpose: number;
  /**
   * Markers pinning times in the source to times on the clip, or null when
   * the source plays as recorded. Warped, the source is stretched between
   * them, speed and pitch together, and the other times are the clip's.
   */
  warp: readonly WarpMarker[] | null;
}

interface ClipPanelProps {
  /** Whether the clip is on: off, it stays on its track and is not heard. Leave it out, with `onActiveChange`, for a panel without the switch. */
  active?: boolean;
  /** How long a bar lasts, in seconds: the ruler numbers bars and the lanes draw a line at each. @default 2 */
  bar?: number;
  /** Beats in a bar: zoomed in far enough, the ruler numbers them too. @default 4 */
  beatsPerBar?: number;
  /** Whatever the host puts at the end of the title bar. */
  children?: ReactNode;
  className?: string;
  /** Whether the panel is collapsed to its title, controlled: keep it outside to hold it across clips. Leave it out for the panel to keep its own. */
  collapsed?: boolean;
  /** How a time in the source reads, in the hover and the handles. @default seconds with two decimals */
  format?: (seconds: number) => string;
  /** The clip's name, the panel's title. */
  name: string;
  /** The clip's switch was pressed. */
  onActiveChange?: (active: boolean) => void;
  /** The chevron by the name was pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Crop was pressed: cut the source down to what the clip plays. Leave it out for a panel without it. */
  onCrop?: () => void;
  /** Every change, as a gesture goes. */
  onValueChange: (value: ClipSettings) => void;
  /** A gesture that changed the settings ended. */
  onValueCommitted?: () => void;
  /** The time signature the clip is counted in, as text such as "4/4". @default `${beatsPerBar}/4` */
  signature?: string;
  value: ClipSettings;
  /** The source's peaks, the shape the waveform draws. */
  values: WaveformPrimitive.Root.Peaks;
}

const formatSeconds = (seconds: number) => `${seconds.toFixed(2)} s`;

/** The peaks read again, the one at `pick(index, count)` for each index: a list of amplitudes, or a `{ min, max }` pair of them. */
function remap(
  values: WaveformPrimitive.Root.Peaks,
  pick: (index: number, count: number) => number
): WaveformPrimitive.Root.Peaks {
  const read = (list: ArrayLike<number>) =>
    Array.from(
      { length: list.length },
      (_, index) => list[pick(index, list.length)] ?? 0
    );
  return "length" in values
    ? read(values)
    : { max: read(values.max), min: read(values.min) };
}

/** A speed as the pitch it moves to, in semitones: twice as fast is an octave up. */
const formatRate = (rate: number) => {
  const semitones = 12 * Math.log2(rate);
  return `${rate.toFixed(2)}× · ${semitones > 0 ? "+" : ""}${semitones.toFixed(1)} st`;
};
const formatGain = (db: number) => `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
const formatTranspose = (semitones: number) =>
  `${semitones > 0 ? "+" : ""}${semitones} st`;
/** A number typed in a field, its unit left out. */
const parseNumber = (text: string) => {
  const value = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
};
const GAIN_RANGE = [-36, 24] as const;
const TRANSPOSE_RANGE = [-48, 48] as const;

/** Which marker a handle stands for. */
const markerIndex = (element: HTMLElement) => Number(element.dataset.index);

/** Keeps a double-click on a marker from adding another under it. */
const stopPropagation = (event: MouseEvent<HTMLElement>) =>
  event.stopPropagation();

/**
 * The warp markers over the waveform: drag one, or press its arrows, to
 * stretch the source on either side of it; Delete takes it away (two stay).
 */
function WarpMarkers({
  format,
  markers,
  onChange,
  onCommit,
  span,
}: {
  format: (seconds: number) => string;
  markers: readonly WarpMarker[];
  onChange: (next: readonly WarpMarker[]) => void;
  onCommit?: () => void;
  span: number;
}) {
  const startDrag = useCallback((event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const drag = useCallback(
    (event: PointerEvent<HTMLSpanElement>) => {
      const handle = event.currentTarget;
      const box = handle
        .closest('[data-slot="clip-panel-source"]')
        ?.getBoundingClientRect();
      if (
        !(handle.hasPointerCapture(event.pointerId) && box && box.width > 0)
      ) {
        return;
      }
      const at = ((event.clientX - box.left) / box.width) * span;
      onChange(moveWarpMarker(markers, markerIndex(handle), at));
    },
    [markers, onChange, span]
  );
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>) => {
      const index = markerIndex(event.currentTarget);
      const step = (event.shiftKey ? 10 : 1) * (span / 100);
      const direction = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      let next: readonly WarpMarker[] | null = null;
      if (event.key === "Delete" || event.key === "Backspace") {
        next = removeWarpMarker(markers, index);
      } else if (direction) {
        next = moveWarpMarker(
          markers,
          index,
          (markers[index]?.target ?? 0) + direction * step
        );
      }
      if (next) {
        event.preventDefault();
        event.stopPropagation();
        onChange(next);
        onCommit?.();
      }
    },
    [markers, onChange, onCommit, span]
  );
  return markers.map((marker, index) => (
    <div
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/70"
      data-slot="clip-panel-warp-marker"
      key={`${marker.source}`}
      style={{ left: `${(marker.target / span) * 100}%` }}
    >
      <span
        aria-label={`Warp marker ${index + 1}`}
        aria-valuemax={span}
        aria-valuemin={0}
        aria-valuenow={marker.target}
        aria-valuetext={format(marker.target)}
        className="pointer-events-auto absolute top-0 left-1/2 size-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-sm border border-foreground bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-index={index}
        onDoubleClick={stopPropagation}
        onKeyDown={keyDown}
        onLostPointerCapture={onCommit}
        onPointerDown={startDrag}
        onPointerMove={drag}
        role="slider"
        tabIndex={0}
      />
    </div>
  ));
}

/**
 * The clip view of an arrangement's audio clip, as a DAW's: a Clip box (its
 * switch and name, where it starts and ends in its source or with Loop on the
 * stretch that repeats, in bars.beats.sixteenths, and its signature) and an
 * Audio box (Warp, Reverse, Crop, Gain and Transpose, and with Warp on the
 * speed, ×2 and ÷2) beside its whole source as a waveform, where the stretch
 * it plays, its loop and its warp markers are dragged. Controlled: it reports
 * every change and the end of each gesture.
 */
function ClipPanel({
  active,
  bar = 2,
  beatsPerBar = 4,
  children,
  className,
  collapsed,
  format = formatSeconds,
  name,
  onActiveChange,
  onCollapsedChange,
  onCrop,
  onValueChange,
  onValueCommitted,
  signature = `${beatsPerBar}/4`,
  value,
  values,
}: ClipPanelProps) {
  const {
    gain,
    length,
    loop,
    offset,
    reversed,
    sourceLength,
    transpose,
    warp,
  } = value;
  const meter = useMemo(() => ({ bar, beatsPerBar }), [bar, beatsPerBar]);
  // How long the source lasts on the clip: as recorded, or as its warp stretches it.
  const span = warp ? warpedTime(warp, sourceLength) : sourceLength;
  // Warped, the source is drawn in the clip's time; reversed, backwards, as it plays.
  const shown = useMemo(() => {
    const placed = warp
      ? remap(values, (index, count) =>
          Math.round(
            (unwarpedTime(warp, (index / Math.max(1, count - 1)) * span) /
              sourceLength) *
              (count - 1)
          )
        )
      : values;
    return reversed
      ? remap(placed, (index, count) => count - 1 - index)
      : placed;
  }, [reversed, sourceLength, span, values, warp]);
  const set = useCallback(
    (patch: Partial<ClipSettings>) => onValueChange({ ...value, ...patch }),
    [onValueChange, value]
  );
  const setAndCommit = useCallback(
    (patch: Partial<ClipSettings>) => {
      set(patch);
      onValueCommitted?.();
    },
    [onValueCommitted, set]
  );
  const setPlayed = useCallback(
    ([start, end]: readonly [number, number]) =>
      set({ length: end - start, offset: start }),
    [set]
  );
  const setLoop = useCallback(
    (next: readonly [number, number]) => set({ loop: next }),
    [set]
  );
  // The fields: Start moves where the clip starts in its source, its end staying put unless it loops.
  const setStart = useCallback(
    (start: number) =>
      set(
        loop
          ? { offset: start }
          : { length: Math.max(0, offset + length - start), offset: start }
      ),
    [length, loop, offset, set]
  );
  const setEnd = useCallback(
    (end: number) => set({ length: Math.max(0, end - offset) }),
    [offset, set]
  );
  const setLoopPosition = useCallback(
    (position: number) =>
      loop && set({ loop: [position, position + loop[1] - loop[0]] }),
    [loop, set]
  );
  const setLoopLength = useCallback(
    (stretch: number) => loop && set({ loop: [loop[0], loop[0] + stretch] }),
    [loop, set]
  );
  // A loop begins on what the clip plays; switched off, the clip plays once, as far as its source goes.
  const toggleLoop = useCallback(
    () =>
      setAndCommit(
        loop
          ? { length: Math.min(length, span - offset), loop: null }
          : {
              loop: [offset, offset + Math.min(length, span - offset)],
            }
      ),
    [length, loop, offset, setAndCommit, span]
  );
  // Warp starts as recorded, a marker at each end; off, the clip plays as far as the source goes.
  const toggleWarp = useCallback(
    () =>
      setAndCommit(
        warp
          ? {
              length: Math.min(
                length,
                sourceLength - Math.min(offset, sourceLength)
              ),
              loop: null,
              offset: Math.min(offset, sourceLength),
              warp: null,
            }
          : {
              warp: [
                { source: 0, target: 0 },
                { source: sourceLength, target: sourceLength },
              ],
            }
      ),
    [length, offset, setAndCommit, sourceLength, warp]
  );
  const setWarp = useCallback(
    (next: readonly WarpMarker[]) => set({ warp: next }),
    [set]
  );
  const slower = useCallback(
    () => warp && setAndCommit({ warp: scaleWarp(warp, 2) }),
    [setAndCommit, warp]
  );
  const faster = useCallback(
    () => warp && setAndCommit({ warp: scaleWarp(warp, 0.5) }),
    [setAndCommit, warp]
  );
  const addMarker = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const box = event.currentTarget
        .querySelector('[data-slot="clip-panel-source"]')
        ?.getBoundingClientRect();
      if (!(warp && box && box.width > 0)) {
        return;
      }
      const at = ((event.clientX - box.left) / box.width) * span;
      setAndCommit({ warp: addWarpMarker(warp, at) });
    },
    [setAndCommit, span, warp]
  );
  const toggleReversed = useCallback(
    () => setAndCommit({ reversed: !reversed }),
    [reversed, setAndCommit]
  );
  const setGain = useCallback(
    (next: number) =>
      set({ gain: Math.min(GAIN_RANGE[1], Math.max(GAIN_RANGE[0], next)) }),
    [set]
  );
  const setTranspose = useCallback(
    (next: number) =>
      set({
        transpose: Math.round(
          Math.min(TRANSPOSE_RANGE[1], Math.max(TRANSPOSE_RANGE[0], next))
        ),
      }),
    [set]
  );
  // A warped source is cropped as it was recorded: warp off first.
  const cropped =
    Boolean(warp) ||
    (loop
      ? loop[0] === 0 && loop[1] === sourceLength
      : offset === 0 && length >= sourceLength);

  const title = (
    <ClipTitle active={active} name={name} onActiveChange={onActiveChange}>
      {children}
    </ClipTitle>
  );

  return (
    <ClipView
      boxes={
        <>
          <ClipBox title="Clip">
            {title}
            <ClipRow label="Start">
              <PositionField
                label="Start"
                max={span}
                meter={meter}
                onChange={setStart}
                onCommit={onValueCommitted}
                value={offset}
              />
            </ClipRow>
            {loop ? (
              <>
                <ClipRow label="Position">
                  <PositionField
                    label="Loop position"
                    max={span}
                    meter={meter}
                    onChange={setLoopPosition}
                    onCommit={onValueCommitted}
                    value={loop[0]}
                  />
                </ClipRow>
                <ClipRow label="Length">
                  <PositionField
                    kind="length"
                    label="Loop length"
                    meter={meter}
                    min={bar / beatsPerBar / 4}
                    onChange={setLoopLength}
                    onCommit={onValueCommitted}
                    value={loop[1] - loop[0]}
                  />
                </ClipRow>
              </>
            ) : (
              <ClipRow label="End">
                <PositionField
                  label="End"
                  max={span}
                  meter={meter}
                  onChange={setEnd}
                  onCommit={onValueCommitted}
                  value={offset + length}
                />
              </ClipRow>
            )}
            <ClipRow label="Signature">
              <span className="text-end tabular-nums">{signature}</span>
            </ClipRow>
            <ClipToggle onClick={toggleLoop} pressed={Boolean(loop)}>
              Loop
            </ClipToggle>
          </ClipBox>
          <ClipBox title="Audio">
            <div className="grid grid-cols-3 gap-1">
              <ClipToggle onClick={toggleWarp} pressed={Boolean(warp)}>
                Warp
              </ClipToggle>
              <ClipToggle onClick={toggleReversed} pressed={reversed}>
                Rev
              </ClipToggle>
              {onCrop ? (
                <ClipToggle disabled={cropped} onClick={onCrop}>
                  Crop
                </ClipToggle>
              ) : null}
            </div>
            <ClipRow label="Gain">
              <ClipField
                format={formatGain}
                label="Gain"
                onChange={setGain}
                onCommit={onValueCommitted}
                parse={parseNumber}
                step={0.5}
                value={gain}
              />
            </ClipRow>
            <ClipRow label="Transpose">
              <ClipField
                format={formatTranspose}
                label="Transpose"
                onChange={setTranspose}
                onCommit={onValueCommitted}
                parse={parseNumber}
                step={1}
                value={transpose}
              />
            </ClipRow>
            {warp ? (
              <>
                <ClipRow label="Speed">
                  <output className="text-end tabular-nums">
                    {formatRate(warpRate(warp, offset))}
                  </output>
                </ClipRow>
                <div className="grid grid-cols-2 gap-1">
                  <ClipToggle
                    aria-label="Twice as long, half the speed"
                    onClick={slower}
                  >
                    ×2
                  </ClipToggle>
                  <ClipToggle
                    aria-label="Half as long, twice the speed"
                    onClick={faster}
                  >
                    ÷2
                  </ClipToggle>
                </div>
              </>
            ) : null}
          </ClipBox>
        </>
      }
      className={className}
      collapsed={collapsed}
      data-slot="clip-panel"
      name={name}
      onCollapsedChange={onCollapsedChange}
      title={title}
    >
      <ClipSource
        bar={bar}
        beatsPerBar={beatsPerBar}
        format={format}
        length={length}
        loop={loop}
        name={name}
        offset={offset}
        onAddMarker={addMarker}
        onLoopChange={setLoop}
        onPlayedChange={setPlayed}
        onValueCommitted={onValueCommitted}
        onWarpChange={setWarp}
        span={span}
        values={shown}
        warp={warp}
      />
    </ClipView>
  );
}

/** The bars a ruler labels: every bar, or every second, fourth… so labels stay this far apart, in px. */
const LABEL_SPACING = 40;
/** The widest a peak of the waveform is drawn, in px: zooming in stops there, before the drawing turns to blocks. */
const PEAK_PX = 3;

/** How many peaks the waveform has across the source. */
const peakCount = (values: WaveformPrimitive.Root.Peaks) =>
  "length" in values ? values.length : values.max.length;

/** The ruler's labels at `pxPerSecond`: each beat (`bar.beat`) once they are far enough apart, else every bar, every second, fourth… */
function rulerLabels(
  span: number,
  bar: number,
  beatsPerBar: number,
  pxPerSecond: number
) {
  const beat = bar / beatsPerBar;
  if (beat * pxPerSecond >= LABEL_SPACING) {
    return Array.from({ length: Math.floor(span / beat) + 1 }, (_, index) => {
      const number = Math.floor(index / beatsPerBar) + 1;
      const inBar = (index % beatsPerBar) + 1;
      return {
        at: index * beat,
        text: inBar === 1 ? `${number}` : `${number}.${inBar}`,
      };
    });
  }
  let every = 1;
  while (every * bar * pxPerSecond < LABEL_SPACING && every < 1024) {
    every *= 2;
  }
  return Array.from(
    { length: Math.floor(span / (bar * every)) + 1 },
    (_, index) => ({ at: index * every * bar, text: `${index * every + 1}` })
  );
}

/**
 * The clip's source on a timeline of its own: an overview bar to zoom and
 * scroll with, a ruler in bars, the stretch the clip plays (or its loop) to
 * drag at both ends, and the waveform, warped markers included, under it.
 */
function ClipSource({
  bar,
  beatsPerBar,
  format,
  length,
  loop,
  name,
  offset,
  onAddMarker,
  onLoopChange,
  onPlayedChange,
  onValueCommitted,
  onWarpChange,
  span,
  values,
  warp,
}: {
  bar: number;
  beatsPerBar: number;
  format: (seconds: number) => string;
  length: number;
  loop: readonly [number, number] | null;
  name: string;
  offset: number;
  onAddMarker: (event: MouseEvent<HTMLDivElement>) => void;
  onLoopChange: (next: readonly [number, number]) => void;
  onPlayedChange: (next: readonly [number, number]) => void;
  onValueCommitted?: () => void;
  onWarpChange: (next: readonly WarpMarker[]) => void;
  span: number;
  values: WaveformPrimitive.Root.Peaks;
  warp: readonly WarpMarker[] | null;
}) {
  // Fitted to its width until zoomed, as the arrangement is.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const measure = () => setFit(element.clientWidth / Math.max(span, 1e-6));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [span]);
  const pxPerSecond = zoom ?? fit;
  const labels = rulerLabels(span, bar, beatsPerBar, pxPerSecond);
  // Zoomed in, a line per beat; out, a line per bar.
  const beat = bar / beatsPerBar;
  const gridStep = beat * pxPerSecond >= LABEL_SPACING / 2 ? beat : bar;
  // As far in as the waveform has detail for.
  const maxZoom = Math.max(fit, (peakCount(values) * PEAK_PX) / span);
  return (
    <Timeline
      className="min-w-0 flex-1 gap-1 p-2"
      duration={span}
      maxZoom={maxZoom || undefined}
      minZoom={fit || undefined}
      onZoomChange={setZoom}
      zoom={zoom ?? undefined}
    >
      <TimelineNavigator getAriaValueText={format} />
      <TimelineViewport
        className="min-w-0 rounded-md border bg-muted/40"
        ref={viewportRef}
        scrollbar="hidden"
      >
        <div className="flex w-max min-w-full flex-col">
          {/* Bar numbers, from the start of the source. */}
          <TimelineLane className="h-5 border-foreground/25 border-b text-muted-foreground text-xs">
            {labels.map((label) => (
              <TimelineMark key={label.at} value={label.at}>
                {label.text}
              </TimelineMark>
            ))}
          </TimelineLane>
          {/* What the clip plays, or the stretch it loops, with its start as a marker. */}
          <TimelineLane className="h-6 border-foreground/25 border-b">
            {loop ? (
              <>
                <TimelineRange
                  aria-label="Loop"
                  getAriaValueText={format}
                  onValueChange={onLoopChange}
                  onValueCommitted={onValueCommitted}
                  value={loop}
                >
                  <TimelineRangeHandle aria-label="Loop start" edge="start" />
                  <TimelineRangeHandle aria-label="Loop end" edge="end" />
                </TimelineRange>
                <TimelineMark value={offset}>
                  <span className="border-foreground border-s-2 ps-1 text-xs">
                    Start
                  </span>
                </TimelineMark>
              </>
            ) : (
              <TimelineRange
                aria-label="Played"
                getAriaValueText={format}
                onValueChange={onPlayedChange}
                onValueCommitted={onValueCommitted}
                value={[offset, Math.min(span, offset + length)]}
              >
                <TimelineRangeHandle aria-label="Clip start" edge="start" />
                <TimelineRangeHandle aria-label="Clip end" edge="end" />
              </TimelineRange>
            )}
          </TimelineLane>
          {/* Warped, a double-click on the waveform pins what plays there with a new marker. */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; the markers' own keys and the Warp switch cover the keyboard */}
          <div className="relative" onDoubleClick={onAddMarker}>
            <TimelineLane className="h-28 border-b-0" gridStep={gridStep}>
              <div
                className="absolute inset-y-0 left-0"
                data-slot="clip-panel-source"
                style={{ width: `calc(var(--timeline-unit) * ${span})` }}
              >
                <WaveformPrimitive.Root
                  aria-label={`${name} source`}
                  className="absolute inset-0"
                  duration={span}
                  peaks={values}
                >
                  <WaveformPrimitive.Canvas className="cn-waveform-canvas block size-full" />
                </WaveformPrimitive.Root>
                {warp ? (
                  <WarpMarkers
                    format={format}
                    markers={warp}
                    onChange={onWarpChange}
                    onCommit={onValueCommitted}
                    span={span}
                  />
                ) : null}
              </div>
            </TimelineLane>
          </div>
        </div>
      </TimelineViewport>
    </Timeline>
  );
}

export { ClipPanel };
