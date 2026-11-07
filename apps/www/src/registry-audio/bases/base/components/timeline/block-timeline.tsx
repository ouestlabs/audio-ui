"use client";

import { computePeaks, normalizePeaks } from "@audio-ui/core/analysis";
import {
  barsBeatsWith,
  type MetronomeRhythm,
  secondsPerBar,
  type Tempo,
} from "@audio-ui/core/time";
import { EnvelopeIcon } from "@audio-ui/icons/react";
import {
  type ComponentProps,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
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
import { ArrangementView } from "@/registry-audio/bases/base/audio/elements/arrangement-view";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { ParameterField } from "@/registry-audio/bases/base/audio/elements/parameter-field";
import { TRACK_COLORS } from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import {
  ClipPanel,
  type ClipSettings,
} from "@/registry-audio/bases/base/audio/panels/clip-panel";
import {
  MidiClipPanel,
  type MidiClipRegion,
} from "@/registry-audio/bases/base/audio/panels/midi-clip-panel";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import { useTimeSelection } from "@/registry-audio/bases/base/hooks/use-time-selection";
import { useTimelineCursor } from "@/registry-audio/bases/base/hooks/use-timeline-cursor";
import {
  GRID_KEYS,
  useTimelineGrid,
} from "@/registry-audio/bases/base/hooks/use-timeline-grid";
import { useTimelineMarkers } from "@/registry-audio/bases/base/hooks/use-timeline-markers";
import { useTimelineZoom } from "@/registry-audio/bases/base/hooks/use-timeline-zoom";
import { useTrackAutomation } from "@/registry-audio/bases/base/hooks/use-track-automation";
import {
  type Arranged,
  type ArrangementTrack,
  analyzeBeat,
  NEW_TRACK,
  type TimeSelection,
  type TrackKind,
  UNITY_MIX,
  warpOnImport,
} from "@/registry-audio/bases/base/lib/arrangement";
import { renderTrackClips } from "@/registry-audio/bases/base/lib/arrangement-engine";
import { audioClipsIn } from "@/registry-audio/bases/base/lib/arrangement-state";
import { decodeAudioChannels } from "@/registry-audio/bases/base/lib/audio-decode";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  renderSongPart,
  SONG_RECORDINGS,
  SONG_SCORE,
  SONG_TEMPO,
  type SongNote,
  type SongPart,
  type SongScorePart,
} from "@/registry-audio/bases/base/lib/demo-song";
import {
  monoSynthDevice,
  monoSynthPreset,
} from "@/registry-audio/bases/base/lib/mono-synth-device";
import { organDevice } from "@/registry-audio/bases/base/lib/organ-device";
import { reverbDevice } from "@/registry-audio/bases/base/lib/reverb-device";
import {
  stringMachineDevice,
  stringMachinePreset,
} from "@/registry-audio/bases/base/lib/string-machine-device";
import { tapeKeysDevice } from "@/registry-audio/bases/base/lib/tape-keys-device";
import { vibeDevice } from "@/registry-audio/bases/base/lib/vibe-device";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const BARS = 24;

/** No device library here: the arrangement takes no device. */
const noDevice = () => undefined;

const NO_READING: readonly {
  at: number;
  key: number;
  name: string;
  track: string;
}[] = [];

/** The arrangement is laid out at the song's tempo: a tempo change keeps its musical positions. */
const BAR = secondsPerBar(SONG_TEMPO);
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

/** The song's parts, in order, and the bar each starts on. */
const PARTS = [
  { at: 0, id: "intro", name: "Intro" },
  { at: 4, id: "verse", name: "Verse" },
  { at: 12, id: "chorus", name: "Chorus" },
  { at: 20, id: "outro", name: "Outro" },
] as const;

/** The named points the timeline starts with: the parts of the song. */
const LOCATORS = PARTS.map(({ at, id, name }) => ({ at: bars(at), id, name }));

/** The loop it starts with, switched on: the whole song, whose outro leads back into its intro. */
const LOOP = { on: true, range: [0, bars(BARS)] } as const;

/** A device on a chain, at its own defaults with `patch` over them. */
const device = <State extends object>(
  id: string,
  described: { defaults: () => State; id: string },
  patch: Partial<State> = {},
  instrument = false
) => ({
  device: described.id,
  id,
  ...(instrument ? { instrument: true } : {}),
  state: { ...described.defaults(), ...patch },
});

const REVERB = "return-1";

