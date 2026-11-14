import type { WarpMode } from "@audio-ui/engine/playback";
import {
  addWarpMarker,
  moveWarpMarker,
  removeWarpMarker,
  scaleWarp,
  unwarpedTime,
  type WarpMarker,
  warpedTime,
  warpRate,
} from "@audio-ui/engine/time";
import { hasWebGL2 } from "@audio-ui/gl/lane";
import type { WaveformBands } from "@audio-ui/gl/waveform";
import type { Source } from "@audio-ui/react";
import {
  MagicWandIcon,
  ScissorsIcon,
  WaveformIcon,
} from "@phosphor-icons/react";
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
import { ProcessMenuItems } from "@/components/audio-ui/process-menu";
import {
  isSoundView,
  isSpectrogramView,
  SOUND_VIEWS,
  SoundLane,
  type SoundView,
} from "@/components/audio-ui/sound-lane";
import { TimelineTimeSelection } from "@/components/audio-ui/time-selection";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLoudest } from "@/hooks/use-loudest";
import {
  type ClipPeaks,
  type ClipReading,
  clipPeakCount,
  clipSegments,
} from "@/lib/arrangement";
import {
  type SoundOperation,
  type SoundRange,
  soundOperationTiming,
} from "@/lib/sound-operations";
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

/**
 * The settings of a clip whose warp is turned off, as the Warp button does:
 * the source plays as recorded, as far as it goes, and the loop, whose times
 * were the clip's, is gone.
 */
export function unwarpedSettings(
  settings: ClipSettings
): Partial<ClipSettings> {
  const { length, offset, sourceLength } = settings;
  return {
    length: Math.min(length, sourceLength - Math.min(offset, sourceLength)),
    loop: null,
    offset: Math.min(offset, sourceLength),
    warp: null,
  };
}

/** How near two times have to be to be one, in seconds: a clip that ended where a stretch did still does. */
const END_EPS = 1e-4;

/** The settings of a warped clip as its source plays them as recorded: its times read back through the warp, and the warp gone. */
function recordedSettings(settings: ClipSettings): ClipSettings {
  const { length, loop, offset, warp } = settings;
  if (!warp) {
    return settings;
  }
  const at = (time: number) => unwarpedTime(warp, time);
  const recordedLoop = loop ? ([at(loop[0]), at(loop[1])] as const) : null;
  return {
    ...settings,
    length:
      loop && recordedLoop
        ? (length * (recordedLoop[1] - recordedLoop[0])) /
          Math.max(loop[1] - loop[0], END_EPS)
        : at(offset + length) - at(offset),
    loop: recordedLoop,
    offset: at(offset),
    warp: null,
  };
}

/**
 * Where a time of a source lies once its stretch `range` is made `length`
 * long: before it, where it was; after it, moved by as much as it grew or
 * shrank, a time at its end too; inside it, scaled with a stretch or a change
 * of speed, else where it was, as far as what was made goes. Cropped, the
 * stretch is all there is.
 */
function movedTime(
  time: number,
  [from, to]: SoundRange,
  length: number,
  timing: ReturnType<typeof soundOperationTiming>
): number {
  if (timing === "cropped") {
    return Math.min(Math.max(time - from, 0), to - from);
  }
  if (time <= from) {
    return time;
  }
  if (time >= to - END_EPS) {
    return time + length - (to - from);
  }
  return timing === "scaled"
    ? from + ((time - from) * length) / (to - from)
    : Math.min(time, from + length);
}

/** A clip played forwards, its times moved as `movedTime` moves them, over a source now `sourceLength` long. */
function movedSettings(
  settings: ClipSettings,
  range: SoundRange,
  length: number,
  timing: ReturnType<typeof soundOperationTiming>,
  sourceLength: number
): ClipSettings {
  const move = (time: number) =>
    Math.min(Math.max(movedTime(time, range, length, timing), 0), sourceLength);
  const offset = move(settings.offset);
  const { loop } = settings;
  if (loop) {
    const moved = [move(loop[0]), move(loop[1])] as const;
    if (moved[1] - moved[0] > END_EPS) {
      // Scaled, the loop plays as many times over as it did; else the clip lasts as long.
      const scale =
        timing === "scaled" ? (moved[1] - moved[0]) / (loop[1] - loop[0]) : 1;
      return {
        ...settings,
        length: settings.length * scale,
        loop: moved,
        offset,
        sourceLength,
      };
    }
  }
  const end = move(settings.offset + (loop ? 0 : settings.length));
  return {
    ...settings,
    // What it played is gone: it plays on from there, as long as it did.
    length:
      end - offset > END_EPS
        ? end - offset
        : Math.min(settings.length, sourceLength - offset),
    loop: null,
    offset,
    sourceLength,
  };
}

