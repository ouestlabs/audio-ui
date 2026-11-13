import type { WarpMode } from "@audio-ui/engine/playback";
import {
  addWarpMarker,
  moveWarpMarker,
  removeWarpMarker,
  scaleWarp,
  type WarpMarker,
  warpedTime,
  warpRate,
} from "@audio-ui/engine/time";
import { hasWebGL2 } from "@audio-ui/gl/lane";
import type { WaveformBands } from "@audio-ui/gl/waveform";
import type { Source } from "@audio-ui/react";
import { WaveformIcon } from "@phosphor-icons/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ClipBox,
  type ClipMeter,
  ClipRow,
  ClipToggle,
  ClipView,
  PositionField,
  useClipPlayhead,
} from "@/components/audio-ui/clip-view";
import {
  type ClipSamples,
  ClipWaveform,
} from "@/components/audio-ui/clip-waveform";
import { ParameterField } from "@/components/audio-ui/parameter-field";
import {
  isSoundView,
  isSpectrogramView,
  SOUND_VIEWS,
  SoundLane,
  type SoundView,
} from "@/components/audio-ui/sound-lane";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineViewport,
} from "@/components/audio-ui/timeline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLoudest } from "@/hooks/use-loudest";
import {
  type ClipPeaks,
  type ClipReading,
  clipPeakCount,
  clipSegments,
} from "@/lib/arrangement";
import { cn } from "@/lib/utils";

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
  /** How it plays at another speed than its recording's: its pitch with its speed in Repitch, kept in Beats and Tones. @default "repitch" */
  warpMode?: WarpMode;
}

/**
 * The settings of a clip reversed, or played forwards again: the same stretch
 * of the source plays the other way, so its region and its loop are mirrored
 * across the source (as the source now plays backwards, what was its end is
 * its start). A looped clip starts its mirrored loop from the mirror of where
 * it started.
 */
export function reversedSettings(
  settings: ClipSettings
): Partial<ClipSettings> {
  const { length, loop, offset, sourceLength, warp } = settings;
  const span = warp ? warpedTime(warp, sourceLength) : sourceLength;
  if (!loop) {
    return {
      offset: Math.max(0, span - (offset + length)),
      reversed: !settings.reversed,
    };
  }
  const mirrored = [span - loop[1], span - loop[0]] as const;
  const start = span - offset;
  return {
    loop: mirrored,
    offset: start >= mirrored[1] ? mirrored[0] : Math.max(0, start),
    reversed: !settings.reversed,
  };
}

interface ClipPanelProps {
  /** Whether the clip is on: off, it stays on its track and is not heard. Leave it out, with `onActiveChange`, for a panel without the switch. */
  active?: boolean;
  /** The source as three signals, its lows, mids and highs with the loudest of each, as `splitBands` of `@audio-ui/engine/analysis` gives them: with them, the view menu offers the waveform by band. Called once, so it may split lazily. */
  bands?: () => WaveformBands;
  /** How long a bar lasts, in seconds: the ruler numbers bars and the lanes draw a line at each. @default 2 */
  bar?: number;
  /** Beats in a bar: zoomed in far enough, the ruler numbers them too. @default 4 */
  beatsPerBar?: number;
  /** The source's channels, a reader each, for a waveform drawn a row a channel once the rows are tall enough to read, as a DAW draws a stereo recording. `samples` stays their mix. Leave it out for a mono source, or one waveform. */
  channels?: readonly ClipSamples[];
  /** Whatever the host puts at the end of the title bar. */
  children?: ReactNode;
  className?: string;
  /** Whether the panel is rolled up to its strip, controlled: keep it outside to hold it from clip to clip. Leave it out for the panel to keep its own. */
  collapsed?: boolean;
  /** The ids of its folded boxes ("audio:loop", "audio:sample"), controlled. */
  foldedBoxes?: readonly string[];
  /** How a time in the source reads, in the hover and the handles. @default seconds with two decimals */
  format?: (seconds: number) => string;
  /** The clip's name, the panel's title. */
  name: string;
  /** The clip's switch was pressed. */
  onActiveChange?: (active: boolean) => void;
  /** The caret on the strip was pressed. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Crop was pressed: cut the source down to what the clip plays. Leave it out for a panel without it. */
  onCrop?: () => void;
  /** Which boxes are folded was changed. */
  onFoldedBoxesChange?: (folded: string[]) => void;
  /** A name was typed in the strip. */
  onRename?: (name: string) => void;
  /** Every change, as a gesture goes. */
  onValueChange: (value: ClipSettings) => void;
  /** A gesture that changed the settings ended. */
  onValueCommitted?: () => void;
  /** Another view of the source was picked. */
  onViewChange?: (view: SoundView) => void;
  /** The arrangement's position, live: while it plays the clip, a playhead shows where in the source it reads. Leave it out for none. */
  position?: Source<number>;
  /** The source's samples, read as the view needs them: with them, the waveform zooms in to the samples themselves, as a line through them past a frame per pixel, and is drawn on the GPU when they are held in memory or, streamed from a file, give their `leaves`. Leave it out to stop at the peaks' detail. */
  samples?: ClipSamples;
  /** Where the clip starts on the arrangement, what `position` is read against. @default 0 */
  start?: number;
  value: ClipSettings;
  /** The source's peaks, the shape the waveform draws. */
  values: ClipPeaks;
  /** How the source is drawn, controlled: its waveform, by band, or its spectrogram on one of four frequency axes. On the GPU only: a reversed clip, or without WebGL 2, is drawn as its waveform. Leave it out for the panel to keep its own. @default "wave" */
  view?: SoundView;
}