/**
 * The song as a project: its drums and its strummed guitar as audio tracks,
 * its bass, its organ, its lead and its pad as MIDI tracks played by the
 * registry's instruments (a mono synth's sub bass, a tonewheel organ on three
 * drawbars, a tape keyboard's flutes on the lead and a string machine's
 * swell), a vibe on the
 * guitar's chain, and a reverb on a return track the organ, the guitar, the
 * lead and the pad send to.
 */
const TRACKS: ArrangementTrack[] = [
  {
    color: 0,
    id: "drums",
    // Its kick is the loudest hit of the song: under unity, the drums sit back and the main keeps its headroom.
    mix: { ...UNITY_MIX, gain: 10 ** (-4 / 20) },
    name: "Drums",
  },
  {
    color: 1,
    devices: [
      device(
        "bass-synth",
        monoSynthDevice,
        { ...monoSynthPreset("Sub Bass"), volume: 7 },
        true
      ),
    ],
    id: "bass",
    kind: "midi",
    name: "Bass",
  },
  {
    color: 2,
    devices: [
      device(
        "organ",
        organDevice,
        {
          click: 1,
          drawbar1: 0,
          drawbar2: 0,
          drawbar3: 8,
          drawbar4: 6,
          drawbar5: 5,
          drive: 1,
          rotary: "slow",
          volume: 6,
        },
        true
      ),
    ],
    id: "organ",
    kind: "midi",
    name: "Organ",
    sends: { [REVERB]: 0.25 },
  },
  {
    color: 3,
    devices: [device("guitar-vibe", vibeDevice)],
    id: "guitar",
    mix: { ...UNITY_MIX, gain: 10 ** (-5 / 20) },
    name: "Guitar",
    sends: { [REVERB]: 0.35 },
  },
  {
    color: 4,
    devices: [
      device(
        "lead-flutes",
        tapeKeysDevice,
        { station: "flutes", volume: 8.4 },
        true
      ),
    ],
    id: "lead",
    kind: "midi",
    name: "Lead",
    sends: { [REVERB]: 0.3 },
  },
  {
    color: 1,
    devices: [
      device(
        "pad-strings",
        stringMachineDevice,
        stringMachinePreset("Swell"),
        true
      ),
    ],
    id: "pad",
    kind: "midi",
    // A bed under the band, felt more than heard.
    mix: { ...UNITY_MIX, gain: 10 ** (-6 / 20) },
    name: "Pad",
    sends: { [REVERB]: 0.4 },
  },
];

const RETURNS: ArrangementTrack[] = [
  {
    color: 0,
    devices: [device("reverb", reverbDevice, { mix: 100 })],
    id: REVERB,
    name: "A Reverb",
  },
];

const NO_ANALYSERS: readonly AnalyserNode[] = [];
const NO_PEAKS: number[] = [];

/** What a meter shows before the engine runs. */
const SILENCE = {
  getSnapshot: () => ({ levels: [-60, -60], peaks: [-60, -60] }),
  subscribe: () => () => undefined,
};

const BEAT = BAR / 4;

/** The edges of a clip from bar `from` to bar `to`. */
const placedAt = (from: number, to: number) => ({
  fadeIn: 0,
  fadeOut: 0,
  length: bars(to - from),
  offset: 0,
  start: bars(from),
});

/** The song's notes as a MIDI clip holds them: in seconds, at the song's tempo. */
const notesOf = (notes: readonly SongNote[]): Arranged["notes"] =>
  notes.map(({ length, pitch, start, velocity }, index) => ({
    id: `n${index}`,
    length: length * BEAT,
    pitch,
    start: start * BEAT,
    velocity,
  }));

/** A take of the song: a recording an audio clip loops, or notes a MIDI clip loops. Its track is the word before its dash. */
type Take = SongPart | SongScorePart;

const isRecording = (take: Take): take is SongPart => take in SONG_RECORDINGS;

/** How many bars a take lasts before it loops: a score's, up to the bar its last note ends in. */
const barsOf = (take: Take) =>
  isRecording(take)
    ? SONG_RECORDINGS[take]
    : Math.ceil(
        Math.max(...SONG_SCORE[take].map((note) => note.start + note.length)) /
          4
      );

