"use client";

import type {
  PianoRoll as PianoRollPrimitive,
  Ruler as RulerPrimitive,
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
import { PianoRoll } from "@/registry-audio/bases/base/audio/elements/piano-roll";
import { Ruler } from "@/registry-audio/bases/base/audio/elements/ruler";
import {
  type UseSynthVoicesReturn,
  useSynthVoices,
} from "@/registry-audio/bases/base/hooks/use-synth-voices";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import {
  encodeMidiFile,
  type MidiFileNote,
  parseMidiFile,
} from "@/registry-audio/bases/base/lib/midi";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/synth-voice";

const START_NOTE = 48;
const END_NOTE = 72;
const DEFAULT_VOLUME = 0.7;
const TOTAL_STEPS = 16;
const BEATS_PER_BAR = 4;
const DEFAULT_BPM = 120;
const MIN_BPM = 20;
const MAX_BPM = 200;
/** Look-ahead scheduler constants — the standard Web Audio pattern : poll frequently and only ever commit whatever falls within a short rolling window of `ctx.currentTime`, instead of sleeping for a whole loop and betting everything on one timer firing exactly on time. */
const SCHEDULER_POLL_MS = 25;
const SCHEDULE_AHEAD_SECONDS = 0.1;
/** How long a discrete (non-drag) grid edit — a click-add, a keyboard nudge — keeps its key-strip highlight lit after the instant audio blip. */
const BLIP_HIGHLIGHT_MS = 200;
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

type Note = PianoRollPrimitive.Note;
type LoopRegion = RulerPrimitive.Region;

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
    const startStep = Math.round(
      (midiNote.startTick * secondsPerTick) / stepDuration
    );
    if (startStep < 0 || startStep >= TOTAL_STEPS) {
      continue;
    }
    const durationSteps = clamp(
      Math.round((midiNote.durationTicks * secondsPerTick) / stepDuration),
      1,
      TOTAL_STEPS - startStep
    );
    notes.push({
      duration: durationSteps,
      id: `midi-import-${notes.length}`,
      note: clamp(midiNote.note, START_NOTE, END_NOTE),
      startStep,
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
    durationTicks: Math.round(note.duration * ticksPerStep),
    note: note.note,
    startTick: Math.round(note.startStep * ticksPerStep),
    velocity: note.velocity ?? 1,
  }));
  return encodeMidiFile({
    bpm,
    notes: midiNotes,
    ticksPerQuarterNote: MIDI_TICKS_PER_QUARTER_NOTE,
  });
}

/** Creates a master GainNode once on mount and keeps it synced to `volume`. Split out purely to keep the block component's cognitive complexity manageable. */
function useMasterGain(
  webAudio: ReturnType<typeof useWebAudio>,
  volume: number
) {
  const [masterGain, setMasterGain] = useState<GainNode | null>(null);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = DEFAULT_VOLUME;
    gain.connect(ctx.destination);
    setMasterGain(gain);
    return () => {
      gain.disconnect();
    };
  }, [webAudio]);

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && masterGain)) {
      return;
    }
    masterGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }, [volume, masterGain, webAudio]);

  return masterGain;
}

interface UsePianoRollOptions {
  bpm: number;
  loopRegion: LoopRegion | null;
  releaseAll: UseSynthVoicesReturn["releaseAll"];
  releaseNote: UseSynthVoicesReturn["releaseNote"];
  triggerNote: UseSynthVoicesReturn["triggerNote"];
  webAudio: ReturnType<typeof useWebAudio>;
}

/**
 * Owns the note grid's data (fed to the PianoRoll primitive as a controlled
 * value — click/drag/keyboard edits flow back in through `onValueChange`),
 * live-preview triggering for the key strip, a short-lived "which pitch was
 * just edited" highlight for the key strip, and the loop-playback state
 * machine (region-aware via `loopRegion`, seekable via `seekTo`). Split out
 * of the block component purely to keep its cognitive complexity manageable.
 */