const formatSeconds = (seconds: number) => `${seconds.toFixed(2)} s`;

/** A speed as the pitch it moves to, in semitones: twice as fast is an octave up. */
const formatRate = (rate: number) => {
  const semitones = 12 * Math.log2(rate);
  return `${rate.toFixed(2)}× · ${semitones > 0 ? "+" : ""}${semitones.toFixed(1)} st`;
};
const SIGNED: Intl.NumberFormatOptions = { signDisplay: "exceptZero" };
const GAIN_RANGE = [-36, 24] as const;
const TRANSPOSE_RANGE = [-48, 48] as const;

/** Which marker a handle stands for. */
const markerIndex = (element: HTMLElement) => Number(element.dataset.index);

/** Keeps a double-click on a marker from adding another under it. */
const stopPropagation = (event: MouseEvent<HTMLElement>) =>
  event.stopPropagation();

/** How far apart warp markers have to be on average, in px, for their handles to fit and be told apart. */
const WARP_MARKER_ROOM = 16;

/** Whether the warp markers lie too close at this zoom to be held: they then show as ticks, and zooming in brings their handles. */
export function warpMarkersTight(
  count: number,
  span: number,
  pxPerSecond: number
): boolean {
  return (span * pxPerSecond) / Math.max(1, count - 1) < WARP_MARKER_ROOM;
}

/**
 * The warp markers over the waveform: drag one, or press its arrows, to
 * stretch the source on either side of it; Delete takes it away (two stay).
 * `tight`, they are ticks along its top that keep the waveform in sight.
 */
const WarpMarkers = memo(
  ({
    format,
    markers,
    onChange,
    onCommit,
    span,
    tight,
  }: {
    format: (seconds: number) => string;
    markers: readonly WarpMarker[];
    onChange: (next: readonly WarpMarker[]) => void;
    onCommit?: () => void;
    span: number;
    tight: boolean;
  }) => {
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
        className={
          tight
            ? "pointer-events-none absolute top-0 z-10 h-1.5 w-px bg-foreground/50"
            : "pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/70"
        }
        data-slot="clip-panel-warp-marker"
        key={`${marker.source}`}
        style={{ left: `${(marker.target / span) * 100}%` }}
      >
        {tight ? null : (
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
        )}
      </div>
    ));
  }
);