/** A clip of `take` from bar `from` to bar `to`, on its track, looping it. */
function clipOf(
  id: string,
  name: string,
  take: Take,
  from: number,
  to: number
) {
  const loop = bars(barsOf(take));
  const clip: Arranged = {
    id,
    loop: [0, loop],
    name,
    sourceLength: loop,
    track: take.split("-")[0] ?? take,
    value: placedAt(from, to),
  };
  return isRecording(take)
    ? { ...clip, recording: take }
    : { ...clip, notes: notesOf(SONG_SCORE[take]) };
}

/**
 * What each part of the song plays, all of it on the same loop. The organ and
 * the guitar open it, the verse brings in the drums and the bass, the chorus
 * is the whole band, harder, under the lead's hook, and the organ and the
 * guitar close it, back where the song started.
 */
const PLAYS: Record<(typeof PARTS)[number]["id"], readonly Take[]> = {
  chorus: ["drums-chorus", "bass-chorus", "organ", "guitar-chorus", "lead"],
  intro: ["organ", "guitar-verse"],
  outro: ["organ", "guitar-verse"],
  verse: ["drums-verse", "bass-verse", "guitar-verse"],
};

/**
 * The song's clips, each named after the part it plays in. The bar before
 * each chorus ends on a snare roll, in place of the part's own drums.
 */
