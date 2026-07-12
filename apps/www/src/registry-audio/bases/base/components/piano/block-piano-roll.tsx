"use client";

import type { PianoRoll as PianoRollPrimitive } from "@audio-ui/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/registry/bases/base/ui/input-group";
import {
  ChannelStrip,
  ChannelStripContent,
  ChannelStripLabel,
  ChannelStripSection,
  ChannelStripValue,
} from "@/registry-audio/bases/base/audio/elements/channel-strip";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { MidiConnectControl } from "@/registry-audio/bases/base/audio/elements/midi-connect-control";
import { PianoRoll } from "@/registry-audio/bases/base/audio/elements/piano-roll";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import {
  type UseSynthVoicesReturn,
  useSynthVoices,
} from "@/registry-audio/bases/base/hooks/use-synth-voices";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/synth-voice";

const START_NOTE = 48;
const END_NOTE = 72;
const DEFAULT_VOLUME = 0.7;
const MIDI_MAX_VELOCITY = 127;
const TOTAL_STEPS = 16;
const BEATS_PER_BAR = 4;
const MIN_BPM = 60;
const MAX_BPM = 200;
const DEFAULT_BPM = 120;
const LOOP_SCHEDULE_LEAD_MS = 100;
/** How long a discrete (non-drag) grid edit — a click-add, a keyboard nudge — keeps its key-strip highlight lit after the instant audio blip. */
const BLIP_HIGHLIGHT_MS = 200;

/** ADSR-shaped, matching the Envelope primitive's own default — this block doesn't expose an editable envelope, keeping it focused on the note grid. */
const DEFAULT_ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

type Note = PianoRollPrimitive.Note;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  isMuted: boolean;
  releaseAll: UseSynthVoicesReturn["releaseAll"];
  releaseNote: UseSynthVoicesReturn["releaseNote"];
  triggerNote: UseSynthVoicesReturn["triggerNote"];
  webAudio: ReturnType<typeof useWebAudio>;
}

/**
 * Owns the note grid's data (fed to the PianoRoll primitive as a controlled
 * value — click/drag/keyboard edits flow back in through `onValueChange`),
 * live-preview triggering for the key strip and MIDI input, a short-lived
 * "which pitch was just edited" highlight for the key strip, and the
 * loop-playback state machine. Split out of the block component purely to
 * keep its cognitive complexity manageable.
 */