function usePianoRoll({
  bpm,
  loopRegion,
  releaseAll,
  releaseNote,
  triggerNote,
  webAudio,
}: UsePianoRollOptions) {
  // Step duration stays bpm/tempo-derived regardless of the loop region —
  // only how many steps repeat changes, never how long each one lasts.
  const barSeconds = (60 / bpm) * BEATS_PER_BAR;
  const stepDuration = barSeconds / TOTAL_STEPS;
  const region = loopRegion ?? FULL_LOOP_REGION;
  const loopDuration = (region.end - region.start) * stepDuration;

  const [notes, setNotesState] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gridHighlightNotes, setGridHighlightNotes] = useState<number[]>([]);
  const [playingHighlightNotes, setPlayingHighlightNotes] = useState<number[]>(
    []
  );

  const notesRef = useRef(notes);
  notesRef.current = notes;
  const loopDurationRef = useRef(loopDuration);
  loopDurationRef.current = loopDuration;
  const stepDurationRef = useRef(stepDuration);
  stepDurationRef.current = stepDuration;
  const regionRef = useRef(region);
  regionRef.current = region;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const schedulerIntervalRef = useRef<number | null>(null);
  /** Fixed reference point (AudioContext time of the region's step 0) set once per play/seek/region-restart — never advanced by the scheduler poll itself, since `elapsed % duration` is already self-correcting for display regardless of how many iterations have actually played. */
  const loopAnchorTimeRef = useRef(0);
  /** Rolling scheduling cursor — the next AudioContext time boundary that still needs its notes committed. Runs ahead of `loopAnchorTimeRef`/real playback by up to `SCHEDULE_AHEAD_SECONDS`, and is what the look-ahead poller actually advances. */
  const scheduledUntilTimeRef = useRef(0);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rulerPlayheadRef = useRef<HTMLDivElement | null>(null);
  /** The pitches currently sounding because of an in-progress grid drag — held (not blipped) for as long as the drag continues, released on pointerup, same as the key strip's own hold semantics. A group move shifts every selected note by the same delta, so whenever any pitch changes they all change together on that frame — the edited set IS the group's complete new pitch set. */
  const heldGridPitchesRef = useRef<Set<number>>(new Set());
  const gridPointerUpHandlerRef = useRef<(() => void) | null>(null);
  /** Real physical pointer state, tracked independently of the primitive's own drag lifecycle: a plain click resolves its `pointerup` *before* the resulting `click`/`onValueChange` fires, so reactively arming a "release on next pointerup" listener from inside `setNotes` would miss that pointerup and hold the note until some unrelated future one. Checking real pointer-down state lets us tell a click (blip) from a drag (hold) apart. */
  const isPointerDownRef = useRef(false);
  const blipClearTimeoutRef = useRef<number | null>(null);

  const releaseAllHeldGridPitches = useCallback(() => {
    if (heldGridPitchesRef.current.size > 0) {
      for (const pitch of heldGridPitchesRef.current) {
        releaseNote(pitch, DEFAULT_ENVELOPE);
      }
      heldGridPitchesRef.current = new Set();
    }
    setGridHighlightNotes([]);
  }, [releaseNote]);

  const armGridReleaseOnPointerUp = useCallback(() => {
    if (gridPointerUpHandlerRef.current) {
      return;
    }
    const handler = () => {
      gridPointerUpHandlerRef.current = null;
      releaseAllHeldGridPitches();
    };
    gridPointerUpHandlerRef.current = handler;
    window.addEventListener("pointerup", handler, { once: true });
  }, [releaseAllHeldGridPitches]);

  useEffect(() => {
    const handlePointerDown = () => {
      isPointerDownRef.current = true;
    };
    const handlePointerUp = () => {
      isPointerDownRef.current = false;
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  useEffect(
    () => () => {
      if (gridPointerUpHandlerRef.current) {
        window.removeEventListener(
          "pointerup",
          gridPointerUpHandlerRef.current
        );
      }
      if (blipClearTimeoutRef.current !== null) {
        window.clearTimeout(blipClearTimeoutRef.current);
      }
    },
    []
  );

  /** Actively dragging: swap the held set to match `editedPitches` — release whatever's no longer part of it, trigger whatever's newly in it. Skipped while the loop is playing: the loop schedules its own notes ahead of time through the same voice pool, and a live-preview trigger/release on a pitch the loop already has scheduled would fight over that voice and cut it off or mis-time it. The highlight and bookkeeping still update — only the audio is held back. */
  const holdEditedPitches = useCallback(
    (editedPitches: Set<number>) => {
      if (!isPlayingRef.current) {
        for (const pitch of heldGridPitchesRef.current) {
          if (!editedPitches.has(pitch)) {
            releaseNote(pitch, DEFAULT_ENVELOPE);
          }
        }
        for (const pitch of editedPitches) {
          if (!heldGridPitchesRef.current.has(pitch)) {
            triggerNote(pitch, DEFAULT_ENVELOPE, 1);
          }
        }
      }
      heldGridPitchesRef.current = editedPitches;
      armGridReleaseOnPointerUp();
    },
    [armGridReleaseOnPointerUp, releaseNote, triggerNote]
  );

  /** A discrete action (click-add, keyboard nudge) — no drag to hold through, so just blip each newly-edited pitch and let the highlight fade shortly after. Consecutive blips (e.g. rapid arrow-key nudges) share one cancelable timer so an earlier blip's clear can never wipe out a highlight a later blip just set. Skipped while playing, for the same voice-stealing reason as `holdEditedPitches`. */
  const blipEditedPitches = useCallback(
    (editedPitches: Set<number>) => {
      if (!isPlayingRef.current) {
        for (const pitch of editedPitches) {
          triggerNote(pitch, DEFAULT_ENVELOPE, 1);
          releaseNote(pitch, DEFAULT_ENVELOPE);
        }
      }
      if (blipClearTimeoutRef.current !== null) {
        window.clearTimeout(blipClearTimeoutRef.current);
      }
      blipClearTimeoutRef.current = window.setTimeout(() => {
        blipClearTimeoutRef.current = null;
        setGridHighlightNotes([]);
      }, BLIP_HIGHLIGHT_MS);
    },
    [releaseNote, triggerNote]
  );

  const setNotes = useCallback(
    (next: Note[]) => {
      const previousById = new Map(
        notesRef.current.map((n) => [n.id, n] as const)
      );
      const editedPitches = new Set<number>();
      for (const n of next) {
        const before = previousById.get(n.id);
        if (!before || before.note !== n.note) {
          editedPitches.add(n.note);
        }
      }
      if (editedPitches.size > 0) {
        if (isPointerDownRef.current) {
          holdEditedPitches(editedPitches);
        } else {
          blipEditedPitches(editedPitches);
        }
        setGridHighlightNotes([...editedPitches]);
      }
      setNotesState(next);
    },
    [blipEditedPitches, holdEditedPitches]
  );

  const handleNoteOn = useCallback(
    (note: number) => {
      triggerNote(note, DEFAULT_ENVELOPE, 1);
    },
    [triggerNote]
  );

  const handleNoteOff = useCallback(
    (note: number) => {
      releaseNote(note, DEFAULT_ENVELOPE);
    },
    [releaseNote]
  );

  const stopPlayback = useCallback(() => {
    if (schedulerIntervalRef.current !== null) {
      window.clearInterval(schedulerIntervalRef.current);
      schedulerIntervalRef.current = null;
    }
    setIsPlaying(false);
    releaseAll();
  }, [releaseAll]);

  /** Schedules exactly one loop iteration's notes, anchored at `anchorTime` — a single, precisely-timed batch of Web Audio `start`/`stop` calls, sample-accurate regardless of when this function itself happens to run. */
  const scheduleIterationNotes = useCallback(
    (anchorTime: number) => {
      const stepSeconds = stepDurationRef.current;
      const { end, start } = regionRef.current;
      for (const recordedNote of notesRef.current) {
        if (recordedNote.startStep < start || recordedNote.startStep >= end) {
          continue;
        }
        const onTime =
          anchorTime + (recordedNote.startStep - start) * stepSeconds;
        const offTime = onTime + recordedNote.duration * stepSeconds;
        triggerNote(
          recordedNote.note,
          DEFAULT_ENVELOPE,
          recordedNote.velocity ?? 1,
          onTime
        );
        releaseNote(recordedNote.note, DEFAULT_ENVELOPE, offTime);
      }
    },
    [releaseNote, triggerNote]
  );

  /** The look-ahead poll itself: commits every loop iteration boundary that falls within `SCHEDULE_AHEAD_SECONDS` of right now. The `while` (not `if`) is what makes this self-correcting — if a poll is ever delayed past a full loop duration (a stalled main thread, a throttled background tab), the next poll just catches up by scheduling more than one iteration, rather than a boundary silently slipping past unscheduled. */
  const pollScheduler = useCallback(() => {
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    const horizon = ctx.currentTime + SCHEDULE_AHEAD_SECONDS;
    while (scheduledUntilTimeRef.current < horizon) {
      scheduleIterationNotes(scheduledUntilTimeRef.current);
      scheduledUntilTimeRef.current += loopDurationRef.current;
    }
  }, [scheduleIterationNotes, webAudio]);

  /** (Re)starts the look-ahead scheduler from `anchorTime` — used to begin playback, and whenever the loop region changes or the ruler is used to seek mid-playback, so the change is audible immediately instead of waiting for a stale iteration to finish. */
  const restartLoopFrom = useCallback(
    (anchorTime: number) => {
      if (schedulerIntervalRef.current !== null) {
        window.clearInterval(schedulerIntervalRef.current);
      }
      releaseAll();
      loopAnchorTimeRef.current = anchorTime;
      scheduledUntilTimeRef.current = anchorTime;
      pollScheduler();
      schedulerIntervalRef.current = window.setInterval(
        pollScheduler,
        SCHEDULER_POLL_MS
      );
    },
    [pollScheduler, releaseAll]
  );

  /** Fired on `Ruler`'s `onValueCommit` — the region drag has already streamed through `onValueChange`, so `regionRef.current` is fresh by the time this runs. Only meaningful mid-playback; an idle loop just remembers the new region for its next `Play`. */
  const commitLoopRegion = useCallback(() => {
    if (!isPlayingRef.current) {
      return;
    }
    const ctx = webAudio.getContext();
    if (ctx) {
      restartLoopFrom(ctx.currentTime);
    }
  }, [restartLoopFrom, webAudio]);

  /** Fired on `Ruler`'s `onSeek` (a plain click on the ruler track). Only meaningful mid-playback, same as `commitLoopRegion` — there's no stopped-state playhead to seek yet. */
  const seekTo = useCallback(
    (step: number) => {
      if (!isPlayingRef.current) {
        return;
      }
      const ctx = webAudio.getContext();
      if (!ctx) {
        return;
      }
      const { end, start } = regionRef.current;
      const clampedStep = clamp(step, start, end - 1);
      const anchorTime =
        ctx.currentTime - (clampedStep - start) * stepDurationRef.current;
      restartLoopFrom(anchorTime);
    },
    [restartLoopFrom, webAudio]
  );

  const startPlayback = useCallback(() => {
    const ctx = webAudio.getContext();
    if (!ctx || notesRef.current.length === 0) {
      return;
    }
    setIsPlaying(true);
    restartLoopFrom(ctx.currentTime);
  }, [restartLoopFrom, webAudio]);

  const clearNotes = useCallback(() => {
    stopPlayback();
    setNotesState([]);
  }, [stopPlayback]);

  /** Replaces the whole grid at once — e.g. after a MIDI file import — bypassing `setNotes`'s per-edit live-preview bookkeeping, which is meant for interactive clicks/drags, not a bulk load. */
  const importNotes = useCallback(
    (next: Note[]) => {
      stopPlayback();
      setNotesState(next);
    },
    [stopPlayback]
  );

  useEffect(() => {
    if (!isPlaying) {
      setPlayingHighlightNotes([]);
      return;
    }
    const ctx = webAudio.getContext();
    if (!ctx) {
      return;
    }
    let rafId: number;
    let lastSounding: number[] = [];
    const tick = () => {
      const elapsed = ctx.currentTime - loopAnchorTimeRef.current;
      const duration = loopDurationRef.current;
      const positionInLoop = duration > 0 ? elapsed % duration : 0;
      const stepSeconds = stepDurationRef.current;
      const { end, start } = regionRef.current;
      // Position within the region maps onto the *full* grid width — the
      // playhead only sweeps the region's span, not the whole timeline.
      const stepPosition = start + positionInLoop / stepSeconds;
      const percent = (stepPosition / TOTAL_STEPS) * 100;
      if (playheadRef.current) {
        playheadRef.current.style.left = `${percent}%`;
      }
      if (rulerPlayheadRef.current) {
        rulerPlayheadRef.current.style.left = `${percent}%`;
      }

      const sounding = notesRef.current
        .filter((n) => {
          if (n.startStep < start || n.startStep >= end) {
            return false;
          }
          const onTime = (n.startStep - start) * stepSeconds;
          const offTime = onTime + n.duration * stepSeconds;
          return positionInLoop >= onTime && positionInLoop < offTime;
        })
        .map((n) => n.note);
      const changed =
        sounding.length !== lastSounding.length ||
        sounding.some((note, i) => note !== lastSounding[i]);
      if (changed) {
        lastSounding = sounding;
        setPlayingHighlightNotes(sounding);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, webAudio]);

  useEffect(() => stopPlayback, [stopPlayback]);

  return {
    clearNotes,
    commitLoopRegion,
    gridHighlightNotes,
    handleNoteOff,
    handleNoteOn,
    importNotes,
    isPlaying,
    notes,
    playheadRef,
    playingHighlightNotes,
    rulerPlayheadRef,
    seekTo,
    setNotes,
    startPlayback,
    stopPlayback,
  };
}

export default function BlockPianoRoll() {
  const webAudio = useWebAudio();
  const volumeId = useId();
  const volumeLabelId = useId();
  const volumeValueId = useId();

  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [loopRegion, setLoopRegion] = useState<LoopRegion | null>(null);
  const masterGain = useMasterGain(webAudio, volume);

  const { releaseAll, releaseNote, triggerNote } = useSynthVoices({
    destination: masterGain,
  });

  const {
    clearNotes,
    commitLoopRegion,
    gridHighlightNotes,
    handleNoteOff,
    handleNoteOn,
    importNotes,
    isPlaying,
    notes,
    playheadRef,
    playingHighlightNotes,
    rulerPlayheadRef,
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
    webAudio,
  });

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

  const activeKeyNotes = [...gridHighlightNotes, ...playingHighlightNotes];

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
      <div className="flex w-full min-w-0 gap-2">
        {/* Spacer matching PianoRoll's own KeysTrack width, so the ruler's steps line up with the grid's steps below it rather than the full card width. */}
        <div aria-hidden="true" className="w-10 shrink-0" />
        <Ruler
          aria-label="Loop region"
          className="flex-1"
          isPlaying={isPlaying}
          onSeek={seekTo}
          onValueChange={setLoopRegion}
          onValueCommit={commitLoopRegion}
          playheadRef={rulerPlayheadRef}
          totalSteps={TOTAL_STEPS}
          value={loopRegion}
        />
      </div>
      <PianoRoll
        activeNotes={activeKeyNotes}
        aria-label="Piano roll grid"
        endNote={END_NOTE}
        isPlaying={isPlaying}
        onKeyNoteOff={handleNoteOff}
        onKeyNoteOn={handleNoteOn}
        onValueChange={setNotes}
        playheadRef={playheadRef}
        startNote={START_NOTE}
        totalSteps={TOTAL_STEPS}
        value={notes}
      />
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
                step={0.01}
                value={volume}
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