const CLIPS: Arranged[] = [
  ...PARTS.flatMap((part, index) => {
    const end = PARTS[index + 1]?.at ?? BARS;
    const fill = PARTS[index + 1]?.id === "chorus";
    const clips = PLAYS[part.id].map((take) =>
      clipOf(
        `${part.id}-${take}`,
        part.name,
        take,
        part.at,
        fill && take.startsWith("drums-") ? end - 1 : end
      )
    );
    return fill
      ? [
          ...clips,
          clipOf(`${part.id}-fill`, "Fill", "drums-fill", end - 1, end),
        ]
      : clips;
  }),
  // The pad swells in on the third bar and holds to the end: each time round, the song opens without it.
  clipOf("pad", "Pad", "pad", 2, BARS),
];

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
  position,
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
  /** The arrangement's position, live, which an audio clip's panel shows where it plays. */
  position: ComponentProps<typeof ClipPanel>["position"];
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
      position={position}
      start={clip.value.start}
      value={{
        gain: clip.gain ?? 0,
        length: clip.value.length,
        loop: clip.loop ?? null,
        offset: clip.value.offset,
        reversed: Boolean(clip.reversed),
        sourceLength: clip.sourceLength,
        transpose: clip.transpose ?? 0,
        warpMode: clip.warpMode,
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
 * The recordings the audio clips play, by id: the song's drums and guitar,
 * drawn once at the engine's rate, and the files dropped on the tracks, which
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
    for (const part of Object.keys(SONG_RECORDINGS) as SongPart[]) {
      renderSongPart(part, context.sampleRate).then((buffer) => {
        if (!cancelled) {
          setRecordings((current) =>
            new Map(current).set(
              part,
              recordingOf(channelsOf(buffer), context.sampleRate)
            )
          );
        }
      });
    }
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
  const arrangement = useArrangement({
    colors: TRACK_COLORS.length,
    duration: BARS * BAR,
    initialClips: CLIPS,
    initialLocators: LOCATORS,
    initialLoop: LOOP,
    initialReturns: RETURNS,
    initialTracks: TRACKS,
    tempo: SONG_TEMPO,
  });
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
    copyOf,
    selectedIds,
    selectedTracks,
    selection,
    tracks,
  } = arrangement;
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
  const _selectClips = useCallback(
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
  const { clear: letGoOfTime, time: selectedTime } = timeSelection;
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
  const _moveTrack = useCallback(
    (id: string, index: number) => dispatch({ type: "move-track", id, index }),
    [dispatch]
  );
  const redo = useCallback(() => dispatch({ type: "redo" }), [dispatch]);
  const removeTrack = useCallback(
    (id: string) => dispatch({ type: "remove-track", id }),
    [dispatch]
  );
  const _renameTrack = useCallback(
    (id: string, name: string) => dispatch({ type: "rename-track", id, name }),
    [dispatch]
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), [dispatch]);
  // The timeline fits the width it is given until it is zoomed, and its grid follows the zoom.
  const viewportRef = useRef<HTMLDivElement>(null);
  const view = useTimelineZoom({ duration, viewportRef });
  const { zoom } = view;
  const grid = useTimelineGrid({ tempo, zoom });
  const { snapStep, step: gridSeconds } = grid;
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
  const _handleAddTrack = useCallback(() => addTrack(), [addTrack]);
  const _handleAddMidiTrack = useCallback(
    () => addTrack(undefined, "midi"),
    [addTrack]
  );
  // Multi-select: a press on a clip adds it to the selection, and a drag on bare lane draws a rectangle. For touch, which has no Shift.
  const [multi, setMulti] = useState(false);
  // A touch screen has no Shift: in multi-select mode every press on a header adds to the tracks picked.
  const _pickTrack = useCallback(
    (id: string, additive: boolean) => selectTrack(id, additive || multi),
    [multi, selectTrack]
  );
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
  const changeZoomPreset = useCallback(
    (value: string) => changeZoom(Number(value)),
    [changeZoom]
  );
  // A press on a track puts the keys back on the panel, which catches them: the lane takes no focus.
  const focusTrack = useCallback(
    (id: string) => {
      selectTrack(id);
      panelRef.current?.focus({
        focusVisible: false,
        preventScroll: true,
      } as FocusOptions);
    },
    [selectTrack]
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
  // What each audio clip draws of its recording, once the recording is there.
  const peaksOf = useCallback(
    (clip: Arranged) => {
      const recording = clip.recording
        ? recordings.get(clip.recording)
        : undefined;
      return recording ? recordedPeaks(recording, clip) : undefined;
    },
    [recordings]
  );
  // The clip panel, under the tracks: it edits the first selected clip.
  const editedClip = clips.find((clip) => clip.id === selectedIds[0]);
  const editedPeaks = useMemo(
    () => (editedClip && peaksOf(editedClip)) ?? NO_PEAKS,
    [editedClip, peaksOf]
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
    (trackId: string, start: number) => {
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
    [addClip, bar, letGoOfTime]
  );
  const renameClip = useCallback(
    (id: string, name: string) => dispatch({ type: "rename-clip", id, name }),
    [dispatch]
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
          warpMode: next.warpMode,
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
  // A file with a beat is warped in time at the arrangement's tempo (CLP-019).
  const fileCount = useRef(0);
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
      // Under the headers, each file makes a track of its own, from the start; on a track, they follow one another.
      const own = trackId === NEW_TRACK;
      let at = start;
      for (const [index, file] of files.entries()) {
        const channels = decoded[index];
        const length = (channels?.[0]?.length ?? 0) / context.sampleRate;
        const onto = own ? addTrack(undefined, "audio")?.id : trackId;
        if (!(channels && onto && length > 0 && at < duration)) {
          continue;
        }
        fileCount.current += 1;
        const id = `file${fileCount.current}`;
        keepRecording(id, recordingOf(channels, context.sampleRate));
        const clip = warpOnImport(
          {
            id,
            name: file.name.replace(EXTENSION, ""),
            recording: id,
            sourceLength: length,
            track: onto,
            value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: at },
          },
          analyzeBeat(channels, context.sampleRate),
          tempo
        );
        addClip({
          ...clip,
          value: {
            ...clip.value,
            length: Math.min(clip.value.length, duration - at),
          },
        });
        selectClip(id, false);
        at += own ? 0 : clip.value.length;
      }
    },
    [addClip, addTrack, duration, keepRecording, selectClip, tempo]
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
  const _changeLoop = useCallback(
    (range: readonly [number, number]) =>
      dispatch({ type: "change-loop", range }),
    [dispatch]
  );
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
            <ParameterField
              className="w-44"
              format={PERCENT}
              hideLabel
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
                        <ParameterField
                          className="w-44"
                          format={PERCENT}
                          hideLabel
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
      <ArrangementView
        arrangement={arrangement}
        automation={automation}
        engine={engine}
        findDevice={noDevice}
        getCursor={getPosition}
        liveTake={null}
        markers={markers}
        multiSelect={multi}
        onAddMidiClip={addMidiClipAt}
        onEditClip={openClipView}
        onFiles={addFiles}
        onSeek={seek}
        onSelectTrack={focusTrack}
        peaksOf={peaksOf}
        reading={NO_READING}
        selectedTrack={selectedTracks[0] ?? null}
        timelineGrid={grid}
        timelineZoom={view}
        timeSelection={timeSelection}
        viewportRef={viewportRef}
      />
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
          onRename={renameClip}
          onValueChange={changeClipSettings}
          onValueCommitted={settleClipEdit}
          peaks={editedPeaks}
          position={clock}
        />
      ) : null}
    </div>
  );
}