/** The Loop box: the switch, where the loop sits in the source and how long it is, halved or doubled. */
function LoopBox({
  loop,
  meter,
  offset,
  onCommit,
  onDouble,
  onHalve,
  onLength,
  onPosition,
  onToggle,
  span,
  stretch,
}: {
  loop: readonly [number, number] | null;
  meter: ClipMeter;
  offset: number;
  onCommit?: () => void;
  onDouble: () => void;
  onHalve: () => void;
  onLength: (seconds: number) => void;
  onPosition: (seconds: number) => void;
  onToggle: () => void;
  span: number;
  stretch: number;
}) {
  return (
    <ClipBox foldable id="audio:loop" title="Loop">
      <ClipToggle onClick={onToggle} pressed={Boolean(loop)}>
        Loop
      </ClipToggle>
      <PositionField
        disabled={!loop}
        label="Loop position"
        max={span}
        meter={meter}
        onChange={onPosition}
        onCommit={onCommit}
        shortLabel="Position"
        value={loop?.[0] ?? offset}
      />
      <PositionField
        disabled={!loop}
        kind="length"
        label="Loop length"
        meter={meter}
        min={meter.bar / meter.beatsPerBar / 4}
        onChange={onLength}
        onCommit={onCommit}
        shortLabel="Length"
        value={stretch}
      />
      <div className="grid grid-cols-2 gap-1">
        <ClipToggle
          aria-label="Halve the loop"
          disabled={!loop}
          onClick={onHalve}
        >
          ÷2
        </ClipToggle>
        <ClipToggle
          aria-label="Double the loop"
          disabled={!loop}
          onClick={onDouble}
        >
          ×2
        </ClipToggle>
      </div>
    </ClipBox>
  );
}

const WARP_MODES: readonly { label: string; mode: WarpMode }[] = [
  { label: "Repitch", mode: "repitch" },
  { label: "Beats", mode: "beats" },
  { label: "Tones", mode: "tones" },
];

function WarpModeToggle({
  label,
  mode,
  onPick,
  pressed,
}: {
  label: string;
  mode: WarpMode;
  onPick: (mode: WarpMode) => void;
  pressed: boolean;
}) {
  const pick = useCallback(() => onPick(mode), [mode, onPick]);
  return (
    <ClipToggle className="px-0" onClick={pick} pressed={pressed}>
      {label}
    </ClipToggle>
  );
}

