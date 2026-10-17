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
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
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
  /** How long a bar lasts, in seconds: the ruler numbers bars and the lanes draw a line at each. @default 2 */
  bar?: number;
  /** Whatever the host puts at the end of the title bar. */
  children?: ReactNode;
  className?: string;
  /** How a time in the source reads, in the hover and the handles. @default seconds with two decimals */
  format?: (seconds: number) => string;
  /** The clip's name, the panel's title. */
  name: string;
  /** Crop was pressed: cut the source down to what the clip plays. Leave it out for a panel without it. */
  onCrop?: () => void;
  /** Every change, as a gesture goes. */
  onValueChange: (value: ClipSettings) => void;
  /** A gesture that changed the settings ended. */
  onValueCommitted?: () => void;
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
 * The clip view of an arrangement's clip: its whole source as a waveform,
 * with the stretch it plays to drag at both ends, or with Loop on, the
 * stretch that repeats, and its start as a marker. Gain and Transpose are
 * knobs, Reverse plays the source backwards and Crop cuts it down to what is
 * played. Warp stretches the source between markers pinned to times on the
 * clip, speed and pitch together, with ×2 and ÷2 for the whole of it.
 * Controlled: it reports every change and the end of each gesture.
 */
function ClipPanel({
  bar = 2,
  children,
  className,
  format = formatSeconds,
  name,
  onCrop,
  onValueChange,
  onValueCommitted,
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
  const setGain = useCallback((next: number) => set({ gain: next }), [set]);
  const setTranspose = useCallback(
    (next: number) => set({ transpose: next }),
    [set]
  );
  // A warped source is cropped as it was recorded: warp off first.
  const cropped =
    Boolean(warp) ||
    (loop
      ? loop[0] === 0 && loop[1] === sourceLength
      : offset === 0 && length >= sourceLength);

  return (
    <section
      aria-label={`Clip ${name}`}
      className={cn(
        "@container min-w-0 shrink-0 overflow-hidden rounded-xl border bg-card",
        className
      )}
      data-slot="clip-panel"
    >
      <div className="flex min-w-0 flex-col @2xl:flex-row">
        {/* The clip's properties, as a DAW's clip view lists them beside its editor. */}
        <div className="flex shrink-0 flex-col gap-3 border-b p-3 @2xl:w-56 @2xl:border-e @2xl:border-b-0">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate font-medium text-sm">
              {name}
            </h3>
            {children}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              aria-pressed={Boolean(loop)}
              onClick={toggleLoop}
              size="sm"
              variant={loop ? "default" : "outline"}
            >
              <IconPlaceholder
                aria-hidden="true"
                className="size-4"
                hugeicons="RepeatIcon"
                lucide="RepeatIcon"
                phosphor="RepeatIcon"
                remixicon="RiRepeatLine"
                tabler="IconRepeat"
              />
              Loop
            </Button>
            <Button
              aria-pressed={Boolean(warp)}
              onClick={toggleWarp}
              size="sm"
              variant={warp ? "default" : "outline"}
            >
              <IconPlaceholder
                aria-hidden="true"
                className="size-4"
                hugeicons="ArrowExpandIcon"
                lucide="StretchHorizontalIcon"
                phosphor="ArrowsOutLineHorizontalIcon"
                remixicon="RiExpandWidthLine"
                tabler="IconArrowsHorizontal"
              />
              Warp
            </Button>
            <Button
              aria-pressed={reversed}
              onClick={toggleReversed}
              size="sm"
              variant={reversed ? "default" : "outline"}
            >
              <IconPlaceholder
                aria-hidden="true"
                className="size-4"
                hugeicons="ArrowLeftDoubleIcon"
                lucide="RewindIcon"
                phosphor="RewindIcon"
                remixicon="RiRewindLine"
                tabler="IconPlayerTrackPrev"
              />
              Reverse
            </Button>
            {onCrop ? (
              <Button
                disabled={cropped}
                onClick={onCrop}
                size="sm"
                variant="outline"
              >
                <IconPlaceholder
                  aria-hidden="true"
                  className="size-4"
                  hugeicons="Crop02Icon"
                  lucide="CropIcon"
                  phosphor="CropIcon"
                  remixicon="RiCropLine"
                  tabler="IconCrop"
                />
                Crop
              </Button>
            ) : null}
          </div>
          {/* Each knob named above and read out below, as on a device. */}
          <div className="flex items-start justify-around gap-4">
            <div className="flex flex-col items-center gap-0.5">
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs"
              >
                Gain
              </span>
              <Knob
                anchor={0}
                aria-label="Gain"
                className="mb-5"
                formatValue={formatGain}
                max={24}
                min={-36}
                onValueChange={setGain}
                onValueCommitted={onValueCommitted}
                size="sm"
                step={0.1}
                value={gain}
                valueLabel="always"
              />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span
                aria-hidden="true"
                className="text-muted-foreground text-xs"
              >
                Transpose
              </span>
              <Knob
                anchor={0}
                aria-label="Transpose"
                className="mb-5"
                formatValue={formatTranspose}
                max={48}
                min={-48}
                onValueChange={setTranspose}
                onValueCommitted={onValueCommitted}
                size="sm"
                step={1}
                value={transpose}
                valueLabel="always"
              />
            </div>
          </div>
          {warp ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs">Speed</span>
              <div className="flex gap-1">
                <Button
                  aria-label="Twice as long, half the speed"
                  onClick={slower}
                  size="xs"
                  variant="outline"
                >
                  ×2
                </Button>
                <Button
                  aria-label="Half as long, twice the speed"
                  onClick={faster}
                  size="xs"
                  variant="outline"
                >
                  ÷2
                </Button>
              </div>
              <output className="text-muted-foreground text-xs tabular-nums">
                {formatRate(warpRate(warp, offset))}
              </output>
            </div>
          ) : null}
        </div>
        <ClipSource
          bar={bar}
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
      </div>
    </section>
  );
}

/** The bars a ruler labels: every bar, or every second, fourth… so labels stay this far apart, in px. */
const LABEL_SPACING = 40;

/**
 * The clip's source on a timeline of its own: an overview bar to zoom and
 * scroll with, a ruler in bars, the stretch the clip plays (or its loop) to
 * drag at both ends, and the waveform, warped markers included, under it.
 */
function ClipSource({
  bar,
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
  let every = 1;
  while (every * bar * pxPerSecond < LABEL_SPACING && every < 1024) {
    every *= 2;
  }
  const labels = Array.from(
    { length: Math.floor(span / (bar * every)) + 1 },
    (_, index) => index * every
  );
  return (
    <Timeline
      className="min-w-0 flex-1 gap-1 p-2"
      duration={span}
      maxZoom={fit * 64 || undefined}
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
            {labels.map((count) => (
              <TimelineMark key={count} value={count * bar}>
                {count + 1}
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
            <TimelineLane className="h-28 border-b-0" gridStep={bar}>
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