/**
 * The settings of a clip once an operation made its source `sourceLength`
 * long, on `range` of it (in the source's own time, played forwards) or on
 * all of it. What the clip played follows the sound: before the stretch, it
 * stays; after it, it moves by as much as the stretch grew or shrank, so a
 * clip or a loop that reached its end still does; inside it, it scales with a
 * stretch or a change of speed. An operation that changes the length turns
 * the warp off first, its times read back as recorded.
 */
export function processedSettings(
  settings: ClipSettings,
  operation: SoundOperation,
  sourceLength: number,
  range: SoundRange = [0, settings.sourceLength]
): ClipSettings {
  if (Math.abs(sourceLength - settings.sourceLength) <= END_EPS) {
    return { ...settings, sourceLength };
  }
  const timing = soundOperationTiming(operation);
  const was = recordedSettings(settings);
  const length =
    timing === "cropped"
      ? sourceLength
      : sourceLength - (was.sourceLength - (range[1] - range[0]));
  if (!was.reversed) {
    return movedSettings(was, range, length, timing, sourceLength);
  }
  // Reversed, it plays the source from its end: moved forwards, then reversed again.
  const forward = movedSettings(
    { ...was, ...reversedSettings(was) },
    range,
    length,
    timing,
    sourceLength
  );
  return { ...forward, ...reversedSettings(forward) };
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
  /** Whether something was copied to paste. */
  canPaste?: boolean;
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
  /** Copy was picked, or Cut: keep the stretch `range` of the source (in its own time, played forwards) to paste. Leave it out for a panel without Copy and Cut. */
  onCopy?: (range: SoundRange) => void;
  /** Crop was pressed: cut the source down to what the clip plays. Leave it out for a panel without it. */
  onCrop?: () => void;
  /** Which boxes are folded was changed. */
  onFoldedBoxesChange?: (folded: string[]) => void;
  /** Paste was picked: put what was copied in place of `range`, or at its start when it is a point, with `applySoundOperation`. */
  onPaste?: (range: SoundRange) => void;
  /** An edit or an operation of the Process menu was picked: run it on `range` of the clip's source (in its own time, played forwards), or on all of it when `range` is null, with `applySoundOperation`, then set what `processedSettings` gives. Leave it out for a panel that does not edit its source. */
  onProcess?: (operation: SoundOperation, range: SoundRange | null) => void;
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
  /** The recording's sample rate, in hertz, when `samples` reads a recording the source is cut from (`sourceFrom`). @default the frames of `samples` over `sourceLength` */
  sampleRate?: number;
  /** The source's samples, read as the view needs them: with them, the waveform zooms in to the samples themselves, as a line through them past a frame per pixel, and is drawn on the GPU when they are held in memory or, streamed from a file, give their `leaves`. Leave it out to stop at the peaks' detail. */
  samples?: ClipSamples;
  /** Where the source begins in the recording `samples` reads, in seconds, once the clip was cropped: the panel reads it from there. @default 0 */
  sourceFrom?: number;
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
  canPaste = false,
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
  onCopy,
  onPaste,
  onProcess,
  onRename,
  onValueChange,
  onValueCommitted,
  onViewChange,
  position: arrangementPosition,
  sampleRate,
  samples,
  sourceFrom = 0,
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
  // Where the source lies in the recording the samples read, and at what rate.
  const sourceStretch = useMemo(
    () => ({
      from: sourceFrom,
      rate: sampleRate ?? (samples ? samples.frames / sourceLength : 0),
    }),
    [sampleRate, samples, sourceFrom, sourceLength]
  );
  const shownView: SoundView =
    isSpectrogramView(view) && !can.spectrogram ? "wave" : view;
  const meter = useMemo(() => ({ bar, beatsPerBar }), [bar, beatsPerBar]);
  // What is picked on the source, as long as the source keeps its length: an edit that changes it lets go.
  const [picked, setPicked] = useState<{
    at: SourcePick;
    sourceLength: number;
  } | null>(null);
  const pick = picked?.sourceLength === sourceLength ? picked.at : null;
  const setPick = useCallback(
    (at: SourcePick | null) => setPicked(at ? { at, sourceLength } : null),
    [sourceLength]
  );
  const range = useMemo(
    () => (pick ? sourceRange(pick, { reversed, sourceLength, warp }) : null),
    [pick, reversed, sourceLength, warp]
  );
  // How long the source lasts on the clip: as recorded, or as its warp stretches it.
  const span = warp ? warpedTime(warp, sourceLength) : sourceLength;
  const edits = useSourceEdits({
    canPaste,
    onCopy,
    onPaste,
    onProcess,
    pick,
    range,
    setPick,
    span,
  });
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
          ? unwarpedSettings(value)
          : {
              warp: [
                { source: 0, target: 0 },
                { source: sourceLength, target: sourceLength },
              ],
              // A clip warped for the first time keeps its pitch.
              warpMode: value.warpMode ?? "beats",
            }
      ),
    [setAndCommit, sourceLength, value, warp]
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
    >
      <SourceBar
        bands={Boolean(bands) && can.waveform}
        edits={onProcess ? edits : null}
        format={format}
        onViewChange={changeView}
        range={range}
        samples={Boolean(samples)}
        spectrogram={can.spectrogram}
        view={shownView}
      />
      <ClipSource
        bands={bands}
        bar={bar}
        beatsPerBar={beatsPerBar}
        can={can}
        channels={channels}
        edits={onProcess ? edits : null}
        format={format}
        length={length}
        loop={loop}
        name={name}
        offset={offset}
        onAddMarker={addMarker}
        onLoopChange={setLoop}
        onPick={setPick}
        onPlayedChange={setPlayed}
        onValueCommitted={onValueCommitted}
        onWarpChange={setWarp}
        pick={pick}
        playhead={playhead}
        playing={playing}
        reversed={reversed}
        samples={samples}
        sourceLength={sourceLength}
        span={span}
        stretch={sourceStretch}
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
/** Where a clip's source begins in the recording its samples read, in seconds, and the recording's rate. */
interface SourceStretch {
  from: number;
  rate: number;
}

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
  stretch,
  view,
}: {
  bands?: () => WaveformBands;
  can: SourceDrawable;
  channels?: readonly ClipSamples[];
  reading: ClipReading;
  samples?: ClipSamples;
  sourceLength: number;
  span: number;
  stretch: SourceStretch;
  view: SoundView;
}) {
  const spectrogram = isSpectrogramView(view) && can.spectrogram;
  const loudest = useLoudest(
    can.waveform && !spectrogram ? samples : undefined,
    channels
  );
  const gpuClips = useMemo(
    () =>
      samples &&
      (spectrogram || loudest !== null) &&
      sourceLength > 0 &&
      stretch.rate > 0
        ? [
            {
              bands,
              channels,
              gain: 1,
              id: "source",
              length: span,
              peak: loudest ?? 1,
              sampleRate: stretch.rate,
              samples,
              // The source's stretches, read from where it begins in the recording.
              segments: (from: number, to: number) =>
                clipSegments(reading, Math.round(sourceLength * stretch.rate), [
                  from,
                  to,
                ]).map((segment) => ({
                  ...segment,
                  frames: [
                    segment.frames[0] + stretch.from * stretch.rate,
                    segment.frames[1] + stretch.from * stretch.rate,
                  ] as [number, number],
                })),
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
      stretch,
    ]
  );
  return { gpuClips, spectrogram };
}

/** What is picked on the source, in the clip's time as the view draws it, from and to: a stretch, or the point the caret is at when both meet. */
type SourcePick = readonly [number, number];

/** A pick in the source's own time, played forwards: what an edit acts on. */
function sourceRange(
  pick: SourcePick,
  {
    reversed,
    sourceLength,
    warp,
  }: {
    reversed: boolean;
    sourceLength: number;
    warp: readonly WarpMarker[] | null;
  }
): SoundRange {
  const at = (time: number) => {
    const played = warp ? unwarpedTime(warp, time) : time;
    return Math.min(
      Math.max(reversed ? sourceLength - played : played, 0),
      sourceLength
    );
  };
  const [from, to] = [at(pick[0]), at(pick[1])];
  return from <= to ? [from, to] : [to, from];
}

/** How far Louder and Quieter move the level, in dB, as the audio editor's do. */
const LEVEL_STEP = 3;
const DELETE: SoundOperation = { type: "delete" };
const CROP: SoundOperation = { type: "crop" };
const LOUDER: SoundOperation = { db: LEVEL_STEP, type: "gain" };
const QUIETER: SoundOperation = { db: -LEVEL_STEP, type: "gain" };

/** What the bar says of the pick: the stretch's length, the caret's time, or how to pick. */
function pickReadout(
  range: SoundRange | null,
  selected: boolean,
  format: (seconds: number) => string,
  editable: boolean
) {
  if (range && selected) {
    return `Selection ${format(range[1] - range[0])}`;
  }
  if (range) {
    return `At ${format(range[0])}`;
  }
  return editable ? "Drag on the sound to select, right-click to edit" : null;
}

/**
 * The edits of the source on what is picked, as an audio editor makes them:
 * Cut, Copy, Paste, Delete and Crop on the stretch selected, Louder, Quieter
 * and the Process menu's operations on it, or on all of the source with none.
 * Each goes to the host; `handleKey` is the keyboard of all of them.
 */
function useSourceEdits({
  canPaste,
  onCopy,
  onPaste,
  onProcess,
  pick,
  range,
  setPick,
  span,
}: {
  canPaste: boolean;
  onCopy?: (range: SoundRange) => void;
  onPaste?: (range: SoundRange) => void;
  onProcess?: (operation: SoundOperation, range: SoundRange | null) => void;
  pick: SourcePick | null;
  range: SoundRange | null;
  setPick: (pick: SourcePick | null) => void;
  span: number;
}) {
  return useMemo(() => {
    const selected = pick !== null && pick[1] > pick[0];
    const stretch = selected ? range : null;
    const process = (operation: SoundOperation) =>
      onProcess?.(operation, stretch);
    const copy = () => {
      if (stretch) {
        onCopy?.(stretch);
      }
    };
    const onStretch = (operation: SoundOperation) => () => {
      if (stretch) {
        onProcess?.(operation, stretch);
      }
    };
    const cut = () => {
      if (stretch && onCopy) {
        onCopy(stretch);
        onProcess?.(DELETE, stretch);
      }
    };
    const paste = () => {
      if (canPaste && range) {
        onPaste?.(range);
      }
    };
    const remove = onStretch(DELETE);
    const crop = onStretch(CROP);
    const louder = () => process(LOUDER);
    const quieter = () => process(QUIETER);
    const selectAll = () => setPick([0, span]);
    const clear = () => setPick(null);
    /** Runs the edit a key stands for, and says whether one did. */
    const handleKey = (event: KeyboardEvent<HTMLElement>) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const run = mod
        ? { a: selectAll, c: copy, v: paste, x: cut }[key]
        : {
            arrowdown: event.shiftKey ? quieter : undefined,
            arrowup: event.shiftKey ? louder : undefined,
            backspace: remove,
            delete: remove,
            escape: clear,
            k: crop,
          }[key];
      if (!run) {
        return false;
      }
      run();
      return true;
    };
    return {
      canPaste,
      clear,
      copy,
      crop,
      cut,
      handleKey,
      louder,
      paste,
      picked: pick !== null,
      process,
      quieter,
      remove,
      selectAll,
      selected,
    };
  }, [canPaste, onCopy, onPaste, onProcess, pick, range, setPick, span]);
}

