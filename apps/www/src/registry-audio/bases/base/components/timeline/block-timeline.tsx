"use client";

import { computePeaks, normalizePeaks } from "@audio-ui/core/analysis";
import {
  barsBeatsWith,
  type MetronomeRhythm,
  secondsPerBar,
  type Tempo,
} from "@audio-ui/core/time";
import { bypassesGrid } from "@audio-ui/core/timeline";
import { EnvelopeIcon } from "@audio-ui/icons/react";
import {
  type ComponentProps,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/registry/bases/base/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/registry/bases/base/ui/kbd";
import {
  ArrangedClip,
  ArrangedClipGhost,
} from "@/registry-audio/bases/base/audio/elements/arranged-clip";
import { NumberControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { TimelineTimeSelection } from "@/registry-audio/bases/base/audio/elements/time-selection";
import {
  COMPACT_TRACK_HEIGHT,
  MAX_TRACK_HEIGHT,
  MIN_TRACK_HEIGHT,
  Timeline,
  TimelineGridMenuItems,
  TimelineLane,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
  TimelineTrack,
  TimelineTrackControls,
  TimelineTrackHeader,
  TimelineViewport,
  TRACK_COLORS,
  TRACK_HEIGHT_STEP,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import {
  TimelineBarMarks,
  TimelineLocator,
  TimelineSignature,
} from "@/registry-audio/bases/base/audio/elements/timeline-markers";
import {
  TrackAutomation,
  TrackAutomationChooser,
} from "@/registry-audio/bases/base/audio/elements/track-automation";
import {
  TrackGrip,
  TrackReorderGhost,
  trackReorderClass,
} from "@/registry-audio/bases/base/audio/elements/track-grip";
import { TrackLevel } from "@/registry-audio/bases/base/audio/elements/track-level";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  ClipPanel,
  type ClipSettings,
} from "@/registry-audio/bases/base/audio/panels/clip-panel";
import {
  MidiClipPanel,
  type MidiClipRegion,
} from "@/registry-audio/bases/base/audio/panels/midi-clip-panel";
import { useArrangedClips } from "@/registry-audio/bases/base/hooks/use-arranged-clips";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import { useMarquee } from "@/registry-audio/bases/base/hooks/use-marquee-selection";
import { useTimeSelection } from "@/registry-audio/bases/base/hooks/use-time-selection";
import { useTimelineCursor } from "@/registry-audio/bases/base/hooks/use-timeline-cursor";
import {
  GRID_DIVISION_OPTIONS,
  GRID_KEYS,
  useTimelineGrid,
} from "@/registry-audio/bases/base/hooks/use-timeline-grid";
import { useTimelineMarkers } from "@/registry-audio/bases/base/hooks/use-timeline-markers";
import { useTimelineZoom } from "@/registry-audio/bases/base/hooks/use-timeline-zoom";
import { useTrackAutomation } from "@/registry-audio/bases/base/hooks/use-track-automation";
import { useTrackReorder } from "@/registry-audio/bases/base/hooks/use-track-reorder";
import type {
  Arranged,
  ArrangementTrack,
  TimeSelection,
  TrackKind,
} from "@/registry-audio/bases/base/lib/arrangement";
import { renderTrackClips } from "@/registry-audio/bases/base/lib/arrangement-engine";
import { audioClipsIn } from "@/registry-audio/bases/base/lib/arrangement-state";
import { decodeAudioChannels } from "@/registry-audio/bases/base/lib/audio-decode";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  DEMO_TEMPO,
  renderBeatLoop,
  renderHeldChord,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { pocketSynthDevice } from "@/registry-audio/bases/base/lib/pocket-synth-device";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const BARS = 32;
/** The arrangement is laid out at the first tempo, the demo sounds': a tempo change keeps its musical positions. */
const BAR = secondsPerBar(DEMO_TEMPO);
/** Whether a key went to a field you type in, where it is the field's own. */
function typing(target: EventTarget) {
  return (
    (target instanceof HTMLInputElement && target.type !== "range") ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
/** The zoom presets, as shares of the fitted view: Fit shows everything. */
const ZOOM_PRESETS = [1, 2, 4, 8];
/** The zoom's steps are loupes, not a minus and a plus. */
const ZOOM_STEPPERS = {
  decrement: "Zoom out",
  icons: {
    decrement: (
      <IconPlaceholder
        hugeicons="ZoomOutAreaIcon"
        lucide="ZoomOutIcon"
        phosphor="MagnifyingGlassMinusIcon"
        remixicon="RiZoomOutLine"
        tabler="IconZoomOut"
      />
    ),
    increment: (
      <IconPlaceholder
        hugeicons="ZoomInAreaIcon"
        lucide="ZoomInIcon"
        phosphor="MagnifyingGlassPlusIcon"
        remixicon="RiZoomInLine"
        tabler="IconZoomIn"
      />
    ),
  },
  increment: "Zoom in",
};

/** How the zoom is shown: as a share of the fitted view. */
const PERCENT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  style: "percent",
};

const bars = (count: number) => count * BAR;

/** The named points the timeline starts with. */
const LOCATORS = [
  { at: bars(4), id: "verse", name: "Verse" },
  { at: bars(20), id: "chorus", name: "Chorus" },
];

/** The loop it starts with: bars 8 to 16, switched on. */
const LOOP = { on: true, range: [bars(8), bars(16)] } as const;

/** A pocket synth on a MIDI track, set for the part it plays. */
const synth = (
  id: string,
  patch: Partial<ReturnType<typeof pocketSynthDevice.defaults>>
) => ({
  device: pocketSynthDevice.id,
  id,
  instrument: true,
  state: { ...pocketSynthDevice.defaults(), ...patch },
});

const TRACKS: ArrangementTrack[] = [
  { color: 0, id: "drums", name: "Drums" },
  {
    color: 1,
    devices: [
      synth("device-1", { filter: "lowpass", volume: 0.7, wave: "sawtooth" }),
    ],
    id: "bass",
    kind: "midi",
    name: "Bass",
  },
  {
    color: 2,
    devices: [
      synth("device-2", { filter: "lowpass", volume: 0.35, wave: "triangle" }),
    ],
    id: "keys",
    kind: "midi",
    name: "Keys",
  },
  { color: 3, id: "pad", name: "Pad" },
] as const;

const NO_ANALYSERS: readonly AnalyserNode[] = [];
const NO_PEAKS: number[] = [];

/** What a meter shows before the engine runs. */
const SILENCE = {
  getSnapshot: () => ({ levels: [-60, -60], peaks: [-60, -60] }),
  subscribe: () => () => undefined,
};

/** How long the demo's recordings last: two bars at their tempo. */
const RECORDING_BARS = 2;

/** An audio clip from bar `from` to bar `to`, looping a recording of the demo. */
const arranged = (
  id: string,
  name: string,
  track: string,
  from: number,
  to: number,
  recording: string
): Arranged => ({
  id,
  loop: [0, bars(RECORDING_BARS)],
  name,
  recording,
  sourceLength: bars(RECORDING_BARS),
  track,
  value: {
    fadeIn: 0,
    fadeOut: 0,
    length: bars(to - from),
    offset: 0,
    start: bars(from),
  },
});

const BEAT = BAR / 4;

/** Notes from `[pitch, beat, beats]`: where each starts and how long it lasts, in beats of the first tempo. */
const notesOf = (pattern: readonly (readonly [number, number, number])[]) =>
  pattern.map(([pitch, at, beats], index) => ({
    id: `n${index}`,
    length: beats * BEAT,
    pitch,
    start: at * BEAT,
    velocity: 0.8,
  }));

/** Two bars of bass: A, then F, on the beat and the off-beats around it. */
const BASSLINE = notesOf([
  [33, 0, 0.75],
  [33, 1.5, 0.5],
  [45, 2, 0.5],
  [33, 3, 0.75],
  [29, 4, 0.75],
  [29, 5.5, 0.5],
  [41, 6, 0.5],
  [31, 7, 0.75],
]);

/** Four bars of chords, one a bar: A minor, F, C, G. */
const CHORDS = notesOf(
  [
    [57, 60, 64],
    [53, 57, 60],
    [55, 60, 64],
    [55, 59, 62],
  ].flatMap((chord, bar) =>
    chord.map((pitch) => [pitch, bar * 4, 3.75] as const)
  )
);

/** A MIDI clip that loops `notes` over `loopBars`, from bar `from` to bar `to`. */
const midiArranged = (
  id: string,
  name: string,
  track: string,
  from: number,
  to: number,
  loopBars: number,
  notes: Arranged["notes"]
): Arranged => ({
  id,
  loop: [0, bars(loopBars)],
  name,
  notes,
  sourceLength: bars(loopBars),
  track,
  value: {
    fadeIn: 0,
    fadeOut: 0,
    length: bars(to - from),
    offset: 0,
    start: bars(from),
  },
});

const CLIPS: Arranged[] = [
  arranged("d1", "Intro", "drums", 0, 4, "beat"),
  arranged("d2", "Groove", "drums", 4, 16, "beat"),
  arranged("d3", "Groove", "drums", 16, 28, "beat"),
  arranged("d4", "Fill", "drums", 28, 32, "beat"),
  midiArranged("b1", "Sub", "bass", 4, 12, 2, BASSLINE),
  midiArranged("b2", "Sub", "bass", 16, 28, 2, BASSLINE),
  midiArranged("k1", "Pad", "keys", 0, 8, 4, CHORDS),
  midiArranged("k2", "Chords", "keys", 8, 16, 4, CHORDS),
  midiArranged("k3", "Pad", "keys", 20, 32, 4, CHORDS),
  arranged("p1", "Pad", "pad", 8, 16, "pad"),
  arranged("p2", "Pad", "pad", 16, 24, "pad"),
];

function Row({
  children,
  className,
  height,
  lead,
  onResize,
  selected,
  trackId,
}: {
  children: ReactNode;
  className?: string;
  /** A height set by hand: the row keeps it instead of sharing what is left. */
  height?: number;
  lead?: ReactNode;
  onResize?: (trackId: string, height: number | undefined) => void;
  selected?: boolean;
  trackId?: string;
}) {
  const handleHeight = useCallback(
    (next: number | undefined) => {
      if (trackId !== undefined) {
        onResize?.(trackId, next);
      }
    },
    [onResize, trackId]
  );
  return (
    <TimelineTrack
      className={className}
      height={height}
      maxHeight={MAX_TRACK_HEIGHT}
      minHeight={MIN_TRACK_HEIGHT}
      onHeightChange={handleHeight}
      selected={selected}
      step={TRACK_HEIGHT_STEP}
    >
      <TimelineTrackHeader className="relative flex items-stretch">
        {lead}
      </TimelineTrackHeader>
      <div className="flex flex-1 flex-col">{children}</div>
    </TimelineTrack>
  );
}

/** What the keyboard does, for the shortcuts popover: the keys, then what they do. */
const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: "Split at the cursor", keys: ["S"] },
  { action: "Split at the cursor", keys: ["Cmd/Ctrl", "E"] },
  { action: "Duplicate the clip", keys: ["Cmd/Ctrl", "D"] },
  { action: "Remove the clip, or the tracks picked", keys: ["Delete"] },
  { action: "Add a track to the tracks picked", keys: ["Shift", "Click"] },
  { action: "Duplicate the tracks picked", keys: ["Cmd/Ctrl", "D"] },
  { action: "Add a locator at the cursor", keys: ["M"] },
  { action: "Loop the selection", keys: ["Cmd/Ctrl", "L"] },
  { action: "Rename a locator", keys: ["Enter"] },
  {
    action: "Jump to the previous or next locator",
    keys: ["Alt", "Left", "Right"],
  },
  { action: "Nudge a clip or an edge", keys: ["Left", "Right"] },
  { action: "Nudge further", keys: ["Shift", "Left", "Right"] },
  { action: "Copy a clip while dragging", keys: ["Alt", "Drag"] },
  { action: "Move or trim off the grid", keys: ["Cmd/Ctrl", "Drag"] },
  { action: "Zoom around the pointer", keys: ["Cmd/Ctrl", "Scroll"] },
  { action: "Resize a track", keys: ["Up", "Down"] },
  { action: "Add a clip to the selection", keys: ["Shift", "Click"] },
  { action: "Undo", keys: ["Cmd/Ctrl", "Z"] },
  { action: "Redo", keys: ["Cmd/Ctrl", "Shift", "Z"] },
  { action: "Select every clip", keys: ["Cmd/Ctrl", "A"] },
  { action: "Show or hide the automation", keys: ["A"] },
  { action: "Select by dragging a rectangle", keys: ["Shift", "Drag"] },
  { action: "Clear the selection", keys: ["Esc"] },
];

/** How many slices of a recording the block keeps: the lanes and the clip panel draw the stretch of them a clip holds. */
const RECORDING_PEAKS = 16_384;
/** The end of a file's name that says its format. */
const EXTENSION = /\.[^.]+$/;
/** The files the browser can try to decode as sound when it does not give their type. */
const AUDIO_FILE = /\.(aac|aif|aiff|flac|m4a|mp3|oga|ogg|opus|wav|weba|webm)$/i;

/** A recording the clips play: the demo's, or a file dropped on a track. Its sound, its peaks and how long it lasts, in seconds. */
interface Recording {
  length: number;
  peaks: number[];
  source: RecordingSource;
}

/** A decoded sound as a recording: its channels at the engine's rate, and the peaks its clips draw. */
function recordingOf(
  channels: readonly Float32Array[],
  sampleRate: number
): Recording {
  return {
    length: (channels[0]?.length ?? 0) / sampleRate,
    peaks: amplitudes(channels),
    source: { channels, sampleRate },
  };
}

/** Whether a drag carries files from the desktop, rather than something of the page. */
function carriesFiles(event: DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

/** One amplitude per slice, from 0 to 1, as the clip panel draws them. */
function amplitudes(channels: readonly Float32Array[]): number[] {
  const { max, min } = normalizePeaks(computePeaks(channels, RECORDING_PEAKS));
  return Array.from(max, (high, index) => Math.max(high, -(min[index] ?? 0)));
}

/** The peaks of a recording over the stretch of it a clip's source holds: a recording keeps its own seconds. */
function recordedPeaks(recording: Recording, clip: Arranged): number[] {
  const { length } = recording;
  const from = clip.sourceFrom ?? 0;
  const { peaks } = recording;
  const first = Math.max(0, Math.floor((from / length) * peaks.length));
  const last = Math.min(
    peaks.length,
    Math.ceil(((from + clip.sourceLength) / length) * peaks.length)
  );
  return peaks.slice(first, Math.max(first + 1, last));
}

/** Closes the clip panel. */
function CloseClipView({ onClose }: { onClose: () => void }) {
  return (
    <Button
      aria-label="Close the clip panel"
      onClick={onClose}
      size="icon-sm"
      variant="ghost"
    >
      <IconPlaceholder
        aria-hidden="true"
        className="size-4"
        hugeicons="Cancel01Icon"
        lucide="XIcon"
        phosphor="XIcon"
        remixicon="RiCloseLine"
        tabler="IconX"
      />
    </Button>
  );
}

/** The clip panel stays in view at the bottom of the window while the tracks scroll past above it. */
const DOCKED = "sticky bottom-0 z-40 shadow-lg";

/** The clip panel under the tracks, for the clip being edited, or a word on how to pick one. */
function ClipDock({
  bar,
  beatsPerBar,
  clip,
  collapsed,
  format,
  midi,
  onActiveChange,
  onClose,
  onCollapsedChange,
  onCrop,
  onValueChange,
  onValueCommitted,
  peaks,
  foldedBoxes,
  onFoldedBoxesChange,
  onRename,
}: {
  bar: number;
  beatsPerBar: number;
  clip: Arranged | undefined;
  /** Whether the panel is collapsed to its title: held here, so it stays so from clip to clip. */
  collapsed: boolean;
  format: (seconds: number) => string;
  /** What a MIDI clip's panel edits and sounds. */
  midi: Pick<
    ComponentProps<typeof MidiClipPanel>,
    "onNoteOff" | "onNoteOn" | "onNotesChange" | "onRegionChange"
  >;
  onActiveChange: (active: boolean) => void;
  onClose: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onCrop: () => void;
  onValueChange: (next: ClipSettings) => void;
  onValueCommitted: () => void;
  /** The ids of the boxes folded in the panel: held here, so they stay folded from clip to clip. */
  foldedBoxes: readonly string[];
  onFoldedBoxesChange: (folded: string[]) => void;
  onRename: (id: string, name: string) => void;
  peaks: number[];
}) {
  const rename = useCallback(
    (name: string) => clip && onRename(clip.id, name),
    [clip, onRename]
  );
  if (!clip) {
    return null;
  }
  if (clip.notes) {
    return (
      <MidiClipPanel
        active={!clip.disabled}
        bar={bar}
        beat={bar / beatsPerBar}
        className={DOCKED}
        collapsed={collapsed}
        foldedBoxes={foldedBoxes}
        key={clip.id}
        name={clip.name}
        notes={clip.notes}
        onActiveChange={onActiveChange}
        onCollapsedChange={onCollapsedChange}
        onFoldedBoxesChange={onFoldedBoxesChange}
        onNotesCommitted={onValueCommitted}
        onRename={rename}
        region={{
          length: clip.value.length,
          loop: clip.loop ?? null,
          offset: clip.value.offset,
          sourceLength: clip.sourceLength,
        }}
        {...midi}
      >
        <CloseClipView onClose={onClose} />
      </MidiClipPanel>
    );
  }
  return (
    <ClipPanel
      active={!clip.disabled}
      bar={bar}
      beatsPerBar={beatsPerBar}
      className={DOCKED}
      collapsed={collapsed}
      foldedBoxes={foldedBoxes}
      format={format}
      name={clip.name}
      onActiveChange={onActiveChange}
      onCollapsedChange={onCollapsedChange}
      onCrop={onCrop}
      onFoldedBoxesChange={onFoldedBoxesChange}
      onRename={rename}
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      value={{
        gain: clip.gain ?? 0,
        length: clip.value.length,
        loop: clip.loop ?? null,
        offset: clip.value.offset,
        reversed: Boolean(clip.reversed),
        sourceLength: clip.sourceLength,
        transpose: clip.transpose ?? 0,
        warp: clip.warp ?? null,
      }}
      values={peaks}
    >
      <CloseClipView onClose={onClose} />
    </ClipPanel>
  );
}

/** The main track's level, as the engine meters it: what the arrangement sends to the speakers. */
function MainLevel({
  analysers,
}: {
  analysers: readonly AnalyserNode[] | null;
}) {
  const levels = useAudioLevels(analysers ?? NO_ANALYSERS);
  return (
    <Meter
      aria-label="Master output level"
      className="data-[orientation=horizontal]:[--meter-thickness:--spacing(3)]"
      orientation="horizontal"
      peakMarks="hidden"
      size="sm"
      source={analysers ? levels : SILENCE}
      warnThreshold={-12}
    />
  );
}

/** A decoded buffer's channels. */
function channelsOf(buffer: AudioBuffer) {
  return Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
    buffer.getChannelData(channel)
  );
}

/**
 * The recordings the audio clips play, by id: the demo's beat and pad, drawn
 * once at the engine's rate, and the files dropped on the tracks, which
 * `keepRecording` adds.
 */
function useRecordings() {
  const [recordings, setRecordings] = useState<ReadonlyMap<string, Recording>>(
    () => new Map()
  );
  useEffect(() => {
    const context = webAudio.getContext();
    if (!context) {
      return;
    }
    let cancelled = false;
    Promise.all([
      renderBeatLoop(context.sampleRate),
      renderHeldChord(context.sampleRate),
    ]).then(([beat, pad]) => {
      if (!cancelled) {
        setRecordings((current) =>
          new Map(current)
            .set("beat", recordingOf(channelsOf(beat), context.sampleRate))
            .set("pad", recordingOf(channelsOf(pad), context.sampleRate))
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const keepRecording = useCallback(
    (id: string, recording: Recording) =>
      setRecordings((current) => new Map(current).set(id, recording)),
    []
  );
  // What the engine plays: the sounds alone, the same map until a recording comes or goes.
  const sources = useMemo(
    () =>
      new Map([...recordings].map(([id, recording]) => [id, recording.source])),
    [recordings]
  );
  return { keepRecording, recordings, sources };
}

/** The engine as the transport: play from the playhead or pause where the sound is, and a seek that, while playing, plays from there. */
function useEngineTransport({
  play,
  playing,
  position,
  stop,
}: ReturnType<typeof useArrangementEngine>) {
  const playPause = useCallback(() => {
    if (playing) {
      stop();
    } else {
      play(position.getSnapshot());
    }
  }, [play, playing, position, stop]);
  const seek = useCallback(
    (seconds: number) => {
      if (playing) {
        play(seconds);
      } else {
        position.set(seconds);
      }
    },
    [play, playing, position]
  );
  return { playPause, seek };
}

/**
 * An arrangement that plays: a bar ruler that seeks on the grid, a loop strip,
 * a lane per track with clips to move between tracks, trim and fade, a cursor
 * to put anywhere on a track and split at, and a playhead following the sound.
 * The arrangement engine plays it on the audio clock: the audio clips loop the
 * demo's recordings, the MIDI clips play through each track's synth, and every
 * track through its mix. Cmd/Ctrl + scroll zooms around the pointer, and the
 * bar below scrolls and zooms. Made to be opened at full size, where the
 * tracks take the screen.
 */
export default function BlockTimeline() {
  const {
    dispatch,
    doc,
    duration,
    locators,
    loop: { on: looping, range: loop },
    signatures,
    tempo,
    canRedo,
    canUndo,
    clips,
    copying,
    copyOf,
    folded,
    heights,
    toggleFold,
    mixOf,
    resizeTrack,
    selectedIds,
    selectedTracks,
    selection,
    tracks,
  } = useArrangement({
    colors: TRACK_COLORS.length,
    duration: BARS * BAR,
    initialClips: CLIPS,
    initialLocators: LOCATORS,
    initialLoop: LOOP,
    initialTracks: TRACKS,
    tempo: DEMO_TEMPO,
  });
  // What the lanes, the headers and the keys report, as the commands that change the selection.
  const clearSelection = useCallback(
    () => dispatch({ type: "clear-selection" }),
    [dispatch]
  );
  const selectAll = useCallback(
    () => dispatch({ type: "select-all" }),
    [dispatch]
  );
  const selectClip = useCallback(
    (id: string, additive: boolean) =>
      dispatch({ type: "select-clip", id, additive }),
    [dispatch]
  );
  const selectClips = useCallback(
    (ids: string[]) => dispatch({ type: "select-clips", ids }),
    [dispatch]
  );
  const selectTrack = useCallback(
    (id: string, additive = false) =>
      dispatch({ type: "select-track", id, additive }),
    [dispatch]
  );
  const toggleSelected = useCallback(
    () => dispatch({ type: "toggle-selected" }),
    [dispatch]
  );
  const bar = secondsPerBar(tempo);
  const describe = useCallback(
    (seconds: number) => {
      const { bar: number, beat } = barsBeatsWith(seconds, tempo, signatures);
      return `Bar ${number}, beat ${beat}`;
    },
    [signatures, tempo]
  );
  const [metronome, setMetronome] = useState(false);
  const [rhythm, setRhythm] = useState<MetronomeRhythm>("auto");
  // Automation mode, and the automated gains and pans moved by hand, which play their mix until enabled again.
  const automation = useTrackAutomation({ dispatch, tracks });
  const { keepRecording, recordings, sources } = useRecordings();
  // The arrangement plays on the audio clock: its clips, its notes through each MIDI track's synth, its mix.
  const engine = useArrangementEngine({
    doc,
    metronome: { on: metronome, rhythm },
    overridden: automation.overridden,
    recordings: sources,
  });
  const clock = engine.position;
  const { playing } = engine;
  const { playPause, seek } = useEngineTransport(engine);
  // The clips, as the commands that change them. A split cuts at the playhead, no closer to a clip's edge than a sixteenth of the bar.
  const getPosition = useCallback(() => clock.getSnapshot(), [clock]);
  // A stretch of time on some tracks, drawn by dragging across bare lanes, and what the keys do with it.
  // Cmd/Ctrl + J: each audio track's clips rendered into one recording, as they play, then one clip per track, one step of undo.
  const consolidateTime = useCallback(
    async (time: TimeSelection) => {
      const sampleRate = webAudio.getContext()?.sampleRate;
      const rendered: Record<string, string> = {};
      await time.tracks.reduce(async (done, track) => {
        await done;
        if (audioClipsIn(doc.clips, track, time.range).length === 0) {
          return;
        }
        const buffer = await renderTrackClips(doc, track, time.range, sources, {
          sampleRate,
        });
        if (buffer) {
          const id = `consolidated-${crypto.randomUUID()}`;
          keepRecording(id, recordingOf(channelsOf(buffer), buffer.sampleRate));
          rendered[track] = id;
        }
      }, Promise.resolve());
      dispatch({ rendered, time, type: "consolidate-time" });
    },
    [dispatch, doc, keepRecording, sources]
  );
  const timeSelection = useTimeSelection({
    bar,
    clips,
    copyOf,
    dispatch,
    getPosition,
    onConsolidate: consolidateTime,
    selectedIds,
    selectedTracks,
    tracks,
  });
  const { clear: letGoOfTime, pressLane, time: selectedTime } = timeSelection;
  const splitStep = bar / 4;
  const addClip = useCallback(
    (clip: Arranged) => dispatch({ type: "add-clip", clip }),
    [dispatch]
  );
  const crop = useCallback(
    (id: string) => dispatch({ type: "crop-clip", id }),
    [dispatch]
  );
  const duplicateSelection = useCallback(() => {
    const next = dispatch({ type: "duplicate-selection" });
    // The copies are the selection the command leaves, in the order it lists them.
    return (next.selection?.clips ?? []).flatMap((id) =>
      next.doc.clips.filter((clip) => clip.id === id)
    );
  }, [dispatch]);
  const editClip = useCallback(
    (id: string, change: (clip: Arranged) => Arranged) =>
      dispatch({ type: "edit-clip", id, change }),
    [dispatch]
  );
  const settleClipEdit = useCallback(
    () => dispatch({ type: "settle-clip-edit" }),
    [dispatch]
  );
  const splitAtCursor = useCallback(
    () =>
      dispatch({ type: "split-cursor", at: getPosition(), step: splitStep }),
    [dispatch, getPosition, splitStep]
  );
  // The tracks, the time selection and the history, as the commands that change them.
  const addTrack = useCallback(
    (afterId?: string, kind?: TrackKind) => {
      const next = dispatch({ type: "add-track", afterId, kind });
      // The track it added is the one numbered last.
      return next.doc.tracks.find(
        (track) => track.id === `track-${next.trackCount}`
      );
    },
    [dispatch]
  );
  const duplicateTrack = useCallback(
    (id: string) => dispatch({ type: "duplicate-track", id }),
    [dispatch]
  );
  const moveTrack = useCallback(
    (id: string, index: number) => dispatch({ type: "move-track", id, index }),
    [dispatch]
  );
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);
  const removeTrack = useCallback(
    (id: string) => dispatch({ type: "remove-track", id }),
    [dispatch]
  );
  const renameTrack = useCallback(
    (id: string, name: string) => dispatch({ type: "rename-track", id, name }),
    [dispatch]
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  // The timeline fits the width it is given until it is zoomed, and its grid follows the zoom.
  const viewportRef = useRef<HTMLDivElement>(null);
  const view = useTimelineZoom({ duration, viewportRef });
  const { zoom } = view;
  const grid = useTimelineGrid({ tempo, zoom });
  const { snap, snapStep, step: gridSeconds } = grid;
  // Whether the bar has room for the zoom control; the menu lists the zoom steps only when it does not.
  const zoomSlotRef = useRef<HTMLDivElement>(null);
  const [zoomInBar, setZoomInBar] = useState(true);
  // Below the bar's room, the tempo and the undo and redo move into the more-controls menu.
  const narrowProbeRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  // The shortcuts are caught on the panel, so a press on the lane, which takes no focus, hands it over.
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = panelRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      if (zoomSlotRef.current) {
        setZoomInBar(getComputedStyle(zoomSlotRef.current).display !== "none");
      }
      if (narrowProbeRef.current) {
        setNarrow(getComputedStyle(narrowProbeRef.current).display !== "none");
      }
    };
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
  }, []);
  // A change of tempo, or the undo of one, changes the bar: the playhead and the zoom keep their places in it.
  const lastBar = useRef(bar);
  const { rescale } = view;
  useLayoutEffect(() => {
    if (lastBar.current === bar) {
      return;
    }
    const ratio = bar / lastBar.current;
    lastBar.current = bar;
    clock.set(clock.getSnapshot() * ratio);
    rescale(ratio);
  }, [bar, clock, rescale]);
  const handleAddTrack = useCallback(() => addTrack(), [addTrack]);
  const handleAddMidiTrack = useCallback(
    () => addTrack(undefined, "midi"),
    [addTrack]
  );
  // Multi-select: a press on a clip adds it to the selection, and a drag on bare lane draws a rectangle. For touch, which has no Shift.
  const [multi, setMulti] = useState(false);
  // A touch screen has no Shift: in multi-select mode every press on a header adds to the tracks picked.
  const pickTrack = useCallback(
    (id: string, additive: boolean) => selectTrack(id, additive || multi),
    [multi, selectTrack]
  );
  const marquee = useMarquee(selectedIds, selectClips, multi);
  // A muted track is silent, and while any track is soloed so is every other: their clips are drawn drained.
  const anySolo = tracks.some((track) => mixOf(track).soloed);

  // Stop goes back to the top, as a DAW's does.
  const { stop: stopEngine } = engine;
  const stop = useCallback(() => {
    stopEngine();
    clock.set(0);
  }, [clock, stopEngine]);
  // The zoom as a share of the fitted view: 100% shows everything.
  const zoomPreset = ZOOM_PRESETS.find(
    (ratio) => Math.abs(ratio - view.ratio) < 0.01
  );
  const { setRatio: changeZoom } = view;
  // A track moves by dragging its grip, or with Up and Down on it.
  const trackOrder = useMemo(() => tracks.map((track) => track.id), [tracks]);
  const reorder = useTrackReorder({ onMove: moveTrack, order: trackOrder });
  const ghostTrack = tracks.find((track) => track.id === reorder.ghost?.id);
  const changeZoomPreset = useCallback(
    (value: string) => changeZoom(Number(value)),
    [changeZoom]
  );
  // A press on a track's empty lane puts the cursor there (the lane does it) and picks the track, letting go of the clips; on the surface under the last track it lets go of everything, as nothing is there.
  // The closed clip panel comes back on a click of a clip's head, or a double-click on its body: not on a press, which may begin a move, a trim or a fade, and the panel takes room from the tracks under the pointer.
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const notePress = useCallback((event: PointerEvent<HTMLDivElement>) => {
    pressRef.current = { x: event.clientX, y: event.clientY };
  }, []);
  const showClipView = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const press = pressRef.current;
    // A click is a press that let go where it began, give or take a hand's shake.
    const dragged =
      press !== null &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4;
    if (
      !dragged &&
      (event.target as HTMLElement).closest(
        '[data-slot="timeline-clip-header"]'
      )
    ) {
      setClipViewOpen(true);
    }
  }, []);
  const showClipViewOfBody = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      // On the head a double-click renames the clip.
      if (
        target.closest("[data-clip-id]") &&
        !target.closest('[data-slot="timeline-clip-header"]')
      ) {
        setClipViewOpen(true);
      }
    },
    []
  );
  const focusPanel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !event.shiftKey && !multi) {
        const { track } = event.currentTarget.dataset;
        pressLane(track ?? null);
        if (track) {
          selectTrack(track);
        } else {
          clearSelection();
        }
        // `focusVisible` is missing from older DOM typings.
        panelRef.current?.focus({
          focusVisible: false,
          preventScroll: true,
        } as FocusOptions);
      }
    },
    [clearSelection, multi, pressLane, selectTrack]
  );
  const jumpToLocator = useCallback((at: number) => seek(at), [seek]);
  const playFromLocator = useCallback(
    (at: number) => {
      engine.position.set(at);
      engine.play(at);
    },
    [engine]
  );
  // The locators and the time signatures, with the commands behind them.
  const markers = useTimelineMarkers({
    dispatch,
    getPosition,
    onJump: jumpToLocator,
    onPlay: playFromLocator,
    step: snapStep,
  });
  // M, the arrows, Home and End: what the keys do with the cursor.
  const cursorKeys = useTimelineCursor({
    clips,
    duration,
    getPosition,
    locators,
    onAddLocator: markers.addLocator,
    onPickTrack: selectTrack,
    onSeek: seek,
    selectedIds,
    selectedTracks,
    step: gridSeconds,
    tracks,
  });

  /** Puts the loop around the selected clip, or around the clips of the selected track. */
  const loopSelection = useCallback(() => {
    const chosen = clips.filter(
      (clip) =>
        selectedIds.includes(clip.id) || selectedTracks.includes(clip.track)
    );
    if (chosen.length === 0) {
      return;
    }
    dispatch({
      type: "set-loop",
      loop: {
        on: true,
        range: [
          Math.min(...chosen.map((clip) => clip.value.start)),
          Math.max(
            ...chosen.map((clip) => clip.value.start + clip.value.length)
          ),
        ],
      },
    });
  }, [clips, dispatch, selectedIds, selectedTracks]);

  // The copies are there to be seen: bring them into view once they are drawn.
  const duplicateAndShow = useCallback(() => {
    const copies = duplicateSelection();
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-clip-id="${copies[0]?.id}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, [duplicateSelection]);
  /** Cmd/Ctrl + A selects every clip, Cmd/Ctrl + D duplicates the selection; returns whether the key was one of these. */
  const handleSelectionKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key.toLowerCase();
      if (!(event.metaKey || event.ctrlKey)) {
        return false;
      }
      if (key === "z" || key === "y") {
        event.preventDefault();
        if (key === "y" || event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return true;
      }
      if (key === "a") {
        event.preventDefault();
        selectAll();
        return true;
      }
      if (key === "d" && selectedIds.length > 0) {
        event.preventDefault();
        duplicateAndShow();
        return true;
      }
      if (key === "d" && selectedTracks.length > 0) {
        event.preventDefault();
        for (const id of selectedTracks) {
          duplicateTrack(id);
        }
        return true;
      }
      return false;
    },
    [
      duplicateAndShow,
      duplicateTrack,
      redo,
      selectAll,
      selectedIds,
      selectedTracks,
      undo,
    ]
  );
  /** Delete takes away the tracks picked by their headers (a clip handles its own Delete); returns whether the key was it. */
  const handleTrackKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const del = event.key === "Delete" || event.key === "Backspace";
      if (!(del && selectedTracks.length > 0 && selectedIds.length === 0)) {
        return false;
      }
      event.preventDefault();
      removeTrack(selectedTracks[0] ?? "");
      return true;
    },
    [removeTrack, selectedIds.length, selectedTracks]
  );
  /** Picking a clip lets go of the time selection. */
  // The clip panel shows the clip picked, as a DAW's detail view follows the selection, for as long as it is open. It starts closed, and picking a clip does not open it: a click of a clip's head does.
  const [clipViewOpen, setClipViewOpen] = useState(false);
  // Collapsed to its title, the panel leaves the tracks the room, from clip to clip.
  const [clipViewCollapsed, setClipViewCollapsed] = useState(false);
  const [clipBoxesFolded, setClipBoxesFolded] = useState<string[]>([]);
  // The clips, as the commands that change them. The menu's Edit opens the clip panel, and picking a clip lets go of the time selected.
  const openClipView = useCallback(() => setClipViewOpen(true), []);
  const arrangedClips = useArrangedClips({
    clips,
    copying,
    dispatch,
    getPosition,
    onEdit: openClipView,
    onPress: letGoOfTime,
    selectedIds,
    splitStep,
    tracks,
    viewportRef,
  });
  // What each audio clip draws of its recording, once the recording is there.
  const clipPeaks = useMemo(
    () =>
      new Map(
        clips.flatMap((clip) => {
          const recording = clip.recording
            ? recordings.get(clip.recording)
            : undefined;
          return recording
            ? [[clip.id, recordedPeaks(recording, clip)] as const]
            : [];
        })
      ),
    [clips, recordings]
  );
  // The clip panel, under the tracks: it edits the first selected clip.
  const editedClip = clips.find((clip) => clip.id === selectedIds[0]);
  const editedPeaks = useMemo(
    () => (editedClip && clipPeaks.get(editedClip.id)) ?? NO_PEAKS,
    [clipPeaks, editedClip]
  );
  // A MIDI clip's notes, from the clip panel's piano roll: a drag is one undo step.
  const changeNotes = useCallback(
    (notes: NonNullable<Arranged["notes"]>) => {
      if (editedClip) {
        editClip(editedClip.id, (clip) => ({ ...clip, notes }));
      }
    },
    [editClip, editedClip]
  );
  // A double-click on bare MIDI lane makes an empty clip a bar long there, looping, and opens it.
  const midiClipCount = useRef(0);
  const addMidiClipAt = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const lane = event.currentTarget;
      const trackId = lane.dataset.track;
      if (
        !trackId ||
        (event.target as HTMLElement).closest(
          "[data-clip-id], [data-slot=automation-envelope]"
        )
      ) {
        return;
      }
      const rect = lane.getBoundingClientRect();
      const time = ((event.clientX - rect.left) / rect.width) * duration;
      const start = Math.max(
        0,
        Math.min(Math.floor(time / bar) * bar, duration - bar)
      );
      midiClipCount.current += 1;
      addClip({
        id: `midi-${midiClipCount.current}`,
        loop: [0, bar],
        name: "MIDI clip",
        notes: [],
        sourceLength: bar,
        track: trackId,
        value: { fadeIn: 0, fadeOut: 0, length: bar, offset: 0, start },
      });
      letGoOfTime();
      setClipViewOpen(true);
    },
    [addClip, bar, duration, letGoOfTime]
  );
  const changeClipSettings = useCallback(
    (next: ClipSettings) => {
      if (!editedClip) {
        return;
      }
      editClip(editedClip.id, (clip) => {
        // The clip keeps its place: what it plays changes, so it ends as early as the timeline needs.
        const length = Math.min(next.length, duration - clip.value.start);
        const fadeIn = Math.min(clip.value.fadeIn, length);
        return {
          ...clip,
          gain: next.gain,
          loop: next.loop ?? undefined,
          reversed: next.reversed,
          transpose: next.transpose,
          warp: next.warp ?? undefined,
          value: {
            ...clip.value,
            fadeIn,
            fadeOut: Math.min(clip.value.fadeOut, length - fadeIn),
            length,
            offset: next.offset,
          },
        };
      });
    },
    [duration, editClip, editedClip]
  );
  // Where a MIDI clip plays, from its clip panel: it keeps its place, and ends where the timeline does at most.
  const changeMidiRegion = useCallback(
    (region: MidiClipRegion) => {
      if (!editedClip) {
        return;
      }
      editClip(editedClip.id, (clip) => ({
        ...clip,
        loop: region.loop ?? undefined,
        value: {
          ...clip.value,
          length: Math.min(region.length, duration - clip.value.start),
          offset: region.offset,
        },
      }));
    },
    [duration, editClip, editedClip]
  );
  // A key pressed in the piano roll plays the track's synth.
  const editedTrack = editedClip?.track;
  const auditionOn = useCallback(
    (pitch: number, details: { velocity: number }) => {
      if (editedTrack) {
        engine.engine?.noteOn(editedTrack, pitch, details.velocity);
      }
    },
    [editedTrack, engine.engine]
  );
  const auditionOff = useCallback(
    (pitch: number) => {
      if (editedTrack) {
        engine.engine?.noteOff(editedTrack, pitch);
      }
    },
    [editedTrack, engine.engine]
  );
  const midiEditing = useMemo(
    () => ({
      onNoteOff: auditionOff,
      onNoteOn: auditionOn,
      onNotesChange: changeNotes,
      onRegionChange: changeMidiRegion,
    }),
    [auditionOff, auditionOn, changeMidiRegion, changeNotes]
  );
  // The clip panel's switch: off, the clip stays on its track and is not heard.
  const setEditedActive = useCallback(
    (active: boolean) => {
      if (editedClip) {
        editClip(editedClip.id, (clip) => ({ ...clip, disabled: !active }));
        settleClipEdit();
      }
    },
    [editClip, editedClip, settleClipEdit]
  );
  const cropEdited = useCallback(() => {
    if (editedClip) {
      crop(editedClip.id);
    }
  }, [crop, editedClip]);
  const closeClipView = useCallback(() => setClipViewOpen(false), []);
  /**
   * Cmd/Ctrl + Alt + 3 shows or hides the clip panel, read from the key's place
   * as Alt changes the letter on a Mac, and 0 switches the selected clips off
   * or on. Returns whether the key was one of these.
   */
  const handleClipKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (typing(event.target)) {
      return false;
    }
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.altKey && event.code === "Digit3") {
      event.preventDefault();
      setClipViewOpen((open) => !open);
      return true;
    }
    if (
      !(mod || event.altKey) &&
      (event.key === "0" || event.code === "Digit0") &&
      selectedIds.length > 0
    ) {
      event.preventDefault();
      toggleSelected();
      return true;
    }
    return false;
  };
  /** In automation mode, what a track shows: the parameter chooser in its header, and the envelope over its lane. */
  const automationOf = (track: ArrangementTrack) => {
    if (!automation.automating) {
      return { chooser: null, envelope: null };
    }
    const parameter = automation.parameterOf(track.id);
    return {
      chooser: (
        <TrackAutomationChooser
          onClear={automation.clear}
          onParameterChange={automation.show}
          parameter={parameter}
          track={track}
        />
      ),
      envelope: (
        <TrackAutomation
          describe={describe}
          duration={duration}
          mix={mixOf(track)}
          onChange={automation.edit}
          onCommit={settleClipEdit}
          overridden={automation.overridden[track.id]}
          parameter={parameter}
          snapStep={snapStep}
          track={track}
        />
      ),
    };
  };
  /** A shows or hides the automation; returns whether the key was it. */
  const handleAutomationKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key.toLowerCase() !== "a" ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      typing(event.target)
    ) {
      return false;
    }
    event.preventDefault();
    automation.toggle();
    return true;
  };
  // S, or Cmd/Ctrl + E, splits at the cursor, Cmd/Ctrl + D duplicates the clip; Escape drops the selection.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      clearSelection();
      letGoOfTime();
      return;
    }
    const key = event.key.toLowerCase();
    if (
      timeSelection.handleKey(event) ||
      handleClipKey(event) ||
      handleTrackKey(event) ||
      cursorKeys.handleKey(event) ||
      handleAutomationKey(event)
    ) {
      return;
    }
    if (key === "l" && (event.metaKey || event.ctrlKey) && selection) {
      event.preventDefault();
      loopSelection();
      return;
    }
    if (handleSelectionKey(event)) {
      return;
    }
    const split =
      (key === "s" && !(event.metaKey || event.ctrlKey || event.altKey)) ||
      (key === "e" && (event.metaKey || event.ctrlKey));
    if (split && selection) {
      event.preventDefault();
      splitAtCursor();
    }
  };

  // The grid the lanes draw is the grid everything snaps to. Snap off draws no lines and snaps nothing: a step of 0 is no grid.
  // A file dragged over an audio track marks it; let go there, it becomes a clip at the grid line under the
  // pointer (anywhere with Cmd/Ctrl), named and as long as the file, and the files after it follow it on the track.
  const [fileTrack, setFileTrack] = useState<string | null>(null);
  const fileCount = useRef(0);
  const audioLaneUnder = useCallback(
    (event: DragEvent) => {
      const lane = (event.target as Element).closest<HTMLElement>(
        "[data-track]"
      );
      const track = tracks.find(
        (candidate) => candidate.id === lane?.dataset.track
      );
      return track && (track.kind ?? "audio") === "audio" ? lane : null;
    },
    [tracks]
  );
  const addFiles = useCallback(
    async (files: File[], trackId: string, start: number) => {
      // Decoded at the engine's rate, so they play as they are. A file that is not sound is left out.
      const context = webAudio.getContext();
      if (!context) {
        return;
      }
      const decoded = await Promise.all(
        files.map((file) =>
          file
            .arrayBuffer()
            .then((bytes) => decodeAudioChannels(context, bytes))
            .catch(() => null)
        )
      );
      let at = start;
      for (const [index, file] of files.entries()) {
        const channels = decoded[index];
        const length = (channels?.[0]?.length ?? 0) / context.sampleRate;
        if (channels && length > 0 && at < duration) {
          fileCount.current += 1;
          const id = `file${fileCount.current}`;
          keepRecording(id, recordingOf(channels, context.sampleRate));
          addClip({
            id,
            name: file.name.replace(EXTENSION, ""),
            recording: id,
            sourceLength: length,
            track: trackId,
            value: {
              fadeIn: 0,
              fadeOut: 0,
              length: Math.min(length, duration - at),
              offset: 0,
              start: at,
            },
          });
          selectClip(id, false);
          at += length;
        }
      }
    },
    [addClip, duration, keepRecording, selectClip]
  );
  const handleFileOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) {
        return;
      }
      // The whole view takes the drag, so a file let go anywhere but an audio track does nothing, rather than open in the tab.
      event.preventDefault();
      const lane = audioLaneUnder(event);
      event.dataTransfer.dropEffect = lane ? "copy" : "none";
      setFileTrack(lane?.dataset.track ?? null);
    },
    [audioLaneUnder]
  );
  const handleFileLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFileTrack(null);
    }
  }, []);
  const handleFileDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      setFileTrack(null);
      // The files are only there while the drop is handled: read them, and where they go, before decoding.
      const lane = audioLaneUnder(event);
      const trackId = lane?.dataset.track;
      const files = Array.from(event.dataTransfer.files).filter(
        (file) => file.type.startsWith("audio/") || AUDIO_FILE.test(file.name)
      );
      if (!(lane && trackId) || files.length === 0) {
        return;
      }
      const box = lane.getBoundingClientRect();
      const time = ((event.clientX - box.left) / box.width) * duration;
      const start =
        bypassesGrid(event) || snapStep <= 0
          ? time
          : Math.round(time / snapStep) * snapStep;
      addFiles(files, trackId, Math.max(0, start));
    },
    [addFiles, audioLaneUnder, duration, snapStep]
  );

  // What the time strips report, as the commands that change the arrangement.
  const changeTempo = useCallback(
    (next: Tempo) => dispatch({ type: "set-tempo", tempo: next }),
    [dispatch]
  );
  const changeLooping = useCallback(
    (on: boolean) => dispatch({ type: "set-loop", loop: { on } }),
    [dispatch]
  );
  const changeLoop = useCallback(
    (range: readonly [number, number]) =>
      dispatch({ type: "change-loop", range }),
    [dispatch]
  );
  // A dragged clip or loop is pulled onto the edges of the other clips, the locators and the loop.
  const snapPoints = useMemo(() => {
    if (!snap) {
      return;
    }
    const points = new Set<number>(loop);
    for (const clip of clips) {
      points.add(clip.value.start);
      points.add(clip.value.start + clip.value.length);
    }
    for (const locator of locators) {
      points.add(locator.at);
    }
    return [...points];
  }, [clips, locators, loop, snap]);

  // Z zooms onto the selection, + and - zoom around the cursor, X steps back through the zooms they left behind.
  const { zoomAround, zoomBack, zoomTo } = view;
  const zoomAroundCursor = useCallback(
    (factor: number) => zoomAround(clock.getSnapshot(), factor),
    [clock, zoomAround]
  );
  const zoomToSelection = useCallback(() => {
    if (selectedTime) {
      zoomTo(...selectedTime.range);
      return;
    }
    const chosen = clips.filter(
      (clip) =>
        selectedIds.includes(clip.id) || selectedTracks.includes(clip.track)
    );
    if (chosen.length === 0) {
      zoomTo(...loop);
      return;
    }
    zoomTo(
      Math.min(...chosen.map((clip) => clip.value.start)),
      Math.max(...chosen.map((clip) => clip.value.start + clip.value.length))
    );
  }, [clips, loop, selectedIds, selectedTime, selectedTracks, zoomTo]);

  /** The navigation keys: the grid with Cmd/Ctrl + 1 to 5, the zoom with +, -, Z and X, and the cursor from the panel. */
  const handleNavigationKey = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.metaKey || event.ctrlKey) {
        const change = GRID_KEYS[event.code];
        if (!(change && !event.altKey && !event.shiftKey)) {
          return false;
        }
        event.preventDefault();
        grid.change(change);
        return true;
      }
      if (typing(event.target) || event.altKey) {
        return false;
      }
      const key = event.key.toLowerCase();
      const zoomKeys: Record<string, () => void> = {
        "+": () => zoomAroundCursor(2),
        "-": () => zoomAroundCursor(0.5),
        "=": () => zoomAroundCursor(2),
        x: zoomBack,
        z: zoomToSelection,
      };
      const zoomKey = event.shiftKey && key !== "+" ? undefined : zoomKeys[key];
      if (zoomKey) {
        event.preventDefault();
        zoomKey();
        return true;
      }
      // Anywhere else in the panel, a clip's or the loop's own input takes its arrows.
      return (
        event.target === event.currentTarget && cursorKeys.handleArrowKey(event)
      );
    },
    [
      cursorKeys.handleArrowKey,
      grid.change,
      zoomAroundCursor,
      zoomBack,
      zoomToSelection,
    ]
  );
  const handlePanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!handleNavigationKey(event)) {
      handleKeyDown(event);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the editor's shortcuts, caught from the controls inside it
    <div
      className="cn-audio-panel @container/panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4 outline-none"
      onKeyDown={handlePanelKey}
      ref={panelRef}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-2 p-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="@3xl/panel:hidden" ref={narrowProbeRef} />
          <Transport
            className="min-w-0 flex-1 flex-nowrap"
            looping={looping}
            metronome={metronome}
            onLoopingChange={changeLooping}
            onMetronomeChange={setMetronome}
            onPlayPause={playPause}
            onRhythmChange={setRhythm}
            onStop={stop}
            onTempoChange={changeTempo}
            playing={playing}
            rhythm={rhythm}
            signatures={signatures}
            source={clock}
            tempo={tempo}
          />
          <div className="hidden h-7 w-10 shrink-0 items-center @3xl/panel:flex">
            <MainLevel analysers={engine.meter(doc.main.id)} />
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {automation.anyOverridden ? (
            <Button
              aria-label="Re-enable automation"
              className="text-primary"
              onClick={automation.reenable}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="RotateLeft01Icon"
                lucide="RotateCcwIcon"
                phosphor="ArrowCounterClockwiseIcon"
                remixicon="RiArrowGoBackLine"
                tabler="IconRotate"
              />
            </Button>
          ) : null}
          <Button
            aria-label="Automation mode"
            aria-pressed={automation.automating}
            className="hidden @3xl/panel:inline-flex"
            onClick={automation.toggle}
            size="icon"
            variant={automation.automating ? "default" : "outline"}
          >
            {/* An envelope: what automation draws over a lane. */}
            <EnvelopeIcon className="size-4" weight="bold" />
          </Button>
          <ButtonGroup className="hidden @3xl/panel:flex">
            <Button
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="Undo02Icon"
                lucide="Undo2Icon"
                phosphor="ArrowUUpLeftIcon"
                remixicon="RiArrowGoBackLine"
                tabler="IconArrowBackUp"
              />
            </Button>
            <Button
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
              size="icon"
              variant="outline"
            >
              <IconPlaceholder
                hugeicons="Redo02Icon"
                lucide="Redo2Icon"
                phosphor="ArrowUUpRightIcon"
                remixicon="RiArrowGoForwardLine"
                tabler="IconArrowForwardUp"
              />
            </Button>
          </ButtonGroup>
          <div
            className="hidden items-center gap-2 @7xl/panel:flex"
            ref={zoomSlotRef}
          >
            <NumberControl
              format={PERCENT}
              label="Zoom"
              largeStep={1}
              max={view.maxRatio}
              min={1}
              onValueChange={changeZoom}
              step={0.25}
              steppers={ZOOM_STEPPERS}
              unit="Zoom"
              value={view.ratio}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="More controls"
                  size="icon"
                  variant="outline"
                />
              }
            >
              <IconPlaceholder
                hugeicons="MoreHorizontalIcon"
                lucide="EllipsisIcon"
                phosphor="DotsThreeIcon"
                remixicon="RiMoreLine"
                tabler="IconDots"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              {narrow ? (
                <>
                  <DropdownMenuItem disabled={!canUndo} onClick={undo}>
                    Undo
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!canRedo} onClick={redo}>
                    Redo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuCheckboxItem
                checked={multi}
                onCheckedChange={setMulti}
              >
                Multi-select
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={automation.automating}
                onCheckedChange={automation.setAutomating}
              >
                Automation
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  Keyboard shortcuts
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="flex max-h-(--available-height) w-auto flex-col">
                  <div className="scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto p-2 text-sm whitespace-nowrap">
                    {SHORTCUTS.map((shortcut) => (
                      <div
                        className="flex items-center justify-between gap-3"
                        key={`${shortcut.action}-${shortcut.keys.join("+")}`}
                      >
                        <span>{shortcut.action}</span>
                        <KbdGroup>
                          {shortcut.keys.map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </KbdGroup>
                      </div>
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              {zoomInBar ? null : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Zoom</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-auto">
                      <div className="p-2">
                        <NumberControl
                          format={PERCENT}
                          label="Zoom"
                          largeStep={1}
                          max={view.maxRatio}
                          min={1}
                          onValueChange={changeZoom}
                          step={0.25}
                          steppers={ZOOM_STEPPERS}
                          unit="Zoom"
                          value={view.ratio}
                        />
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        onValueChange={changeZoomPreset}
                        value={
                          zoomPreset === undefined ? "" : String(zoomPreset)
                        }
                      >
                        {ZOOM_PRESETS.map((ratio) => (
                          <DropdownMenuRadioItem
                            disabled={ratio > view.maxRatio}
                            key={ratio}
                            value={String(ratio)}
                          >
                            {ratio === 1 ? "Fit" : `${ratio * 100} %`}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Timeline
        className="min-h-0 flex-1 gap-2"
        duration={duration}
        onPositionChange={seek}
        snapPoints={snapPoints}
        snapStep={snapStep}
        source={clock}
        {...view.timeline}
      >
        <TimelineNavigator getAriaValueText={describe} />
        <TimelineViewport
          className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/40"
          onDragLeave={handleFileLeave}
          onDragOver={handleFileOver}
          onDrop={handleFileDrop}
          ref={viewportRef}
          scrollbar="hidden"
        >
          {/* As wide as the lanes, so the stuck headers stay put however far it scrolls. */}
          <div
            className={cn(
              "flex min-h-full w-max min-w-full shrink-0 flex-col",
              marquee.rect && "select-none"
            )}
            {...marquee.handlers}
          >
            {/* One sticky block, so what is stuck stays stacked whatever each row measures. */}
            <div className="sticky top-0 z-40 flex min-w-full shrink-0 flex-col bg-background">
              <Row
                className="shrink-0 border-foreground/25 border-b"
                lead={
                  <span className="flex h-full items-center px-3 text-xs text-muted-foreground">
                    Loop
                  </span>
                }
              >
                <TimelineLane className="h-6 cursor-cell border-b-0">
                  <TimelineRange
                    aria-label="Loop"
                    drawable
                    getAriaValueText={describe}
                    onValueChange={changeLoop}
                    onValueCommitted={settleClipEdit}
                    value={loop}
                  >
                    <TimelineRangeHandle aria-label="Loop start" edge="start" />
                    <TimelineRangeHandle aria-label="Loop end" edge="end" />
                  </TimelineRange>
                  <TimelinePlayhead />
                </TimelineLane>
              </Row>
              <Row
                className="shrink-0 border-foreground/25 border-b bg-background"
                lead={
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          aria-label="Grid"
                          className="h-full w-full justify-start rounded-none border-0 tabular-nums"
                          variant="ghost"
                        />
                      }
                    >
                      {grid.label}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <TimelineGridMenuItems
                        division={grid.division}
                        divisions={GRID_DIVISION_OPTIONS}
                        onDivisionChange={grid.chooseDivision}
                        onSnapChange={grid.setSnap}
                        onTripletChange={grid.setTriplet}
                        snap={snap}
                        triplet={grid.triplet}
                        variant="dropdown"
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                }
              >
                <TimelineRuler
                  aria-label="Playhead"
                  className="border-b-0"
                  getAriaValueText={describe}
                >
                  <TimelineBarMarks
                    duration={duration}
                    signatures={signatures}
                    tempo={tempo}
                    zoom={zoom}
                  />
                  <TimelinePlayhead />
                </TimelineRuler>
              </Row>
              <Row
                className="shrink-0 border-foreground/25 border-b bg-background"
                lead={
                  <span className="flex h-full items-center px-3 text-xs text-muted-foreground">
                    Markers
                  </span>
                }
              >
                <TimelineLane className="h-6 border-b-0">
                  {locators.map((locator) => (
                    <TimelineLocator
                      key={locator.id}
                      locator={locator}
                      {...markers.locator}
                    />
                  ))}
                </TimelineLane>
              </Row>
              <Row
                className="shrink-0 border-foreground/25 border-b bg-background"
                lead={
                  <div className="flex h-full items-center justify-between ps-3 pe-1 text-muted-foreground text-xs">
                    Signature
                    <Button
                      aria-label="Add a time signature at the cursor"
                      className="size-5"
                      onClick={markers.addSignature}
                      size="icon"
                      title="Add a time signature at the cursor"
                      variant="ghost"
                    >
                      <IconPlaceholder
                        aria-hidden="true"
                        className="size-3"
                        hugeicons="PlusSignIcon"
                        lucide="PlusIcon"
                        phosphor="PlusIcon"
                        remixicon="RiAddLine"
                        tabler="IconPlus"
                      />
                    </Button>
                  </div>
                }
              >
                <TimelineLane className="h-6 border-b-0">
                  {signatures.map((change) => (
                    <TimelineSignature
                      change={change}
                      editing={markers.editingSignature === change.id}
                      key={change.id}
                      {...markers.signature}
                    />
                  ))}
                </TimelineLane>
              </Row>
            </div>
            {tracks.map((track) => (
              <div
                aria-label={track.name}
                className="contents"
                data-track-id={track.id}
                key={track.id}
                role="group"
              >
                <Row
                  className={cn(
                    "border-foreground/25 border-b",
                    heights[track.id] === undefined && "flex-1",
                    trackReorderClass(reorder, track.id)
                  )}
                  height={heights[track.id]}
                  lead={
                    <div className="flex min-w-0 flex-1">
                      <TrackGrip
                        dragging={reorder.draggingId === track.id}
                        trackName={track.name}
                        {...reorder.gripProps(track.id)}
                      />
                      <TimelineTrackControls
                        compact={
                          heights[track.id] !== undefined &&
                          heights[track.id] < COMPACT_TRACK_HEIGHT
                        }
                        folded={folded[track.id]}
                        meter={
                          <TrackLevel
                            analysers={engine.meter(track.id)}
                            name={track.name}
                          />
                        }
                        mix={mixOf(track)}
                        name={track.name}
                        onDuplicate={duplicateTrack}
                        onInsert={addTrack}
                        onMix={automation.changeMix}
                        onMixCommit={settleClipEdit}
                        onRemove={removeTrack}
                        onRename={renameTrack}
                        onSelect={pickTrack}
                        onToggleFold={toggleFold}
                        selected={selectedTracks.includes(track.id)}
                        trackId={track.id}
                      >
                        {automationOf(track).chooser}
                      </TimelineTrackControls>
                    </div>
                  }
                  onResize={resizeTrack}
                  selected={selectedTracks.includes(track.id)}
                  trackId={track.id}
                >
                  <ContextMenu>
                    <ContextMenuTrigger render={<div className="contents" />}>
                      <TimelineLane
                        className={cn(
                          "h-auto flex-1 border-b-0",
                          heights[track.id] === undefined
                            ? "min-h-14"
                            : "min-h-0",
                          // A short track keeps its clips thin, so they fit.
                          heights[track.id] !== undefined &&
                            heights[track.id] < COMPACT_TRACK_HEIGHT &&
                            "**:data-clip-id:inset-y-0.5",
                          selectedTracks.includes(track.id) && "bg-muted/40",
                          // An audio file dragged over the track.
                          fileTrack === track.id &&
                            "ring-2 ring-primary ring-inset",
                          // A silent track keeps its clips on the page, drained.
                          (mixOf(track).muted ||
                            (anySolo && !mixOf(track).soloed)) &&
                            "**:data-clip-id:opacity-40"
                        )}
                        data-track={track.id}
                        gridStep={snapStep}
                        onClick={showClipView}
                        onDoubleClick={
                          track.kind === "midi" ? addMidiClipAt : undefined
                        }
                        onDoubleClickCapture={showClipViewOfBody}
                        onPointerDown={focusPanel}
                        onPointerDownCapture={notePress}
                        onSelectionChange={timeSelection.onSelectionChange}
                        seekable
                      >
                        {arrangedClips.ghostsOn(track.id).map((original) => (
                          <ArrangedClipGhost
                            clip={original}
                            key={original.id}
                          />
                        ))}
                        {clips
                          .filter((clip) => clip.track === track.id)
                          .map((clip) => (
                            <ArrangedClip
                              describe={describe}
                              key={clip.id}
                              multi={multi}
                              peaks={clipPeaks.get(clip.id)}
                              swatch={mixOf(track).color}
                              trackName={track.name}
                              {...arrangedClips.clipProps(clip)}
                            />
                          ))}
                        {selectedTime?.tracks.includes(track.id) ? (
                          <TimelineTimeSelection range={selectedTime.range} />
                        ) : null}
                        {automationOf(track).envelope}
                        <TimelinePlayhead />
                      </TimelineLane>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-auto min-w-48">
                      <TimelineGridMenuItems
                        division={grid.division}
                        divisions={GRID_DIVISION_OPTIONS}
                        onDivisionChange={grid.chooseDivision}
                        onSnapChange={grid.setSnap}
                        onTripletChange={grid.setTriplet}
                        snap={snap}
                        triplet={grid.triplet}
                      />
                    </ContextMenuContent>
                  </ContextMenu>
                </Row>
              </div>
            ))}
            <Row
              className="sticky bottom-0 z-30 border-foreground/25 border-b bg-background"
              lead={
                <div className="m-1 flex min-w-0 flex-1 gap-1">
                  <Button
                    className="min-w-0 flex-1 justify-start gap-1.5"
                    onClick={handleAddTrack}
                    size="sm"
                    variant="ghost"
                  >
                    <IconPlaceholder
                      hugeicons="PlusSignIcon"
                      lucide="PlusIcon"
                      phosphor="PlusIcon"
                      remixicon="RiAddLine"
                      tabler="IconPlus"
                    />
                    Audio
                  </Button>
                  <Button
                    className="min-w-0 flex-1 justify-start gap-1.5"
                    onClick={handleAddMidiTrack}
                    size="sm"
                    variant="ghost"
                  >
                    <IconPlaceholder
                      hugeicons="PlusSignIcon"
                      lucide="PlusIcon"
                      phosphor="PlusIcon"
                      remixicon="RiAddLine"
                      tabler="IconPlus"
                    />
                    MIDI
                  </Button>
                </div>
              }
            >
              <TimelineLane
                className="h-10 border-b-0 bg-background"
                gridStep={snapStep}
              />
            </Row>
            {/* The surface carries on to the bottom of the view, so the arrangement does not stop at the last track. */}
            <Row className="flex-1" lead={<div className="h-full" />}>
              <TimelineLane
                className="h-auto flex-1 border-b-0 bg-background"
                gridStep={snapStep}
                onPointerDown={focusPanel}
                seekable
              >
                <TimelinePlayhead />
              </TimelineLane>
            </Row>
          </div>
        </TimelineViewport>
        {marquee.rect
          ? // In the page's body: a dialog is transformed, which would make a fixed rectangle its own.
            createPortal(
              <div
                aria-hidden="true"
                className="pointer-events-none fixed z-50 border border-primary bg-primary/10"
                style={marquee.rect}
              />,
              document.body
            )
          : null}
      </Timeline>
      {clipViewOpen ? (
        <ClipDock
          bar={bar}
          beatsPerBar={tempo.beatsPerBar}
          clip={editedClip}
          collapsed={clipViewCollapsed}
          foldedBoxes={clipBoxesFolded}
          format={describe}
          midi={midiEditing}
          onActiveChange={setEditedActive}
          onClose={closeClipView}
          onCollapsedChange={setClipViewCollapsed}
          onCrop={cropEdited}
          onFoldedBoxesChange={setClipBoxesFolded}
          onRename={arrangedClips.onRename}
          onValueChange={changeClipSettings}
          onValueCommitted={settleClipEdit}
          peaks={editedPeaks}
        />
      ) : null}
      <TrackReorderGhost
        className={
          ghostTrack ? TRACK_COLORS[mixOf(ghostTrack).color]?.edge : undefined
        }
        ghost={reorder.ghost}
        ghostRef={reorder.ghostRef}
        trackName={ghostTrack?.name}
      />
    </div>
  );
}