/** The Sample box: Warp, Reverse, Crop, the gain and the transpose, and the speed with ×2 and ÷2 while warped. */
function SampleBox({
  cropped,
  gain,
  onCommit,
  onCrop,
  onFaster,
  onGain,
  onReversed,
  onSlower,
  onTempo,
  onTranspose,
  onWarp,
  onWarpMode,
  rate,
  reversed,
  tempo,
  transpose,
  warpMode,
}: {
  cropped: boolean;
  gain: number;
  onCommit?: () => void;
  onCrop?: () => void;
  onFaster: () => void;
  onGain: (db: number) => void;
  onReversed: () => void;
  onSlower: () => void;
  /** A tempo was typed for the source: the warp is scaled so it plays in time at the arrangement's. */
  onTempo: (bpm: number) => void;
  onTranspose: (semitones: number) => void;
  onWarp: () => void;
  onWarpMode: (mode: WarpMode) => void;
  /** The speed the warp plays at, or null when the source plays as recorded. */
  rate: number | null;
  reversed: boolean;
  /** The arrangement's tempo, in BPM: the source's is this over `rate`, since a source at half the tempo plays twice as fast to keep time. */
  tempo: number;
  transpose: number;
  warpMode: WarpMode;
}) {
  return (
    <ClipBox foldable id="audio:sample" title="Sample">
      <div className="grid grid-cols-3 gap-1">
        <ClipToggle className="px-0" onClick={onWarp} pressed={rate !== null}>
          Warp
        </ClipToggle>
        <ClipToggle className="px-0" onClick={onReversed} pressed={reversed}>
          Rev
        </ClipToggle>
        {onCrop ? (
          <ClipToggle className="px-0" disabled={cropped} onClick={onCrop}>
            Crop
          </ClipToggle>
        ) : null}
      </div>
      <div
        aria-label="Warp mode"
        className="grid grid-cols-3 gap-1"
        role="group"
      >
        {WARP_MODES.map((item) => (
          <WarpModeToggle
            key={item.mode}
            label={item.label}
            mode={item.mode}
            onPick={onWarpMode}
            pressed={warpMode === item.mode}
          />
        ))}
      </div>
      <ParameterField
        format={SIGNED}
        label="Gain"
        max={GAIN_RANGE[1]}
        min={GAIN_RANGE[0]}
        onValueChange={onGain}
        onValueCommitted={onCommit}
        precision={1}
        shortLabel="Gain"
        size="sm"
        step={0.5}
        unit="dB"
        value={gain}
      />
      <ParameterField
        disabled={warpMode === "repitch"}
        format={SIGNED}
        label="Transpose"
        max={TRANSPOSE_RANGE[1]}
        min={TRANSPOSE_RANGE[0]}
        onValueChange={onTranspose}
        onValueCommitted={onCommit}
        scrub="vertical"
        shortLabel="Transp."
        size="sm"
        unit="st"
        value={transpose}
      />
      {rate === null ? null : (
        <>
          {/* The source's own tempo: in time at the arrangement's, it plays at their ratio. */}
          <ParameterField
            label="Source tempo"
            max={999}
            min={1}
            onValueChange={onTempo}
            onValueCommitted={onCommit}
            precision={2}
            shortLabel="BPM"
            size="sm"
            value={tempo / rate}
          />
          <div className="grid grid-cols-2 gap-1">
            <ClipToggle
              aria-label="Half the tempo: it plays twice as fast"
              onClick={onFaster}
            >
              ÷2
            </ClipToggle>
            <ClipToggle
              aria-label="Twice the tempo: it plays half as fast"
              onClick={onSlower}
            >
              ×2
            </ClipToggle>
          </div>
          <ClipRow label="Speed">
            <output className="truncate text-end tabular-nums">
              {formatRate(rate)}
            </output>
          </ClipRow>
        </>
      )}
    </ClipBox>
  );
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
  bands,
  bar = 2,
  beatsPerBar = 4,
  channels,
  children,
  className,
  collapsed,
  foldedBoxes,
  format = formatSeconds,
  name,
  onActiveChange,
  onCollapsedChange,
  onCrop,
  onFoldedBoxesChange,
  onRename,
  onValueChange,
  onValueCommitted,
  onViewChange,
  position: arrangementPosition,
  samples,
  start: clipStart = 0,
  value,
  values,
  view: viewProp,
}: ClipPanelProps) {
  // The view of the source: the host's when given, else the panel's own.
  const [ownView, setOwnView] = useState<SoundView>("wave");
  const view = viewProp ?? ownView;
  const changeView = useCallback(
    (next: SoundView) => {
      setOwnView(next);
      onViewChange?.(next);
    },
    [onViewChange]
  );
  const {
    gain,
    length,
    loop,
    offset,
    reversed,
    sourceLength,
    transpose,
    warp,
    warpMode = "repitch",
  } = value;
  // The view shown: the one picked, or the waveform where the GPU cannot draw it.
  const can = useSourceCan(samples, reversed);
  const shownView: SoundView =
    isSpectrogramView(view) && !can.spectrogram ? "wave" : view;
  const meter = useMemo(() => ({ bar, beatsPerBar }), [bar, beatsPerBar]);
  // How long the source lasts on the clip: as recorded, or as its warp stretches it.
  const span = warp ? warpedTime(warp, sourceLength) : sourceLength;
  // Where playback reads the source, in the clip's time: from where it starts in it, round its loop.
  const { playhead, playing } = useClipPlayhead(arrangementPosition, {
    length,
    loop,
    offset,
    start: clipStart,
  });
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
              // A clip warped for the first time keeps its pitch.
              warpMode: value.warpMode ?? "beats",
            }
      ),
    [length, offset, setAndCommit, sourceLength, value.warpMode, warp]
  );
  const setWarpMode = useCallback(
    (next: WarpMode) => setAndCommit({ warpMode: next }),
    [setAndCommit]
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
  // The arrangement's tempo, from how long a bar lasts.
  const tempo = (60 * beatsPerBar) / bar;
  const setTempo = useCallback(
    (bpm: number) => {
      if (!(warp && bpm > 0)) {
        return;
      }
      // Played at tempo / bpm: the warp's stretches scale by the ratio of the speeds.
      set({ warp: scaleWarp(warp, (warpRate(warp, offset) * bpm) / tempo) });
    },
    [offset, set, tempo, warp]
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
    () => setAndCommit(reversedSettings(value)),
    [setAndCommit, value]
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
  const halveLoop = useCallback(() => {
    if (loop) {
      setAndCommit({ loop: [loop[0], loop[0] + (loop[1] - loop[0]) / 2] });
    }
  }, [loop, setAndCommit]);
  const doubleLoop = useCallback(() => {
    if (loop) {
      setAndCommit({
        loop: [loop[0], Math.min(span, loop[0] + (loop[1] - loop[0]) * 2)],
      });
    }
  }, [loop, setAndCommit, span]);
  // A warped source is cropped as it was recorded: warp off first.
  const cropped =
    Boolean(warp) ||
    (loop
      ? loop[0] === 0 && loop[1] === sourceLength
      : offset === 0 && length >= sourceLength);

  return (
    <ClipView
      actions={children}
      active={active}
      boxes={
        <>
          <ClipBox title="Clip">
            <PositionField
              label="Start"
              max={span}
              meter={meter}
              onChange={setStart}
              onCommit={onValueCommitted}
              shortLabel="Start"
              value={offset}
            />
            <PositionField
              label="End"
              max={loop ? Number.POSITIVE_INFINITY : span}
              meter={meter}
              onChange={setEnd}
              onCommit={onValueCommitted}
              shortLabel="End"
              value={offset + length}
            />
          </ClipBox>
          <LoopBox
            loop={loop}
            meter={meter}
            offset={offset}
            onCommit={onValueCommitted}
            onDouble={doubleLoop}
            onHalve={halveLoop}
            onLength={setLoopLength}
            onPosition={setLoopPosition}
            onToggle={toggleLoop}
            span={span}
            stretch={loop ? loop[1] - loop[0] : length}
          />
          <SampleBox
            cropped={cropped}
            gain={gain}
            onCommit={onValueCommitted}
            onCrop={onCrop}
            onFaster={faster}
            onGain={setGain}
            onReversed={toggleReversed}
            onSlower={slower}
            onTempo={setTempo}
            onTranspose={setTranspose}
            onWarp={toggleWarp}
            onWarpMode={setWarpMode}
            rate={warp ? warpRate(warp, offset) : null}
            reversed={reversed}
            tempo={tempo}
            transpose={transpose}
            warpMode={warpMode}
          />
        </>
      }
      className={className}
      collapsed={collapsed}
      data-slot="clip-panel"
      foldedBoxes={foldedBoxes}
      name={name}
      onActiveChange={onActiveChange}
      onCollapsedChange={onCollapsedChange}
      onFoldedBoxesChange={onFoldedBoxesChange}
      onRename={onRename}
      tools={
        samples ? (
          <SourceViewMenu
            bands={Boolean(bands) && can.waveform}
            onViewChange={changeView}
            spectrogram={can.spectrogram}
            view={shownView}
          />
        ) : null
      }
    >
      <ClipSource
        bands={bands}
        bar={bar}
        beatsPerBar={beatsPerBar}
        can={can}
        channels={channels}
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
        playhead={playhead}
        playing={playing}
        reversed={reversed}
        samples={samples}
        sourceLength={sourceLength}
        span={span}
        values={values}
        view={shownView}
        warp={warp}
      />
    </ClipView>
  );
}

/** The bars a ruler labels: every bar, or every second, fourth… so labels stay this far apart, in px. */
const LABEL_SPACING = 40;
/** The widest a peak of the waveform is drawn, in px: zooming in stops there, before the drawing turns to blocks. */
const PEAK_PX = 3;
/** What the GPU can draw of a clip's source: its waveform, and its spectrogram. */
interface SourceDrawable {
  spectrogram: boolean;
  waveform: boolean;
}

/**
 * What the GPU can draw of a clip's source: samples held in memory, or
 * streamed from a file with their leaves (the waveform) or their spectra (the
 * spectrogram). A reversed clip reads backwards, which the renderers have no
 * range for, and is drawn as the canvas' waveform, as it is without WebGL 2.
 */
function useSourceCan(
  samples: ClipSamples | undefined,
  reversed: boolean
): SourceDrawable {
  const [webgl] = useState(hasWebGL2);
  return useMemo(() => {
    const inMemory = samples ? !(samples.read(0, 0) instanceof Promise) : false;
    const gpu = webgl && !reversed && Boolean(samples);
    return {
      spectrogram: gpu && (inMemory || Boolean(samples?.spectra)),
      waveform: gpu && (inMemory || Boolean(samples?.leaves)),
    };
  }, [reversed, samples, webgl]);
}

/**
 * What the GPU draws of a clip's source, and how: samples held in memory, or
 * streamed from a file with their leaves (the waveform) or their spectra (the
 * spectrogram), which it draws without reading them whole, read in the
 * stretches the clip's warp makes. A reversed clip reads backwards, which the
 * renderers have no range for, and is the canvas' waveform, as it is without
 * WebGL 2. `gpuClips` is null where the canvas draws it.
 */
function useSourceDrawing({
  bands,
  can,
  channels,
  reading,
  samples,
  sourceLength,
  span,
  view,
}: {
  bands?: () => WaveformBands;
  can: SourceDrawable;
  channels?: readonly ClipSamples[];
  reading: ClipReading;
  samples?: ClipSamples;
  sourceLength: number;
  span: number;
  view: SoundView;
}) {
  const spectrogram = isSpectrogramView(view) && can.spectrogram;
  const loudest = useLoudest(
    can.waveform && !spectrogram ? samples : undefined,
    channels
  );
  const gpuClips = useMemo(
    () =>
      samples && (spectrogram || loudest !== null) && sourceLength > 0
        ? [
            {
              bands,
              channels,
              gain: 1,
              id: "source",
              length: span,
              peak: loudest ?? 1,
              sampleRate: samples.frames / sourceLength,
              samples,
              segments: (from: number, to: number) =>
                clipSegments(reading, samples.frames, [from, to]),
              source: "source",
              start: 0,
            },
          ]
        : null,
    [
      bands,
      channels,
      loudest,
      reading,
      samples,
      sourceLength,
      span,
      spectrogram,
    ]
  );
  return { gpuClips, spectrogram };
}

/**
 * The views of the source, as a menu in the clip's strip, after its name, as
 * the audio editor's View menu: the waveform, by band when the host gives the
 * bands, and the spectrogram on each frequency axis when the GPU can draw it.
 */
function SourceViewMenu({
  bands,
  onViewChange,
  spectrogram,
  view,
}: {
  bands: boolean;
  onViewChange: (view: SoundView) => void;
  spectrogram: boolean;
  view: SoundView;
}) {
  const change = useCallback(
    (value: string) => {
      if (isSoundView(value)) {
        onViewChange(value);
      }
    },
    [onViewChange]
  );
  const label =
    SOUND_VIEWS.find((each) => each.value === view)?.label ?? "Waveform";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`View: ${label}`}
            size="icon-sm"
            title="View"
            variant="ghost"
          />
        }
      >
        <WaveformIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuRadioGroup onValueChange={change} value={view}>
          {SOUND_VIEWS.map((each) => (
            <DropdownMenuRadioItem
              closeOnClick
              disabled={
                (each.value === "bands" && !bands) ||
                (isSpectrogramView(each.value) && !spectrogram)
              }
              key={each.value}
              value={each.value}
            >
              {each.label}
              <span className="ms-auto text-muted-foreground text-xs">
                {each.note}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** How far apart two samples are drawn at the closest zoom, in px, with samples to draw. */
const FRAME_PX = 40;
/** The widest the source's lane is laid out, in px: past about 17 million, a browser stops laying an element out. */
const MOST_LANE_PX = 16_000_000;
/** The range over the waveform: its handles, with what it leaves out dimmed below. */
const PLAYED_RANGE = "bg-transparent hover:bg-primary/10";

/** A stretch of the source the clip doesn't play, dimmed over the waveform. */
function Unplayed({
  from,
  span,
  to,
}: {
  from: number;
  span: number;
  to: number;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 bg-background/60"
      data-slot="clip-panel-unplayed"
      style={{
        left: `${(from / span) * 100}%`,
        width: `${((to - from) / span) * 100}%`,
      }}
    />
  );
}

/** The ruler's labels at `pxPerSecond`: each beat (`bar.beat`) once they are far enough apart, else every bar, every second, fourth… */
/** What the ruler numbers at a zoom: every beat (0), or every `n` bars, `n` a power of two, so the numbers stay `LABEL_SPACING` apart. */
function labelEvery(bar: number, beatsPerBar: number, pxPerSecond: number) {
  if ((bar / beatsPerBar) * pxPerSecond >= LABEL_SPACING) {
    return 0;
  }
  let every = 1;
  while (every * bar * pxPerSecond < LABEL_SPACING && every < 1024) {
    every *= 2;
  }
  return every;
}

/** The ruler's numbers over the source: each beat's (`every` 0), or every `every` bars'. */
function rulerLabels(
  span: number,
  bar: number,
  beatsPerBar: number,
  every: number
) {
  const beat = bar / beatsPerBar;
  if (every === 0) {
    return Array.from({ length: Math.floor(span / beat) + 1 }, (_, index) => {
      const number = Math.floor(index / beatsPerBar) + 1;
      const inBar = (index % beatsPerBar) + 1;
      return {
        at: index * beat,
        text: inBar === 1 ? `${number}` : `${number}.${inBar}`,
      };
    });
  }
  return Array.from(
    { length: Math.floor(span / (bar * every)) + 1 },
    (_, index) => ({ at: index * every * bar, text: `${index * every + 1}` })
  );
}

/** The ruler's numbers, drawn again only when they change: a zoom moves them by itself, so its steps leave them be. */
/**
 * The stretch of the source the view shows, in seconds, with a view's width
 * either side: what the ruler numbers, so a long source zoomed in lays out a
 * few dozen numbers, not thousands. It moves by half a view at a time, so a
 * scroll draws the numbers again only now and then.
 */
function useShownSpan(
  viewportRef: RefObject<HTMLElement | null>,
  pxPerSecond: number,
  span: number
): readonly [number, number] {
  const [shown, setShown] = useState<readonly [number, number]>([0, span]);
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!(viewport && pxPerSecond > 0)) {
      return;
    }
    const measure = () => {
      const view = viewport.clientWidth / pxPerSecond;
      const half = Math.max(view / 2, 1e-6);
      const from = Math.floor(viewport.scrollLeft / pxPerSecond / half) * half;
      setShown((was) => {
        const next = [Math.max(0, from - view), from + 2 * view] as const;
        return was[0] === next[0] && was[1] === next[1] ? was : next;
      });
    };
    measure();
    viewport.addEventListener("scroll", measure, { passive: true });
    return () => viewport.removeEventListener("scroll", measure);
  }, [pxPerSecond, viewportRef]);
  return shown;
}