function usePianoRoll({
  bpm,
  isMuted,
  releaseAll,
  releaseNote,
  triggerNote,
  webAudio,
}: UsePianoRollOptions) {
  const loopDuration = (60 / bpm) * BEATS_PER_BAR;
  const stepDuration = loopDuration / TOTAL_STEPS;

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
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const playbackTimeoutRef = useRef<number | null>(null);
  const loopAnchorTimeRef = useRef(0);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  /** The pitches currently sounding because of an in-progress grid drag — held (not blipped) for as long as the drag continues, released on pointerup, same as the key strip's own hold semantics. A group move shifts every selected note by the same delta, so whenever any pitch changes they all change together on that frame — the edited set IS the group's complete new pitch set. */
  const heldGridPitchesRef = useRef<Set<number>>(new Set());
  const gridPointerUpHandlerRef = useRef<(() => void) | null>(null);
  /** Real physical pointer state, tracked independently of the primitive's own drag lifecycle: a plain click resolves its `pointerup` *before* the resulting `click`/`onValueChange` fires, so reactively arming a "release on next pointerup" listener from inside `setNotes` would miss that pointerup and hold the note until some unrelated future one. Checking real pointer-down state lets us tell a click (blip) from a drag (hold) apart. */
  const isPointerDownRef = useRef(false);
  const blipClearTimeoutRef = useRef<number | null>(null);

  const releaseAllHeldGridPitches = useCallback(() => {
    if (heldGridPitchesRef.current.size > 0) {
      if (!isMutedRef.current) {
        for (const pitch of heldGridPitchesRef.current) {
          releaseNote(pitch, DEFAULT_ENVELOPE);
        }
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
      if (!(isMutedRef.current || isPlayingRef.current)) {
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
      if (!(isMutedRef.current || isPlayingRef.current)) {
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
      if (!isMutedRef.current) {
        triggerNote(note, DEFAULT_ENVELOPE, 1);
      }
    },
    [triggerNote]
  );

  const handleNoteOff = useCallback(
    (note: number) => {
      if (!isMutedRef.current) {
        releaseNote(note, DEFAULT_ENVELOPE);
      }
    },
    [releaseNote]
  );

  const handleMidiNoteOn = useCallback(
    (note: number, velocity: number) => {
      if (!isMutedRef.current) {
        triggerNote(note, DEFAULT_ENVELOPE, velocity / MIDI_MAX_VELOCITY);
      }
    },
    [triggerNote]
  );

  const handleMidiNoteOff = useCallback(
    (note: number) => {
      if (!isMutedRef.current) {
        releaseNote(note, DEFAULT_ENVELOPE);
      }
    },
    [releaseNote]
  );

  const stopPlayback = useCallback(() => {
    if (playbackTimeoutRef.current !== null) {
      window.clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setIsPlaying(false);
    releaseAll();
  }, [releaseAll]);

  const scheduleLoopIteration = useCallback(
    (anchorTime: number) => {
      loopAnchorTimeRef.current = anchorTime;
      const stepSeconds = stepDurationRef.current;
      for (const recordedNote of notesRef.current) {
        const onTime = anchorTime + recordedNote.startStep * stepSeconds;
        const offTime = onTime + recordedNote.duration * stepSeconds;
        triggerNote(
          recordedNote.note,
          DEFAULT_ENVELOPE,
          recordedNote.velocity ?? 1,
          onTime
        );
        releaseNote(recordedNote.note, DEFAULT_ENVELOPE, offTime);
      }
      const delayMs = Math.max(
        0,
        loopDurationRef.current * 1000 - LOOP_SCHEDULE_LEAD_MS
      );
      playbackTimeoutRef.current = window.setTimeout(() => {
        scheduleLoopIteration(anchorTime + loopDurationRef.current);
      }, delayMs);
    },
    [releaseNote, triggerNote]
  );

  const startPlayback = useCallback(() => {
    const ctx = webAudio.getContext();
    if (!ctx || notesRef.current.length === 0) {
      return;
    }
    setIsPlaying(true);
    scheduleLoopIteration(ctx.currentTime);
  }, [scheduleLoopIteration, webAudio]);

  const clearNotes = useCallback(() => {
    stopPlayback();
    setNotesState([]);
  }, [stopPlayback]);

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
      const percent =
        duration > 0 ? ((elapsed % duration) / duration) * 100 : 0;
      if (playheadRef.current) {
        playheadRef.current.style.left = `${percent}%`;
      }

      const positionInLoop = duration > 0 ? elapsed % duration : 0;
      const stepSeconds = stepDurationRef.current;
      const sounding = notesRef.current
        .filter((n) => {
          const onTime = n.startStep * stepSeconds;
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
    gridHighlightNotes,
    handleMidiNoteOff,
    handleMidiNoteOn,
    handleNoteOff,
    handleNoteOn,
    isPlaying,
    notes,
    playheadRef,
    playingHighlightNotes,
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
  const bpmId = useId();
  const bpmLabelId = useId();

  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [bpmDraft, setBpmDraft] = useState(String(DEFAULT_BPM));
  const [isMuted, setIsMuted] = useState(false);
  const masterGain = useMasterGain(webAudio, volume);

  const { releaseAll, releaseNote, setPitchBend, triggerNote } = useSynthVoices(
    { destination: masterGain }
  );

  const {
    clearNotes,
    gridHighlightNotes,
    handleMidiNoteOff,
    handleMidiNoteOn,
    handleNoteOff,
    handleNoteOn,
    isPlaying,
    notes,
    playheadRef,
    playingHighlightNotes,
    setNotes,
    startPlayback,
    stopPlayback,
  } = usePianoRoll({
    bpm,
    isMuted,
    releaseAll,
    releaseNote,
    triggerNote,
    webAudio,
  });

  const midi = useMidiInput({
    onNoteOff: handleMidiNoteOff,
    onNoteOn: handleMidiNoteOn,
    onPitchBend: setPitchBend,
  });

  const handleMidiToggle = useCallback(() => {
    if (midi.isConnected) {
      midi.disconnect();
      releaseAll();
    } else {
      midi.requestAccess();
    }
  }, [midi, releaseAll]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((muted) => !muted);
  }, []);

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

  const activeKeyNotes = [
    ...midi.activeNotes,
    ...gridHighlightNotes,
    ...playingHighlightNotes,
  ];

  const handleBpmInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setBpmDraft(e.target.value);
    },
    []
  );

  const commitBpmDraft = useCallback(() => {
    const parsed = Number(bpmDraft);
    setBpm((value) =>
      Number.isNaN(parsed) ? value : clamp(parsed, MIN_BPM, MAX_BPM)
    );
  }, [bpmDraft]);

  const handleBpmInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
    },
    []
  );

  const handleBpmDecrement = useCallback(() => {
    setBpm((value) => clamp(value - 1, MIN_BPM, MAX_BPM));
  }, []);

  const handleBpmIncrement = useCallback(() => {
    setBpm((value) => clamp(value + 1, MIN_BPM, MAX_BPM));
  }, []);

  useEffect(() => {
    setBpmDraft(String(bpm));
  }, [bpm]);

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
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
            aria-pressed={isMuted}
            onClick={handleMuteToggle}
            size="sm"
            type="button"
            variant={isMuted ? "default" : "outline"}
          >
            <IconPlaceholder
              className="size-4"
              hugeicons={isMuted ? "VolumeOffIcon" : "VolumeHighIcon"}
              lucide={isMuted ? "VolumeX" : "Volume2"}
              phosphor={isMuted ? "SpeakerSlashIcon" : "SpeakerHighIcon"}
              remixicon={isMuted ? "RiVolumeMuteLine" : "RiVolumeUpLine"}
              tabler={isMuted ? "IconVolumeOff" : "IconVolume"}
            />
            {isMuted ? "Muted" : "Live Preview"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <ChannelStripLabel className="text-left" id={bpmLabelId}>
            BPM
          </ChannelStripLabel>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupButton
                aria-label="Decrease BPM"
                onClick={handleBpmDecrement}
                size="icon-xs"
              >
                <IconPlaceholder
                  className="size-4"
                  hugeicons="MinusSignIcon"
                  lucide="Minus"
                  phosphor="MinusIcon"
                  remixicon="RiSubtractLine"
                  tabler="IconMinus"
                />
              </InputGroupButton>
            </InputGroupAddon>
            <InputGroupInput
              aria-labelledby={bpmLabelId}
              className="[appearance:textfield] text-center [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              id={bpmId}
              inputMode="numeric"
              max={MAX_BPM}
              min={MIN_BPM}
              onBlur={commitBpmDraft}
              onChange={handleBpmInputChange}
              onKeyDown={handleBpmInputKeyDown}
              step={1}
              type="number"
              value={bpmDraft}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Increase BPM"
                onClick={handleBpmIncrement}
                size="icon-xs"
              >
                <IconPlaceholder
                  className="size-4"
                  hugeicons="PlusSignIcon"
                  lucide="Plus"
                  phosphor="PlusIcon"
                  remixicon="RiAddLine"
                  tabler="IconPlus"
                />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
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
        <MidiConnectControl midi={midi} onToggle={handleMidiToggle} />
      </div>
    </div>
  );
}
