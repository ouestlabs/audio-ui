"use client";

import {
  createSource,
  type PianoRoll as PianoRollPrimitive,
} from "@audio-ui/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import { BpmControl } from "@/registry-audio/bases/base/audio/elements/bpm-control";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry-audio/bases/base/audio/elements/channel-strip";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import {
  PianoRoll,
  PianoRollGrid,
  PianoRollKeys,
} from "@/registry-audio/bases/base/audio/elements/piano-roll";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelinePlayhead,
  TimelineRange,
  TimelineRangeHandle,
  TimelineRuler,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type UseSynthVoicesReturn,
  useSynthVoices,
} from "@/registry-audio/bases/base/hooks/use-synth-voices";
import {
  type TransportRegion,
  useTransportClock,
} from "@/registry-audio/bases/base/hooks/use-transport-clock";
import {
  encodeMidiFile,
  type MidiFileNote,
  parseMidiFile,
} from "@/registry-audio/bases/base/lib/midi";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/synth-voice";

const MIN_PITCH = 48;
const MAX_PITCH = 72;
const DEFAULT_VOLUME = 0.7;
const TOTAL_STEPS = 16;
const BEATS_PER_BAR = 4;
/** The ruler's labels: the first step of each beat. */
const BEAT_STEPS = Array.from(
  { length: BEATS_PER_BAR },
  (_, beat) => (beat * TOTAL_STEPS) / BEATS_PER_BAR
);

const describeStep = (step: number) => `Step ${Math.floor(step) + 1}`;
const PITCH_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
/** "C4, step 5, 2 steps": where a note is, in the grid's own terms. */
const describeNote = (note: Note) =>
  `${PITCH_NAMES[note.pitch % 12]}${Math.floor(note.pitch / 12) - 1}, step ${note.start + 1}, ${note.length} ${note.length === 1 ? "step" : "steps"}`;
const DEFAULT_BPM = 120;
const MIN_BPM = 20;
const MAX_BPM = 200;
/** Standard MIDI File resolution — ticks per quarter note, a common round value shared by most DAWs' own exports. */
const MIDI_TICKS_PER_QUARTER_NOTE = 480;
const MICROSECONDS_PER_MINUTE = 60_000_000;
const MIDI_FILE_ACCEPT = ".mid,.midi,audio/midi,audio/x-midi";

/** ADSR-shaped, matching the Envelope primitive's own default — this block doesn't expose an editable envelope, keeping it focused on the note grid. */
const DEFAULT_ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

type Note = PianoRollPrimitive.Root.Note;
type LoopRegion = TransportRegion;

