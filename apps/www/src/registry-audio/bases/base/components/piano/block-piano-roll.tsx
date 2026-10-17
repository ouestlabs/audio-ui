"use client";

import {
  encodeMidiFile,
  type MidiFileNote,
  parseMidiFile,
} from "@audio-ui/core/midi";
import {
  chopNotes,
  fitNotesToScale,
  humanizeNotes,
  invertNotes,
  joinNotes,
  legatoNotes,
  type NoteId,
  quantizeNotes,
  type RollBounds,
  rampVelocity,
  reverseNotes,
  splitNotes,
  stretchNotes,
} from "@audio-ui/core/piano-roll";
import {
  pitchClassName,
  SCALES,
  type Scale,
  type ScaleName,
} from "@audio-ui/core/pitch";
import type { Tempo } from "@audio-ui/core/time";
import {
  createSource,
  type PianoRoll as PianoRollPrimitive,
} from "@audio-ui/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
  PianoRollStrip,
  PianoRollVelocity,
  PianoRollVelocityScale,
  PianoRollViewport,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { Transport } from "@/registry-audio/bases/base/audio/elements/transport";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import {
  type UseSynthVoicesReturn,
  useSynthVoices,
} from "@/registry-audio/bases/base/hooks/use-synth-voices";
import {
  type TransportRegion,
  useTransportClock,
} from "@/registry-audio/bases/base/hooks/use-transport-clock";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/envelope-ramp";
import {
  beginChange,
  canRedo,
  canUndo,
  emptyHistory,
  type History,
  recordChange,
  redo,
  settleChange,
  undo,
} from "@/registry-audio/bases/base/lib/undo-history";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** C2 to C6: more than fits, so the roll scrolls and opens on middle C. */
const MIN_PITCH = 36;
const MAX_PITCH = 84;
const DEFAULT_VOLUME = 0.7;
/** A step is a sixteenth note whatever the signature: BPM counts quarter notes. */
const STEPS_PER_QUARTER = 4;
/** The clip is four bars long, in whatever signature it is in. */
const BARS = 4;
/** The widest a step gets, in px: zoomed in all the way, a beat still shows its steps. */
const MAX_ZOOM = 64;
/** The room a ruler label needs, in px: bars, beats and sixteenths each get labels once they are this far apart. */
const LABEL_SPACING = 40;
/** The shortest a note gets from an edit: one step, the grid's. */
const MIN_LENGTH = 1;

const describeStep = (step: number) => `Step ${Math.floor(step) + 1}`;
/** "C4, step 5, 2 steps": where a note is, in the grid's own terms. */
const describeNote = (note: Note) =>
  `${pitchClassName(note.pitch)}${Math.floor(note.pitch / 12) - 1}, step ${note.start + 1}, ${note.length} ${note.length === 1 ? "step" : "steps"}`;
/** Standard MIDI File resolution, ticks per quarter note, a common round value shared by most DAWs' own exports. */
const MIDI_TICKS_PER_QUARTER_NOTE = 480;
const MICROSECONDS_PER_MINUTE = 60_000_000;
const MIDI_FILE_ACCEPT = ".mid,.midi,audio/midi,audio/x-midi";
const MIN_BPM = 20;
const MAX_BPM = 200;

/** ADSR-shaped, matching the Envelope primitive's own default, this block doesn't expose an editable envelope, keeping it focused on the note grid. */
const DEFAULT_ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

const SCALE_LABELS: Record<ScaleName, string> = {
  blues: "Blues",
  chromatic: "Chromatic",
  dorian: "Dorian",
  "harmonic-minor": "Harmonic minor",
  locrian: "Locrian",
  lydian: "Lydian",
  major: "Major",
  "major-pentatonic": "Major pentatonic",
  "melodic-minor": "Melodic minor",
  minor: "Minor",
  "minor-pentatonic": "Minor pentatonic",
  mixolydian: "Mixolydian",
  phrygian: "Phrygian",
};
const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];
const ROOTS = Array.from({ length: 12 }, (_, root) => root);

type Note = PianoRollPrimitive.Root.Note;
type LoopRegion = TransportRegion;

/** Where bars and beats fall, in steps, for a signature: 6/8 has beats of two steps and bars of twelve. */
interface Meter {
  /** The clip's length in steps: `BARS` bars. */
  duration: number;
  stepsPerBar: number;
  stepsPerBeat: number;
}

function meterOf(tempo: Tempo): Meter {
  const stepsPerBeat = (STEPS_PER_QUARTER * 4) / tempo.beatUnit;
  const stepsPerBar = stepsPerBeat * tempo.beatsPerBar;
  return { duration: BARS * stepsPerBar, stepsPerBar, stepsPerBeat };
}

interface RulerMark {
  label: string;
  level: "bar" | "beat" | "step";
  step: number;
}

const DEPTH = { bar: 1, beat: 2, step: 3 } as const;

/** Where a step falls in its bar and beat, and which of the three it starts. */
function placeOf(step: number, meter: Meter) {
  const bar = Math.floor(step / meter.stepsPerBar);
  const inBar = step % meter.stepsPerBar;
  const beat = Math.floor(inBar / meter.stepsPerBeat);
  const inBeat = inBar % meter.stepsPerBeat;
  let level: RulerMark["level"] = "step";
  if (inBar === 0) {
    level = "bar";
  } else if (inBeat === 0) {
    level = "beat";
  }
  const label = [bar + 1, beat + 1, inBeat + 1]
    .slice(0, DEPTH[level])
    .join(".");
  return { bar, label, level };
}