const RulerMarks = memo(
  ({ labels }: { labels: readonly { at: number; text: string }[] }) =>
    labels.map((label) => (
      <TimelineMark key={label.at} value={label.at}>
        {label.text}
      </TimelineMark>
    ))
);

/**
 * The clip's source on a timeline of its own: an overview bar to zoom and
 * scroll with, a ruler in bars, the stretch the clip plays (or its loop) to
 * drag at both ends, and the waveform, warped markers included, under it.
 */
function ClipSource({
  bands,
  bar,
  beatsPerBar,
  can,
  channels,
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
  playhead,
  playing,
  reversed,
  samples,
  sourceLength,
  span,
  values,
  view,
  warp,
}: {
  bands?: () => WaveformBands;
  bar: number;
  beatsPerBar: number;
  /** What the GPU can draw of the source. */
  can: SourceDrawable;
  channels?: readonly ClipSamples[];
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
  playhead?: Source<number>;
  /** Whether the clip plays now: its playhead shows. */
  playing: boolean;
  reversed: boolean;
  samples?: ClipSamples;
  sourceLength: number;
  span: number;
  values: ClipPeaks;
  view: SoundView;
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
    // Measured again on the next frame, outside the layout pass that resized it.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [span]);
  const pxPerSecond = zoom ?? fit;
  const [shownFrom, shownTo] = useShownSpan(viewportRef, pxPerSecond, span);
  // The whole source in the clip's time, read as the clip plays it.
  const reading = useMemo(
    () => ({
      reversed,
      sourceLength,
      value: { length: span, offset: 0 },
      warp: warp ?? undefined,
    }),
    [reversed, sourceLength, span, warp]
  );
  const { gpuClips, spectrogram } = useSourceDrawing({
    bands,
    can,
    channels,
    reading,
    samples,
    sourceLength,
    span,
    view,
  });
  const [playedFrom, playedTo] = loop
    ? [Math.min(offset, loop[0]), loop[1]]
    : [offset, Math.min(span, offset + length)];
  const every = labelEvery(bar, beatsPerBar, pxPerSecond);
  const labels = useMemo(
    () => rulerLabels(span, bar, beatsPerBar, every),
    [bar, beatsPerBar, every, span]
  );
  const shownLabels = useMemo(
    () =>
      labels.filter((label) => label.at >= shownFrom && label.at <= shownTo),
    [labels, shownFrom, shownTo]
  );
  // Zoomed in, a line per beat; out, a line per bar.
  const beat = bar / beatsPerBar;
  const gridStep = beat * pxPerSecond >= LABEL_SPACING / 2 ? beat : bar;
  // As far in as the waveform has detail for: the peaks', or with the samples, a few px per frame, as wide as a lane can be laid out.
  const maxZoom = Math.max(
    fit,
    samples
      ? Math.min(samples.frames * FRAME_PX, MOST_LANE_PX) / span
      : (clipPeakCount(values) * PEAK_PX) / span
  );
  return (
    <Timeline
      className="min-w-0 flex-1"
      duration={span}
      maxZoom={maxZoom || undefined}
      minZoom={fit || undefined}
      onZoomChange={setZoom}
      source={playhead}
      zoom={zoom ?? undefined}
    >
      <TimelineNavigator className="rounded-none" getAriaValueText={format} />
      {/* Flush in the clip view, which is the frame: no border or corners of its own. */}
      <TimelineViewport
        className="flex min-w-0 flex-1 flex-col border-t bg-muted/40"
        ref={viewportRef}
        scrollbar="hidden"
      >
        <div className="flex w-max min-w-full flex-1 flex-col">
          {/* Bar numbers, from the start of the source. */}
          <TimelineLane className="h-5 border-foreground/25 border-b text-muted-foreground text-xs">
            <RulerMarks labels={shownLabels} />
          </TimelineLane>
          {/* What the clip plays, or the stretch it loops, with its start as a marker. */}
          <TimelineLane className="h-6 border-foreground/25 border-b">
            {loop ? (
              <>
                <TimelineRange
                  aria-label="Loop"
                  className={PLAYED_RANGE}
                  getAriaValueText={format}
                  onValueChange={onLoopChange}
                  onValueCommitted={onValueCommitted}
                  value={loop}
                >
                  <TimelineRangeHandle aria-label="Loop start" edge="start" />
                  <TimelineRangeHandle aria-label="Loop end" edge="end" />
                </TimelineRange>
                <TimelineMark className="border-s-0 ps-0" value={offset}>
                  <span className="border-foreground border-s-2 ps-1 text-xs">
                    Start
                  </span>
                </TimelineMark>
              </>
            ) : (
              <TimelineRange
                aria-label="Played"
                className={PLAYED_RANGE}
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
          <div
            className="relative flex flex-1 flex-col"
            onDoubleClick={onAddMarker}
          >
            {/* At least its own height, and as tall as the panel lets it. */}
            <TimelineLane
              className="h-auto min-h-28 flex-1 border-b-0"
              gridStep={gridStep}
            >
              <div
                className="absolute inset-y-0 left-0"
                data-slot="clip-panel-source"
                style={{ width: `calc(var(--timeline-unit) * ${span})` }}
              >
                {gpuClips ? (
                  <SoundLane
                    aria-label={`${name} source`}
                    className={cn(
                      "h-full",
                      spectrogram ? "text-foreground" : "text-muted-foreground"
                    )}
                    clips={gpuClips}
                    role="img"
                    view={view}
                    zoom={pxPerSecond}
                  />
                ) : null}
                {!gpuClips && clipPeakCount(values) > 0 ? (
                  <ClipWaveform
                    aria-label={`${name} source`}
                    className="inset-y-0 h-full text-muted-foreground"
                    clip={reading}
                    peaks={values}
                    role="img"
                    samples={samples}
                  />
                ) : null}
                <Unplayed from={0} span={span} to={playedFrom} />
                <Unplayed from={playedTo} span={span} to={span} />
                {warp ? (
                  <WarpMarkers
                    format={format}
                    markers={warp}
                    onChange={onWarpChange}
                    onCommit={onValueCommitted}
                    span={span}
                    tight={warpMarkersTight(warp.length, span, pxPerSecond)}
                  />
                ) : null}
              </div>
              {playing ? <TimelinePlayhead /> : null}
            </TimelineLane>
          </div>
        </div>
      </TimelineViewport>
    </Timeline>
  );
}

export { ClipPanel };