/** No region set — the loop spans the full grid, the original always-loop-everything behavior. */
const FULL_LOOP_REGION: LoopRegion = { end: TOTAL_STEPS, start: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Quantizes a parsed MIDI file's tick-based notes onto the grid's fixed `TOTAL_STEPS` window, adopting the file's own tempo (clamped to the BPM control's range) rather than the grid's current one — notes starting at or past the last step are dropped, matching this block's fixed one-bar-loop model. */
function notesFromMidiFile(parsed: {
  microsecondsPerQuarterNote: number;
  notes: MidiFileNote[];
  ticksPerQuarterNote: number;
}): { bpm: number; notes: Note[] } {
  const bpm = clamp(
    Math.round(MICROSECONDS_PER_MINUTE / parsed.microsecondsPerQuarterNote),
    MIN_BPM,
    MAX_BPM
  );
  const secondsPerTick =
    parsed.microsecondsPerQuarterNote / 1_000_000 / parsed.ticksPerQuarterNote;
  const stepDuration = ((60 / bpm) * BEATS_PER_BAR) / TOTAL_STEPS;

  const notes: Note[] = [];
  for (const midiNote of parsed.notes) {
    const start = Math.round(
      (midiNote.startTick * secondsPerTick) / stepDuration
    );
    if (start < 0 || start >= TOTAL_STEPS) {
      continue;
    }
    const length = clamp(
      Math.round((midiNote.durationTicks * secondsPerTick) / stepDuration),
      1,
      TOTAL_STEPS - start
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

/** The grid's own step/BPM timing converted to MIDI ticks at a fixed, common resolution — the inverse of `notesFromMidiFile`. */
function notesToMidiFile(notes: Note[], bpm: number): Uint8Array {
  const ticksPerStep =
    (MIDI_TICKS_PER_QUARTER_NOTE * BEATS_PER_BAR) / TOTAL_STEPS;
  const midiNotes: MidiFileNote[] = notes.map((note) => ({
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

interface UsePianoRollOptions {
  bpm: number;
  loopRegion: LoopRegion | null;
  releaseAll: UseSynthVoicesReturn["releaseAll"];
  releaseNote: UseSynthVoicesReturn["releaseNote"];
  triggerNote: UseSynthVoicesReturn["triggerNote"];
}

/**
 * Owns the notes, plays the ones the roll auditions (a key pressed, a note
 * drawn or dragged), and wires the loop playback. The drift-free look-ahead
 * timing lives in `useTransportClock`; this hook only schedules notes on its
 * step boundaries and reads its position, so the audio and the playhead come
 * from one source. Split out of the block component to keep it readable.
 */
function usePianoRoll({
  bpm,
  loopRegion,
  releaseAll,
  releaseNote,
  triggerNote,
}: UsePianoRollOptions) {
  const region = loopRegion ?? FULL_LOOP_REGION;

  const [notes, setNotes] = useState<Note[]>([]);
  const [playingPitches, setPlayingPitches] = useState<number[]>([]);

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const regionRef = useRef(region);
  regionRef.current = region;

  /** The clock's position, in steps, for the timeline's playhead to follow outside React. */
  const [position] = useState(() => createSource(0));
  /** The current tempo's step duration, mirrored from the transport clock so note-off offsets use its canonical step↔time mapping instead of a second copy. */
  const secondsPerStepRef = useRef(0);
  /** Mirrors the clock's `isPlaying` for the audition guard, which runs inside pointer callbacks rather than on render. */
  const isPlayingRef = useRef(false);
  /** The pitches auditioned and not yet released. */
  const auditionedRef = useRef(new Set<number>());

  /**
   * Plays what the roll auditions. While the loop plays, only the keys do:
   * the loop schedules its own notes ahead through the same voices, and an
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

  /** Fired on each step boundary the clock emits: schedules every note that starts on `step` as an absolute-time on/off pair, sample-accurate regardless of when the poll ran. Notes outside the loop region never match a step the clock emits, so they never sound — the region filter is the clock's, not ours. */
  const scheduleStep = useCallback(
    (step: number, time: number) => {
      const secondsPerStep = secondsPerStepRef.current;
      for (const recordedNote of notesRef.current) {
        if (recordedNote.start !== step) {
          continue;
        }
        const offTime = time + recordedNote.length * secondsPerStep;
        triggerNote(
          recordedNote.pitch,
          DEFAULT_ENVELOPE,
          recordedNote.velocity ?? 1,
          time
        );
        releaseNote(recordedNote.pitch, DEFAULT_ENVELOPE, offTime);
      }
    },
    [releaseNote, triggerNote]
  );

  const { getPosition, isPlaying, reanchor, secondsPerStep, start, stop } =
    useTransportClock({
      bpm,
      onReset: releaseAll,
      onStep: scheduleStep,
      region: loopRegion,
      stepsPerBeat: TOTAL_STEPS / BEATS_PER_BAR,
      totalSteps: TOTAL_STEPS,
    });
  secondsPerStepRef.current = secondsPerStep;
  isPlayingRef.current = isPlaying;

  const stopPlayback = stop;

  const startPlayback = useCallback(() => {
    if (notesRef.current.length === 0) {
      return;
    }
    start();
  }, [start]);

  /** Fired when a change to the loop range ends — re-anchors the loop so a region change is audible immediately instead of waiting for a stale iteration to finish. No-op while stopped. */
  const commitLoopRegion = useCallback(() => {
    reanchor();
  }, [reanchor]);

  /** Fired when the timeline's ruler moves the position. Clamps onto a step inside the region, then re-anchors so that step plays now. No-op while stopped. */
  const seekTo = useCallback(
    (step: number) => {
      const { end, start: regionStart } = regionRef.current;
      reanchor(clamp(Math.floor(step), regionStart, end - 1));
    },
    [reanchor]
  );

  const clearNotes = useCallback(() => {
    stopPlayback();
    setNotes([]);
  }, [stopPlayback]);

  /** Replaces the whole grid at once, after a MIDI file import. */
  const importNotes = useCallback(
    (next: Note[]) => {
      stopPlayback();
      setNotes(next);
    },
    [stopPlayback]
  );

  // Playhead + "which pitches are sounding" highlight, both derived from the
  // clock's continuous position (fractional grid steps) — one source, so there
  // is no second note→time formula to keep in sync. The playhead follows the
  // position source outside React.
  useEffect(() => {
    if (!isPlaying) {
      setPlayingPitches([]);
      return;
    }
    let rafId: number;
    let lastSounding: number[] = [];
    const tick = () => {
      const position_ = getPosition();
      const { end, start: regionStart } = regionRef.current;
      position.set(position_);

      const sounding = notesRef.current
        .filter((n) => {
          if (n.start < regionStart || n.start >= end) {
            return false;
          }
          return position_ >= n.start && position_ < n.start + n.length;
        })
        .map((n) => n.pitch);
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
  }, [getPosition, isPlaying, position]);

  return {
    clearNotes,
    commitLoopRegion,
    handleNoteOff,
    handleNoteOn,
    importNotes,
    isPlaying,
    notes,
    playingPitches,
    position,
    seekTo,
    setNotes,
    startPlayback,
    stopPlayback,
  };
}

export default function BlockPianoRoll() {
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();

  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  /** Drawing, a press on empty grid adds a note; otherwise it drags a selection rectangle and a double-click adds. */
  const [drawing, setDrawing] = useState(true);
  const toggleDrawing = useCallback(
    () => setDrawing((current) => !current),
    []
  );
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const loopRange: readonly [number, number] = loopRegion
    ? [loopRegion.start, loopRegion.end]
    : [0, TOTAL_STEPS];
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
    clearNotes,
    commitLoopRegion,
    handleNoteOff,
    handleNoteOn,
    importNotes,
    isPlaying,
    notes,
    playingPitches,
    position,
    seekTo,
    setNotes,
    startPlayback,
    stopPlayback,
  } = usePianoRoll({
    bpm,
    loopRegion,
    releaseAll,
    releaseNote,
    triggerNote,
  });

  /** A double-click on the loop goes back to looping the whole grid. */
  const clearLoopRegion = useCallback(() => {
    setLoopRegion(null);
    commitLoopRegion();
  }, [commitLoopRegion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") {
        return;
      }
      e.preventDefault();
      if (isPlaying) {
        stopPlayback();
      } else if (notes.length > 0) {
        startPlayback();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, notes.length, startPlayback, stopPlayback]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const importMidiFile = useCallback(
    async (file: File) => {
      const buffer = await file.arrayBuffer();
      const parsed = parseMidiFile(buffer);
      const imported = notesFromMidiFile(parsed);
      importNotes(imported.notes);
      setBpm(imported.bpm);
    },
    [importNotes]
  );

  const handleImportButtonClick = useCallback(() => {
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

  const handleExportMidiFile = useCallback(() => {
    const bytes = notesToMidiFile(notes, bpm);
    // `Uint8Array`'s `.buffer` types as `ArrayBufferLike` (which also covers
    // `SharedArrayBuffer`) while `BlobPart` wants a concrete `ArrayBuffer` —
    // safe here since `encodeMidiFile` always builds a fresh, non-shared one.
    const blob = new Blob([bytes.buffer as ArrayBuffer], {
      type: "audio/midi",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "piano-roll.mid";
    link.click();
    URL.revokeObjectURL(url);
  }, [bpm, notes]);

  return (
    <div
      className="cn-audio-panel relative flex w-full min-w-0 flex-col gap-4 border bg-card p-4"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
      <Timeline
        duration={TOTAL_STEPS}
        onPositionChange={seekTo}
        snapStep={1}
        source={position}
      >
        <PianoRoll
          activePitches={playingPitches}
          getNoteLabel={describeNote}
          maxPitch={MAX_PITCH}
          minPitch={MIN_PITCH}
          mode={drawing ? "draw" : "select"}
          onNoteOff={handleNoteOff}
          onNoteOn={handleNoteOn}
          onValueChange={setNotes}
          value={notes}
        >
          <TimelineRuler
            aria-label="Playhead"
            className="col-start-2"
            getAriaValueText={describeStep}
          >
            {BEAT_STEPS.map((step, beat) => (
              <TimelineMark key={step} value={step}>
                {beat + 1}
              </TimelineMark>
            ))}
            {isPlaying ? <TimelinePlayhead /> : null}
          </TimelineRuler>
          <TimelineLane className="col-start-2 mb-2 h-4 cursor-cell">
            <TimelineRange
              aria-label="Loop region"
              drawable
              getAriaValueText={describeStep}
              onDoubleClick={clearLoopRegion}
              onValueChange={changeLoopRegion}
              onValueCommitted={commitLoopRegion}
              value={loopRange}
            >
              <TimelineRangeHandle aria-label="Loop start" edge="start" />
              <TimelineRangeHandle aria-label="Loop end" edge="end" />
            </TimelineRange>
          </TimelineLane>
          <PianoRollKeys />
          <PianoRollGrid aria-label="Notes" gridStep={1}>
            {isPlaying ? <TimelinePlayhead /> : null}
          </PianoRollGrid>
        </PianoRoll>
      </Timeline>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={notes.length === 0}
            onClick={isPlaying ? stopPlayback : startPlayback}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPlaying ? "Stop" : "Play"}
          </Button>
          <Button
            aria-pressed={drawing}
            onClick={toggleDrawing}
            size="sm"
            type="button"
            variant={drawing ? "secondary" : "outline"}
          >
            Draw
          </Button>
          <Button
            disabled={notes.length === 0}
            onClick={clearNotes}
            size="sm"
            type="button"
            variant="ghost"
          >
            Clear
          </Button>
          <Button
            onClick={handleImportButtonClick}
            size="sm"
            type="button"
            variant="outline"
          >
            Import MIDI
          </Button>
          <Button
            disabled={notes.length === 0}
            onClick={handleExportMidiFile}
            size="sm"
            type="button"
            variant="outline"
          >
            Export MIDI
          </Button>
        </div>
        <BpmControl onValueChange={setBpm} value={bpm} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ChannelStrip
          aria-label="Volume"
          className="flex-1"
          orientation="horizontal"
        >
          <ChannelStripContent>
            <ChannelStripSection>
              <ChannelStripLabel id={volumeLabelId}>Volume</ChannelStripLabel>
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
              <ChannelStripValue id={volumeValueId}>
                {Math.round(volume * 100)}%
              </ChannelStripValue>
            </ChannelStripSection>
          </ChannelStripContent>
        </ChannelStrip>
      </div>
    </div>
  );
}