type SourceEdits = ReturnType<typeof useSourceEdits>;

const APPLE = /Mac|iPhone|iPad/;

/** The edits of the source as menu items, each with its key: the bar's Edit menu and the menu a right-click opens. It renders only while open, so it reads the system then. */
function SourceEditItems({ edits }: { edits: SourceEdits }) {
  const mod = APPLE.test(navigator.userAgent) ? "⌘" : "Ctrl+";
  const none = !edits.selected;
  return (
    <>
      <DropdownMenuItem disabled={none} onClick={edits.cut}>
        Cut
        <DropdownMenuShortcut>{mod}X</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={none} onClick={edits.copy}>
        Copy
        <DropdownMenuShortcut>{mod}C</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!(edits.canPaste && edits.picked)}
        onClick={edits.paste}
      >
        Paste
        <DropdownMenuShortcut>{mod}V</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={none} onClick={edits.remove}>
        Delete
        <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem disabled={none} onClick={edits.crop}>
        Crop
        <DropdownMenuShortcut>K</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={edits.louder}>
        Louder
        <DropdownMenuShortcut>⇧↑</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={edits.quieter}>
        Quieter
        <DropdownMenuShortcut>⇧↓</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={edits.selectAll}>
        Select all
        <DropdownMenuShortcut>{mod}A</DropdownMenuShortcut>
      </DropdownMenuItem>
    </>
  );
}