/**
 * The ruler's labels at `unit` px a step: every bar, then every beat (1.2),
 * then every sixteenth (1.2.3), each once they are `LABEL_SPACING` apart.
 * Zoomed out further than bars allow, every second or fourth bar.
 */
function rulerMarks(unit: number, meter: Meter): RulerMark[] {
  let barEvery = 1;
  while (
    barEvery * meter.stepsPerBar * unit < LABEL_SPACING &&
    barEvery < BARS
  ) {
    barEvery *= 2;
  }
  const shown = {
    bar: true,
    beat: meter.stepsPerBeat * unit >= LABEL_SPACING,
    step: unit >= LABEL_SPACING,
  };
  const marks: RulerMark[] = [];
  for (let step = 0; step < meter.duration; step += 1) {
    const { bar, label, level } = placeOf(step, meter);
    if (shown[level] && (level !== "bar" || bar % barEvery === 0)) {
      marks.push({ label, level, step });
    }
  }
  return marks;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A short click on the beat, higher on the first of a bar, scheduled at `time` on the audio clock. */
function scheduleClick(destination: AudioNode, time: number, accent: boolean) {
  const { context } = destination;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(accent ? 1500 : 1000, time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.4, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  oscillator.connect(gain).connect(destination);
  oscillator.start(time);
  oscillator.stop(time + 0.06);
}

/** Quantizes a parsed MIDI file's tick-based notes onto the clip's steps, adopting the file's own tempo (clamped to the BPM range); notes starting past the clip's end are dropped. */
function notesFromMidiFile(
  parsed: {
    microsecondsPerQuarterNote: number;
    notes: MidiFileNote[];
    ticksPerQuarterNote: number;
  },
  duration: number
): { bpm: number; notes: Note[] } {
  const bpm = clamp(
    Math.round(MICROSECONDS_PER_MINUTE / parsed.microsecondsPerQuarterNote),
    MIN_BPM,
    MAX_BPM
  );
  const ticksPerStep = parsed.ticksPerQuarterNote / STEPS_PER_QUARTER;

  const notes: Note[] = [];
  for (const midiNote of parsed.notes) {
    const start = Math.round(midiNote.startTick / ticksPerStep);
    if (start < 0 || start >= duration) {
      continue;
    }
    const length = clamp(
      Math.round(midiNote.durationTicks / ticksPerStep),
      1,
      duration - start
    );
    notes.push({
      id: `midi-import-${notes.length}`,
      length,
      pitch: clamp(midiNote.note, MIN_PITCH, MAX_PITCH),
      start,
      velocity: clamp(midiNote.velocity, 0, 1),
    });
  }
  return { bpm, notes };
}

/** The clip's steps converted to MIDI ticks at a fixed, common resolution, the inverse of `notesFromMidiFile`. */
function notesToMidiFile(notes: Note[], bpm: number): Uint8Array {
  const ticksPerStep = MIDI_TICKS_PER_QUARTER_NOTE / STEPS_PER_QUARTER;
  const midiNotes: Omit<MidiFileNote, "track">[] = notes.map((note) => ({
    channel: 0,
    durationTicks: Math.round(note.length * ticksPerStep),
    note: note.pitch,
    startTick: Math.round(note.start * ticksPerStep),
    velocity: note.velocity ?? 1,
  }));
  return encodeMidiFile({
    bpm,
    notes: midiNotes,
    ticksPerQuarterNote: MIDI_TICKS_PER_QUARTER_NOTE,
  });
}

/** Saves the notes as a `.mid` file. */
function downloadMidiFile(notes: Note[], bpm: number) {
  const bytes = notesToMidiFile(notes, bpm);
  // `Uint8Array`'s `.buffer` types as `ArrayBufferLike` (which also covers
  // `SharedArrayBuffer`) while `BlobPart` wants a concrete `ArrayBuffer`,
  // safe here since `encodeMidiFile` always builds a fresh, non-shared one.
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "piano-roll.mid";
  link.click();
  URL.revokeObjectURL(url);
}

interface EditContext {
  /** Where the playhead is, in steps. */
  at: number;
  bounds: RollBounds;
  /** Where the loop ends, in steps: what legato stretches the last notes to. */
  loopEnd: number;
  nextId: () => NoteId;
  scale: Scale | null;
  /** Whether notes are selected, rather than the edit taking every note. */
  selected: boolean;
}

/** Every step of a clip: the times a chop to the grid cuts at. */
const gridLines = (duration: number) =>
  Array.from({ length: duration }, (_, step) => step);

interface NoteEdit {
  edit: (notes: Note[], ids: Set<NoteId>, context: EditContext) => Note[];
  id: string;
  label: string;
  shortcut?: string;
}

/** What the Notes menu does to the selected notes, or to every note with none selected. */
const TIME_EDITS: NoteEdit[] = [
  {
    // Selected notes chop on the grid; with none, the notes crossing the playhead split there.
    edit: (notes, ids, { at, bounds, nextId, selected }) =>
      splitNotes(notes, ids, selected ? gridLines(bounds.duration) : at, nextId)
        .notes,
    id: "split",
    label: "Split",
    shortcut: "⌘E",
  },
  {
    edit: (notes, ids, { nextId }) =>
      chopNotes(notes, ids, 2, nextId, MIN_LENGTH).notes,
    id: "chop",
    label: "Chop in two",
  },
  {
    edit: (notes, ids) => joinNotes(notes, ids),
    id: "join",
    label: "Join",
    shortcut: "⌘J",
  },
  {
    edit: (notes, ids, { bounds }) =>
      quantizeNotes(notes, ids, Math.round, bounds),
    id: "quantize",
    label: "Quantize",
    shortcut: "⌘U",
  },
  {
    edit: (notes, ids, { loopEnd }) =>
      legatoNotes(notes, ids, MIN_LENGTH, loopEnd),
    id: "legato",
    label: "Legato",
  },
  {
    edit: (notes, ids) => reverseNotes(notes, ids),
    id: "reverse",
    label: "Reverse",
  },
  {
    edit: (notes, ids, { bounds }) => stretchNotes(notes, ids, 2, bounds),
    id: "double",
    label: "Twice as long",
  },
  {
    edit: (notes, ids, { bounds }) => stretchNotes(notes, ids, 0.5, bounds),
    id: "half",
    label: "Half as long",
  },
];
const PITCH_EDITS: NoteEdit[] = [
  {
    edit: (notes, ids) => invertNotes(notes, ids),
    id: "invert",
    label: "Invert",
  },
  {
    edit: (notes, ids, { bounds, scale }) =>
      scale ? fitNotesToScale(notes, ids, scale, bounds) : notes,
    id: "fit",
    label: "Fit to scale",
  },
];
const VELOCITY_EDITS: NoteEdit[] = [
  {
    edit: (notes, ids) => rampVelocity(notes, ids, 0.3, 1),
    id: "crescendo",
    label: "Crescendo",
  },
  {
    edit: (notes, ids) => rampVelocity(notes, ids, 1, 0.3),
    id: "decrescendo",
    label: "Decrescendo",
  },
  {
    edit: (notes, ids, { bounds }) =>
      humanizeNotes(notes, ids, { timing: 0.25, velocity: 0.15 }, bounds),
    id: "humanize",
    label: "Humanize",
  },
];
/** Cmd/Ctrl with a letter: the edits that have a key of their own. */
const EDITS_BY_KEY: Record<string, NoteEdit | undefined> = {
  e: TIME_EDITS.find((item) => item.id === "split"),
  j: TIME_EDITS.find((item) => item.id === "join"),
  u: TIME_EDITS.find((item) => item.id === "quantize"),
};

interface UsePianoRollOptions {
  destination: AudioNode | null;
  looping: boolean;
  loopRegion: LoopRegion | null;
  meter: Meter;
  metronome: boolean;
  releaseAll: UseSynthVoicesReturn["releaseAll"];
  releaseNote: UseSynthVoicesReturn["releaseNote"];
  tempo: Tempo;
  triggerNote: UseSynthVoicesReturn["triggerNote"];
}

/**
 * Owns the notes, plays the ones the roll auditions (a key pressed, a note
 * drawn or dragged), and wires the playback: play on from where it stopped,
 * stop back at the start, the loop or once through, and the metronome. The
 * drift-free look-ahead timing lives in `useTransportClock`; this hook only
 * schedules notes on its step boundaries and reads its position, so the audio
 * and the playhead come from one source.
 */
function usePianoRoll({
  destination,
  looping,
  loopRegion,
  meter,
  metronome,
  releaseAll,
  releaseNote,
  tempo,
  triggerNote,
}: UsePianoRollOptions) {
  // Looping off, the clip plays once, from its start to its end.
  const region =
    looping && loopRegion ? loopRegion : { end: meter.duration, start: 0 };

  const [notes, setNotes] = useState<Note[]>([]);
  const [playingPitches, setPlayingPitches] = useState<number[]>([]);

  // What the scheduler reads, outside React.
  const live = useRef({
    destination,
    looping,
    meter,
    metronome,
    notes,
    region,
  });
  live.current = { destination, looping, meter, metronome, notes, region };

  /** The playhead, in steps, for the timeline to follow outside React. */
  const [position] = useState(() => createSource(0));
  /** The same place in seconds, for the transport's bars, beats and sixteenths. */
  const [clock] = useState(() => createSource(0));
  /** The current tempo's step duration, mirrored from the transport clock so note-off offsets use its canonical step↔time mapping instead of a second copy. */
  const secondsPerStepRef = useRef(0);
  /** Mirrors the clock's `isPlaying` for the audition guard, which runs inside pointer callbacks rather than on render. */
  const isPlayingRef = useRef<boolean>(false);
  /** The pitches auditioned and not yet released. */
  const auditionedRef = useRef(new Set<number>());
  /** The last step scheduled, to tell when the clip comes back round to its start. */
  const lastStepRef = useRef(-1);
  /** When a clip played through ends, on the audio clock, once it has come back round: nothing more is scheduled. */
  const endsAtRef = useRef<number | null>(null);
  const endRef = useRef<() => void>(() => undefined);

  const moveTo = useCallback(
    (step: number) => {
      position.set(step);
      clock.set(step * secondsPerStepRef.current);
    },
    [clock, position]
  );

  /**
   * Plays what the roll auditions. While the clip plays, only the keys do:
   * the clip schedules its own notes ahead through the same voices, and an
   * edit sounding a pitch it has scheduled would cut it off.
   */
  const handleNoteOn = useCallback(
    (pitch: number, details: PianoRollPrimitive.Root.NoteOnEventDetails) => {
      const fromKeys = details.reason === "press" || details.reason === "glide";
      if (isPlayingRef.current && !fromKeys) {
        return;
      }
      auditionedRef.current.add(pitch);
      triggerNote(pitch, DEFAULT_ENVELOPE, details.velocity);
    },
    [triggerNote]
  );

  const handleNoteOff = useCallback(
    (pitch: number) => {
      if (auditionedRef.current.delete(pitch)) {
        releaseNote(pitch, DEFAULT_ENVELOPE);
      }
    },
    [releaseNote]
  );

  /** Played once through, the clip ends when the clock comes back round to its start: stop then, and schedule nothing more. */
  const reachedEnd = useCallback((step: number, time: number) => {
    if (endsAtRef.current !== null) {
      return true;
    }
    if (live.current.looping || step >= lastStepRef.current) {
      return false;
    }
    endsAtRef.current = time;
    const now = webAudio.getContext()?.currentTime ?? time;
    window.setTimeout(() => endRef.current(), Math.max(0, time - now) * 1000);
    return true;
  }, []);

  /** Fired on each step boundary the clock emits: the metronome's click on a beat, and every note starting within the step, at its own time inside it, so a note off the grid plays where it is. */
  const scheduleStep = useCallback(
    (step: number, time: number) => {
      if (reachedEnd(step, time)) {
        return;
      }
      lastStepRef.current = step;
      const { current } = live;
      const secondsPerStep = secondsPerStepRef.current;
      if (
        current.metronome &&
        current.destination &&
        step % current.meter.stepsPerBeat === 0
      ) {
        scheduleClick(
          current.destination,
          time,
          step % current.meter.stepsPerBar === 0
        );
      }
      for (const note of current.notes) {
        if (note.start < step || note.start >= step + 1) {
          continue;
        }
        const at = time + (note.start - step) * secondsPerStep;
        triggerNote(note.pitch, DEFAULT_ENVELOPE, note.velocity ?? 1, at);
        releaseNote(
          note.pitch,
          DEFAULT_ENVELOPE,
          at + note.length * secondsPerStep
        );
      }
    },
    [reachedEnd, releaseNote, triggerNote]
  );

  const reset = useCallback(() => {
    releaseAll();
    lastStepRef.current = -1;
    endsAtRef.current = null;
  }, [releaseAll]);

  const { getPosition, isPlaying, reanchor, secondsPerStep, start, stop } =
    useTransportClock({
      bpm: tempo.bpm,
      onReset: reset,
      onStep: scheduleStep,
      region,
      stepsPerBeat: STEPS_PER_QUARTER,
      totalSteps: meter.duration,
    });
  secondsPerStepRef.current = secondsPerStep;
  isPlayingRef.current = isPlaying;

  // A new tempo moves the seconds of a parked playhead, not its step.
  useEffect(() => {
    clock.set(position.getSnapshot() * secondsPerStep);
  }, [clock, position, secondsPerStep]);

  /** Plays on from the playhead, or from the start of the loop when the playhead is outside it. */
  const play = useCallback(() => {
    const { end, start: from } = live.current.region;
    const at = Math.floor(position.getSnapshot());
    start();
    if (at > from && at < end) {
      reanchor(at);
    }
  }, [position, reanchor, start]);

  /** Stops and goes back to the start of the loop, or of the clip. */
  const stopPlayback = useCallback(() => {
    stop();
    moveTo(live.current.region.start);
  }, [moveTo, stop]);
  endRef.current = stopPlayback;

  /** Fired when a change to the loop range ends: re-anchors so the new loop is heard now. No-op while stopped. */
  const commitLoopRegion = useCallback(() => {
    reanchor();
  }, [reanchor]);

  /** Fired when the ruler moves the playhead: plays from there, or parks it there when stopped. */
  const seekTo = useCallback(
    (step: number) => {
      const { end, start: from } = live.current.region;
      if (isPlayingRef.current) {
        reanchor(clamp(Math.floor(step), from, end - 1));
      } else {
        moveTo(clamp(step, 0, live.current.meter.duration));
      }
    },
    [moveTo, reanchor]
  );

  // Playhead + "which pitches are sounding" highlight, both derived from the
  // clock's continuous position (fractional steps), one source, so there is
  // no second note→time formula to keep in sync.
  useEffect(() => {
    if (!isPlaying) {
      setPlayingPitches([]);
      return;
    }
    let rafId: number;
    let lastSounding: number[] = [];
    const tick = () => {
      const at = getPosition();
      moveTo(at);
      const sounding = live.current.notes
        .filter((note) => at >= note.start && at < note.start + note.length)
        .map((note) => note.pitch);
      const changed =
        sounding.length !== lastSounding.length ||
        sounding.some((pitch, i) => pitch !== lastSounding[i]);
      if (changed) {
        lastSounding = sounding;
        setPlayingPitches(sounding);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [getPosition, isPlaying, moveTo]);

  return {
    clock,
    commitLoopRegion,
    handleNoteOff,
    handleNoteOn,
    isPlaying,
    notes,
    // Stopping where it is, to play on from there.
    pause: stop,
    play,
    playingPitches,
    position,
    seekTo,
    setNotes,
    stopPlayback,
  };
}

/** Undo and redo over the notes: a drag is one change, from where it started to where it was let go. */
function useNoteHistory(notes: Note[], setNotes: (notes: Note[]) => void) {
  const historyRef = useRef<History<Note[]>>(emptyHistory());
  const [history, setHistoryState] = useState(historyRef.current);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const setHistory = useCallback((next: History<Note[]>) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  /** An edit made in one go, from a menu or a key. */
  const edit = useCallback(
    (next: Note[]) => {
      setHistory(recordChange(historyRef.current, notesRef.current));
      setNotes(next);
    },
    [setHistory, setNotes]
  );
  /** Each step of a gesture on the roll: one change until it is committed. */
  const change = useCallback(
    (next: Note[]) => {
      setHistory(beginChange(historyRef.current, notesRef.current));
      setNotes(next);
    },
    [setHistory, setNotes]
  );
  const commit = useCallback(
    () => setHistory(settleChange(historyRef.current)),
    [setHistory]
  );
  const undoNotes = useCallback(() => {
    const step = undo(historyRef.current, notesRef.current);
    if (step) {
      setHistory(step.history);
      setNotes(step.present);
    }
  }, [setHistory, setNotes]);
  const redoNotes = useCallback(() => {
    const step = redo(historyRef.current, notesRef.current);
    if (step) {
      setHistory(step.history);
      setNotes(step.present);
    }
  }, [setHistory, setNotes]);

  return {
    canRedo: canRedo(history),
    canUndo: canUndo(history),
    change,
    commit,
    edit,
    redo: redoNotes,
    undo: undoNotes,
  };
}

/** The ruler's labels follow the zoom: the grid's width over its steps is the px a step takes. */
function useStepWidth(duration: number) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [unit, setUnit] = useState(0);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setUnit((entry?.contentRect.width ?? 0) / duration);
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, [duration]);
  return { gridRef, unit };
}

const scaleName = (scale: Scale) =>
  `${pitchClassName(scale.root)} ${SCALE_LABELS[scale.name]}`;

/** The root and the scale the rows are marked in, and whether they are. */
function ScaleMenu({
  enabled,
  limited,
  onEnabledChange,
  onLimitedChange,
  onScaleChange,
  scale,
}: {
  enabled: boolean;
  limited: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onLimitedChange: (limited: boolean) => void;
  onScaleChange: (scale: Scale) => void;
  scale: Scale;
}) {
  const changeRoot = useCallback(
    (root: number) => {
      onScaleChange({ ...scale, root });
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange, scale]
  );
  const changeName = useCallback(
    (name: ScaleName) => {
      onScaleChange({ ...scale, name });
      onEnabledChange(true);
    },
    [onEnabledChange, onScaleChange, scale]
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Scale: ${enabled ? scaleName(scale) : "off"}`}
            variant={enabled ? "default" : "outline"}
          />
        }
      >
        {enabled ? scaleName(scale) : "Scale"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-48">
        <DropdownMenuCheckboxItem
          checked={enabled}
          onCheckedChange={onEnabledChange}
        >
          Mark the scale
          <DropdownMenuShortcut>K</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={limited}
          onCheckedChange={onLimitedChange}
        >
          Only its rows
          <DropdownMenuShortcut>G</DropdownMenuShortcut>
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Root: {pitchClassName(scale.root)}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              onValueChange={changeRoot}
              value={scale.root}
            >
              {ROOTS.map((root) => (
                <DropdownMenuRadioItem key={root} value={root}>
                  {pitchClassName(root)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Scale: {SCALE_LABELS[scale.name]}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              onValueChange={changeName}
              value={scale.name}
            >
              {SCALE_NAMES.map((name) => (
                <DropdownMenuRadioItem key={name} value={name}>
                  {SCALE_LABELS[name]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One labelled group of the Notes menu's edits. */
function EditGroup({
  disabled,
  edits,
  label,
  onEdit,
}: {
  disabled: (item: NoteEdit) => boolean;
  edits: NoteEdit[];
  label: string;
  onEdit: (item: NoteEdit) => void;
}) {
  const handleClick = useCallback(
    (event: { currentTarget: HTMLElement }) => {
      const item = edits.find(
        (edit) => edit.id === event.currentTarget.dataset.edit
      );
      if (item) {
        onEdit(item);
      }
    },
    [edits, onEdit]
  );
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {edits.map((item) => (
        <DropdownMenuItem
          data-edit={item.id}
          disabled={disabled(item)}
          key={item.id}
          onClick={handleClick}
        >
          {item.label}
          {item.shortcut ? (
            <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
          ) : null}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/** The edits for the selection, or every note with none selected, then the file and clear commands. */
function NotesMenu({
  hasNotes,
  hasScale,
  onClear,
  onEdit,
  onExport,
  onImport,
}: {
  hasNotes: boolean;
  hasScale: boolean;
  onClear: () => void;
  onEdit: (item: NoteEdit) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const disabled = useCallback(
    (item: NoteEdit) => !hasNotes || (item.id === "fit" && !hasScale),
    [hasNotes, hasScale]
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        Notes
        <IconPlaceholder
          hugeicons="ArrowDown01Icon"
          lucide="ChevronDownIcon"
          phosphor="CaretDownIcon"
          remixicon="RiArrowDownSLine"
          tabler="IconChevronDown"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-52">
        <EditGroup
          disabled={disabled}
          edits={TIME_EDITS}
          label="Time"
          onEdit={onEdit}
        />
        <DropdownMenuSeparator />
        <EditGroup
          disabled={disabled}
          edits={PITCH_EDITS}
          label="Pitch"
          onEdit={onEdit}
        />
        <DropdownMenuSeparator />
        <EditGroup
          disabled={disabled}
          edits={VELOCITY_EDITS}
          label="Velocity"
          onEdit={onEdit}
        />
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onImport}>
            Import a MIDI file
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!hasNotes} onClick={onExport}>
            Export as a MIDI file
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!hasNotes}
            onClick={onClear}
            variant="destructive"
          >
            Clear
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Whether a key press belongs to a field or a menu, which keep their keys. */
function typedIntoControl(event: { target: EventTarget | null }) {
  const target = event.target as HTMLElement | null;
  return Boolean(
    target?.closest("input, textarea, select, [role=menu], [role=listbox]")
  );
}

/** Cuts the notes past a clip's new end: what a shorter signature leaves out. */
function notesWithin(notes: Note[], duration: number): Note[] {
  return notes
    .filter((note) => note.start < duration)
    .map((note) => ({
      ...note,
      length: Math.min(note.length, duration - note.start),
    }));
}

export default function BlockPianoRoll() {
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();
  const helpId = useId();

  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  /** Folded, only the pitches carrying notes get a row (F). */
  const [folded, setFolded] = useState(false);
  const toggleFolded = useCallback(() => setFolded((current) => !current), []);
  const [drawing, setDrawing] = useState(true);
  const toggleDrawing = useCallback(
    () => setDrawing((current) => !current),
    []
  );
  const [scaleOn, setScaleOn] = useState(false);
  /** Limited to the scale, only its rows and the notes' get a row (G): it marks the scale too. */
  const [scaleOnly, setScaleOnly] = useState(false);
  const toggleScaleOnly = useCallback((on: boolean) => {
    setScaleOnly(on);
    if (on) {
      setScaleOn(true);
    }
  }, []);
  const [scaleChoice, setScaleChoice] = useState<Scale>({
    name: "major",
    root: 0,
  });
  const scale = scaleOn ? scaleChoice : null;
  const [selection, setSelection] = useState<readonly NoteId[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Opens on middle C, halfway down the range.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
    }
  }, []);
  const [tempo, setTempo] = useState<Tempo>({
    beatsPerBar: 4,
    beatUnit: 4,
    bpm: 120,
  });
  const meter = useMemo(() => meterOf(tempo), [tempo]);
  const [looping, setLooping] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const loopRange: readonly [number, number] = loopRegion
    ? [loopRegion.start, loopRegion.end]
    : [0, meter.duration];
  /** The loop range moves freely under the pointer; the loop itself is in whole steps. */
  const changeLoopRegion = useCallback(
    ([start, end]: readonly [number, number]) => {
      setLoopRegion({ end: Math.round(end), start: Math.round(start) });
    },
    []
  );
  const masterGain = useMasterBus(volume);

  const { releaseAll, releaseNote, triggerNote } = useSynthVoices({
    destination: masterGain,
  });

  const {
    clock,
    commitLoopRegion,
    handleNoteOff,
    handleNoteOn,
    isPlaying,
    notes,
    pause,
    play,
    playingPitches,
    position,
    seekTo,
    setNotes,
    stopPlayback,
  } = usePianoRoll({
    destination: masterGain,
    looping,
    loopRegion,
    meter,
    metronome,
    releaseAll,
    releaseNote,
    tempo,
    triggerNote,
  });
  const history = useNoteHistory(notes, setNotes);

  // A MIDI keyboard plays the roll's voices and lights its keys, once the page's MIDI input is connected.
  const midiNoteOn = useCallback(
    (pitch: number, velocity: number) => {
      const ctx = webAudio.getContext();
      if (ctx?.state === "suspended") {
        ctx.resume();
      }
      triggerNote(pitch, DEFAULT_ENVELOPE, velocity);
    },
    [triggerNote]
  );
  const midiNoteOff = useCallback(
    (pitch: number) => releaseNote(pitch, DEFAULT_ENVELOPE),
    [releaseNote]
  );
  const midi = useMidiInput({ onNoteOff: midiNoteOff, onNoteOn: midiNoteOn });
  const activePitches = useMemo(
    () => [...playingPitches, ...midi.activeNotes],
    [midi.activeNotes, playingPitches]
  );

  /** A double-click on the loop goes back to looping the whole clip. */
  const clearLoopRegion = useCallback(() => {
    setLoopRegion(null);
    commitLoopRegion();
  }, [commitLoopRegion]);

  const playPause = isPlaying ? pause : play;

  /** A new signature lays the clip out in its own bars: notes past its new end go, and the loop goes back to the whole clip. */
  const changeTempo = useCallback(
    (next: Tempo) => {
      const { duration } = meterOf(next);
      if (duration !== meter.duration) {
        setLoopRegion(null);
        if (notes.some((note) => note.start + note.length > duration)) {
          history.edit(notesWithin(notes, duration));
        }
      }
      setTempo(next);
    },
    [history, meter.duration, notes]
  );

  const nextIdRef = useRef(0);
  const applyEdit = useCallback(
    (item: NoteEdit) => {
      const ids = new Set(
        selection.length > 0 ? selection : notes.map((note) => note.id)
      );
      const next = item.edit(notes, ids, {
        at: position.getSnapshot(),
        bounds: {
          duration: meter.duration,
          maxPitch: MAX_PITCH,
          minLength: MIN_LENGTH,
          minPitch: MIN_PITCH,
        },
        loopEnd: loopRegion?.end ?? meter.duration,
        nextId: () => {
          nextIdRef.current += 1;
          return `edit-${nextIdRef.current}`;
        },
        scale,
        selected: selection.length > 0,
      });
      history.edit(next);
    },
    [history, loopRegion, meter.duration, notes, position, scale, selection]
  );

  /** Selects the notes that are not selected, and deselects those that are. */
  const invertSelection = useCallback(() => {
    const selected = new Set(selection);
    setSelection(
      notes.filter((note) => !selected.has(note.id)).map((note) => note.id)
    );
  }, [notes, selection]);
  /** Cmd/Ctrl with Z undoes (with Shift, redoes), with Shift + A inverts the selection, with E, J and U split, join and quantize. */
  const commandKey = (key: string, shiftKey: boolean) => {
    if (key === "z") {
      if (shiftKey) {
        history.redo();
      } else {
        history.undo();
      }
      return true;
    }
    if (key === "a" && shiftKey) {
      invertSelection();
      return true;
    }
    const item = EDITS_BY_KEY[key];
    if (item && notes.length > 0) {
      applyEdit(item);
      return true;
    }
    return false;
  };
  /** B draws, F folds onto the notes, G limits the rows to the scale and K marks it. */
  const plainKeys: Record<string, (() => void) | undefined> = {
    b: toggleDrawing,
    f: toggleFolded,
    g: () => toggleScaleOnly(!scaleOnly),
    k: () => setScaleOn((current) => !current),
  };
  const plainKey = (key: string) => {
    const action = plainKeys[key];
    action?.();
    return action !== undefined;
  };
  /** The editor's keys, from anywhere inside it. */
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.altKey || typedIntoControl(event)) {
      return;
    }
    const key = event.key.toLowerCase();
    const handled =
      event.metaKey || event.ctrlKey
        ? commandKey(key, event.shiftKey)
        : plainKey(key);
    if (handled) {
      event.preventDefault();
    }
  };

  useEffect(() => {
    const handleSpace = (e: KeyboardEvent) => {
      // A note takes Space for itself, to select it.
      if (e.code !== "Space" || e.defaultPrevented) {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") {
        return;
      }
      e.preventDefault();
      playPause();
    };
    window.addEventListener("keydown", handleSpace);
    return () => window.removeEventListener("keydown", handleSpace);
  }, [playPause]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const importMidiFile = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      const imported = notesFromMidiFile(parseMidiFile(buffer), meter.duration);
      stopPlayback();
      history.edit(imported.notes);
      setTempo((current) => ({ ...current, bpm: imported.bpm }));
    },
    [history, meter.duration, stopPlayback]
  );

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) {
        importMidiFile(file);
      }
    },
    [importMidiFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) {
      return;
    }
    e.preventDefault();
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
      return;
    }
    setIsDraggingFile(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const [file] = e.dataTransfer.files;
      if (!file) {
        return;
      }
      e.preventDefault();
      setIsDraggingFile(false);
      importMidiFile(file);
    },
    [importMidiFile]
  );

  const handleExport = useCallback(
    () => downloadMidiFile(notes, tempo.bpm),
    [notes, tempo.bpm]
  );
  const clearNotes = useCallback(() => history.edit([]), [history]);

  const { gridRef, unit } = useStepWidth(meter.duration);
  const marks = useMemo(() => rulerMarks(unit, meter), [meter, unit]);

  return (
    <div
      className="cn-audio-panel @container/panel relative flex w-full min-w-0 flex-col gap-4 border bg-card p-4"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      role="group"
    >
      <input
        accept={MIDI_FILE_ACCEPT}
        className="sr-only"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file"
      />
      {isDraggingFile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-primary border-dashed bg-background/80 font-medium text-sm"
        >
          Drop a MIDI file to import
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 p-1">
        <Transport
          className="min-w-0 flex-1 flex-nowrap"
          looping={looping}
          metronome={metronome}
          onLoopingChange={setLooping}
          onMetronomeChange={setMetronome}
          onPlayPause={playPause}
          onStop={stopPlayback}
          onTempoChange={changeTempo}
          playing={isPlaying}
          source={clock}
          tempo={tempo}
        />
        <div className="flex shrink-0 items-center gap-2">
          <ButtonGroup className="hidden @3xl/panel:flex">
            <Button
              aria-label="Undo"
              disabled={!history.canUndo}
              onClick={history.undo}
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
              disabled={!history.canRedo}
              onClick={history.redo}
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
          <ButtonGroup>
            <Button
              aria-label="Draw"
              aria-pressed={drawing}
              onClick={toggleDrawing}
              size="icon"
              title="Draw (B)"
              variant={drawing ? "default" : "outline"}
            >
              <IconPlaceholder
                hugeicons="PencilEdit01Icon"
                lucide="PencilIcon"
                phosphor="PencilSimpleIcon"
                remixicon="RiPencilLine"
                tabler="IconPencil"
              />
            </Button>
            <ScaleMenu
              enabled={scaleOn}
              limited={scaleOnly}
              onEnabledChange={setScaleOn}
              onLimitedChange={toggleScaleOnly}
              onScaleChange={setScaleChoice}
              scale={scaleChoice}
            />
            <NotesMenu
              hasNotes={notes.length > 0}
              hasScale={scale !== null}
              onClear={clearNotes}
              onEdit={applyEdit}
              onExport={handleExport}
              onImport={handleImport}
            />
          </ButtonGroup>
        </div>
      </div>
      <Timeline
        duration={meter.duration}
        maxZoom={MAX_ZOOM}
        onPositionChange={seekTo}
        snapStep={1}
        source={position}
      >
        <PianoRoll
          activePitches={activePitches}
          className="h-104"
          folded={scaleOnly && scale ? "scale" : folded}
          getNoteLabel={describeNote}
          maxPitch={MAX_PITCH}
          minPitch={MIN_PITCH}
          mode={drawing ? "draw" : "select"}
          onNoteOff={handleNoteOff}
          onNoteOn={handleNoteOn}
          onSelectionChange={setSelection}
          onValueChange={history.change}
          onValueCommitted={history.commit}
          scale={scale}
          selection={selection}
          value={notes}
        >
          <PianoRollStrip className="border-b">
            <TimelineNavigator className="mx-2 my-1.5" />
          </PianoRollStrip>
          <PianoRollViewport ref={viewportRef}>
            <PianoRollStrip
              className="border-b"
              lead={
                <Button
                  aria-pressed={folded}
                  className="h-full w-full rounded-none text-[10px] uppercase tracking-wide"
                  onClick={toggleFolded}
                  size="sm"
                  type="button"
                  variant={folded ? "default" : "ghost"}
                >
                  Fold
                </Button>
              }
              sticky="top"
            >
              <TimelineLane className="h-5.5 cursor-cell bg-muted/40">
                <TimelineRange
                  aria-label="Loop region"
                  className={cn(
                    "rounded-none bg-primary/70 ring-0",
                    !looping && "opacity-40"
                  )}
                  drawable
                  getAriaValueText={describeStep}
                  onDoubleClick={clearLoopRegion}
                  onValueChange={changeLoopRegion}
                  onValueCommitted={commitLoopRegion}
                  value={loopRange}
                >
                  <TimelineRangeHandle
                    aria-label="Loop start"
                    className="rounded-none bg-foreground/20 hover:bg-foreground/40"
                    edge="start"
                  />
                  <TimelineRangeHandle
                    aria-label="Loop end"
                    className="rounded-none bg-foreground/20 hover:bg-foreground/40"
                    edge="end"
                  />
                </TimelineRange>
              </TimelineLane>
              <TimelineRuler
                aria-label="Playhead"
                className="h-4.5 border-b-0 text-[10px]"
                getAriaValueText={describeStep}
              >
                {marks.map((mark) => (
                  <TimelineMark
                    className={cn(
                      "ps-1",
                      mark.level !== "bar" && "text-muted-foreground"
                    )}
                    key={mark.step}
                    value={mark.step}
                  >
                    {mark.label}
                  </TimelineMark>
                ))}
                <TimelinePlayhead />
              </TimelineRuler>
            </PianoRollStrip>
            <PianoRollStrip className="flex-1" lead={<PianoRollKeys />}>
              <PianoRollGrid
                accentStep={meter.stepsPerBeat}
                aria-describedby={helpId}
                aria-label="Notes"
                gridStep={1}
                ref={gridRef}
              >
                <TimelinePlayhead />
              </PianoRollGrid>
            </PianoRollStrip>
            <PianoRollStrip
              className="border-t"
              lead={<PianoRollVelocityScale />}
              sticky="bottom"
            >
              <PianoRollVelocity accentStep={meter.stepsPerBeat} gridStep={1} />
            </PianoRollStrip>
          </PianoRollViewport>
        </PianoRoll>
      </Timeline>
      <p className="sr-only" id={helpId}>
        Click the grid to add a note, or with drawing off (B), to start a
        selection. Drag a note to move it, with Alt to copy it, and drag its
        edges to change its length. Shift and a click adds a note to the
        selection; Shift and a key selects every note on its row. The arrow keys
        move the focused note, Shift with Left or Right changes its length,
        Shift with Up or Down moves it an octave, and Delete removes it. Enter
        on the grid adds a note at the playhead, and Escape clears the
        selection. Cmd or Ctrl with E chops the selection on the grid, or splits
        the notes at the playhead, with J joins, with U quantizes, with Shift
        and A inverts the selection, and with Z undoes. F folds onto the notes,
        K marks the scale and G keeps only its rows.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div aria-label="Volume" className="flex-1" role="group">
          <div className="flex w-full min-w-0 flex-col gap-3">
            <div className="flex w-full min-w-0 items-center justify-between gap-4 [&>*:not(output):not(span)]:min-w-0 [&>*:not(output):not(span)]:flex-1">
              <span
                className="text-center text-muted-foreground text-xs"
                id={volumeLabelId}
              >
                Volume
              </span>
              <Fader
                aria-describedby={volumeValueId}
                aria-labelledby={volumeLabelId}
                id={volumeId}
                max={1}
                min={0}
                onValueChange={setVolume}
                orientation="horizontal"
                step={0.01}
                value={volume}
                valueLabel="hidden"
              />
              <output
                aria-live="polite"
                className="min-w-12 text-center font-mono text-muted-foreground text-xs tabular-nums"
                id={volumeValueId}
              >
                {Math.round(volume * 100)}%
              </output>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