/** The bar's Edit menu. */
function SourceEditMenu({ edits }: { edits: SourceEdits }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="sm" title="Edit" variant="ghost" />}
      >
        <ScissorsIcon />
        Edit
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <SourceEditItems edits={edits} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The bar's Process menu, the audio editor's: on the stretch selected, or on
 * all of the source with none.
 */
function SourceProcessMenu({
  onProcess,
  selected,
}: {
  onProcess: (operation: SoundOperation) => void;
  selected: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            title={selected ? "Process the selection" : "Process the sound"}
            variant="ghost"
          />
        }
      >
        <MagicWandIcon />
        Process
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <ProcessMenuItems onProcess={onProcess} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The views of the source, as the bar's View menu, the audio editor's: the
 * waveform, by band when the host gives the bands, and the spectrogram on
 * each frequency axis when the GPU can draw it.
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
            size="sm"
            title="View"
            variant="ghost"
          />
        }
      >
        <WaveformIcon />
        View
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

/** The menu a right-click on the sound opens: its edits, then the Process menu. */
function SourceContextItems({ edits }: { edits: SourceEdits }) {
  return (
    <>
      <SourceEditItems edits={edits} />
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Process</DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-64">
          <ProcessMenuItems onProcess={edits.process} />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
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
 * The source's own bar, as an audio editor's: its edits and the Process menu
 * where the host edits the source, how it is drawn, and what is picked.
 */
function SourceBar({
  bands,
  edits,
  format,
  onViewChange,
  range,
  samples,
  spectrogram,
  view,
}: {
  bands: boolean;
  edits: SourceEdits | null;
  format: (seconds: number) => string;
  onViewChange: (view: SoundView) => void;
  range: SoundRange | null;
  samples: boolean;
  spectrogram: boolean;
  view: SoundView;
}) {
  if (!(edits || samples)) {
    return null;
  }
  return (
    <div
      className="flex h-9 shrink-0 items-center gap-0.5 border-b px-1"
      data-slot="clip-panel-toolbar"
    >
      {edits ? <SourceEditMenu edits={edits} /> : null}
      {edits ? (
        <SourceProcessMenu
          onProcess={edits.process}
          selected={edits.selected}
        />
      ) : null}
      {samples ? (
        <SourceViewMenu
          bands={bands}
          onViewChange={onViewChange}
          spectrogram={spectrogram}
          view={view}
        />
      ) : null}
      <span
        className="ms-auto truncate px-1.5 text-muted-foreground text-xs tabular-nums"
        data-slot="clip-panel-pick"
      >
        {pickReadout(range, edits?.selected ?? false, format, Boolean(edits))}
      </span>
    </div>
  );
}

/** What is picked, over the sound: the stretch selected, or the caret. */
function PickMark({ pick }: { pick: SourcePick | null }) {
  if (!pick) {
    return null;
  }
  if (pick[1] > pick[0]) {
    return <TimelineTimeSelection range={pick} />;
  }
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/70"
      data-slot="clip-panel-caret"
      style={{ left: `calc(var(--timeline-unit) * ${pick[0]})` }}
    />
  );
}

/** How far a press has to move, in px, to select a stretch rather than put the caret down. */
const PICK_SLOP = 3;

/**
 * The sound of the source as an audio editor's: a drag on it selects a
 * stretch, a press puts the caret down (Shift extends what is selected), a
 * right-click opens its edits and the Process menu, and its keys run them
 * while it has the focus. Warped, a double-click adds a marker; else it
 * selects all of it.
 */
function SourceEditor({
  children,
  edits,
  name,
  onAddMarker,
  onPick,
  pick,
  span,
  warped,
}: {
  children: ReactNode;
  edits: SourceEdits | null;
  name: string;
  onAddMarker: (event: MouseEvent<HTMLDivElement>) => void;
  onPick: (pick: SourcePick | null) => void;
  pick: SourcePick | null;
  span: number;
  warped: boolean;
}) {
  const drag = useRef<{ anchor: number; x: number } | null>(null);
  /** The time under the pointer, in the clip's time, or null off the sound. */
  const timeAt = useCallback(
    (clientX: number, element: HTMLElement) => {
      const box = element
        .querySelector('[data-slot="clip-panel-source"]')
        ?.getBoundingClientRect();
      if (!box || box.width <= 0) {
        return null;
      }
      return Math.min(
        Math.max(((clientX - box.left) / box.width) * span, 0),
        span
      );
    },
    [span]
  );
  const press = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (
        event.button !== 0 ||
        target.closest('[data-slot="clip-panel-warp-marker"]')
      ) {
        return;
      }
      const at = timeAt(event.clientX, event.currentTarget);
      if (at === null) {
        return;
      }
      // Shift keeps the far end of what is selected and moves the other.
      const far =
        pick && Math.abs(at - pick[0]) > Math.abs(at - pick[1])
          ? pick[0]
          : pick?.[1];
      const anchor = event.shiftKey && far !== undefined ? far : at;
      drag.current = { anchor, x: event.clientX };
      event.currentTarget.setPointerCapture(event.pointerId);
      onPick(anchor <= at ? [anchor, at] : [at, anchor]);
    },
    [onPick, pick, timeAt]
  );
  const move = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const held = drag.current;
      if (!held || Math.abs(event.clientX - held.x) < PICK_SLOP) {
        return;
      }
      const at = timeAt(event.clientX, event.currentTarget);
      if (at !== null) {
        onPick(held.anchor <= at ? [held.anchor, at] : [at, held.anchor]);
      }
    },
    [onPick, timeAt]
  );
  const release = useCallback(() => {
    drag.current = null;
  }, []);
  // A right-click outside what is selected puts the caret there first.
  const contextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const at = timeAt(event.clientX, event.currentTarget);
      if (at !== null && !(pick && at >= pick[0] && at <= pick[1])) {
        onPick([at, at]);
      }
    },
    [onPick, pick, timeAt]
  );
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && edits?.handleKey(event)) {
        event.preventDefault();
      }
    },
    [edits]
  );
  if (!edits) {
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; the markers' own keys and the Warp switch cover the keyboard
      <div
        className="relative flex flex-1 flex-col"
        onDoubleClick={onAddMarker}
      >
        {children}
      </div>
    );
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger
        aria-label={`${name}: drag to select, right-click to edit`}
        className="relative flex flex-1 select-none flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        data-slot="clip-panel-edit"
        onContextMenu={contextMenu}
        onDoubleClick={warped ? onAddMarker : edits.selectAll}
        onKeyDown={keyDown}
        onLostPointerCapture={release}
        onPointerDown={press}
        onPointerMove={move}
        onPointerUp={release}
        role="application"
        tabIndex={0}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <SourceContextItems edits={edits} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

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
  edits,
  format,
  length,
  loop,
  name,
  offset,
  onAddMarker,
  onLoopChange,
  onPick,
  onPlayedChange,
  onValueCommitted,
  onWarpChange,
  pick,
  playhead,
  playing,
  reversed,
  samples,
  sourceLength,
  span,
  stretch,
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
  /** The edits of the source, or null where the host does not edit it: no pick, no menu. */
  edits: SourceEdits | null;
  format: (seconds: number) => string;
  length: number;
  loop: readonly [number, number] | null;
  name: string;
  offset: number;
  onAddMarker: (event: MouseEvent<HTMLDivElement>) => void;
  onLoopChange: (next: readonly [number, number]) => void;
  onPick: (pick: SourcePick | null) => void;
  onPlayedChange: (next: readonly [number, number]) => void;
  onValueCommitted?: () => void;
  onWarpChange: (next: readonly WarpMarker[]) => void;
  pick: SourcePick | null;
  playhead?: Source<number>;
  /** Whether the clip plays now: its playhead shows. */
  playing: boolean;
  reversed: boolean;
  samples?: ClipSamples;
  sourceLength: number;
  span: number;
  /** Where the source begins in the recording the samples read, in seconds, and their rate. */
  stretch: SourceStretch;
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
    stretch,
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
          <SourceEditor
            edits={edits}
            name={name}
            onAddMarker={onAddMarker}
            onPick={onPick}
            pick={pick}
            span={span}
            warped={warp !== null}
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
              <PickMark pick={pick} />
              {playing ? <TimelinePlayhead /> : null}
            </TimelineLane>
          </SourceEditor>
        </div>
      </TimelineViewport>
    </Timeline>
  );
}

export { ClipPanel };
