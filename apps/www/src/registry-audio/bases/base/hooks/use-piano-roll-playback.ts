"use client";

import type { Note } from "@audio-ui/core/piano-roll";
import type { Tempo } from "@audio-ui/core/time";
import {
  createSource,
  type PianoRoll as PianoRollPrimitive,
} from "@audio-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseSynthVoicesReturn } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import {
  type TransportRegion,
  useTransportClock,
} from "@/registry-audio/bases/base/hooks/use-transport-clock";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/envelope-ramp";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** A step is a sixteenth note whatever the signature: BPM counts quarter notes. */
export const STEPS_PER_QUARTER = 4;

/** ADSR-shaped, matching the Envelope primitive's own default. */
export const DEFAULT_NOTE_ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.15, y: 1 },
  { x: 0.35, y: 0.6 },
  { x: 0.7, y: 0.6 },
  { x: 1, y: 0.05 },
];

/** Where bars and beats fall, in steps, for a signature: 6/8 has beats of two steps and bars of twelve. */
export interface Meter {
  /** The clip's length, in steps. */
  duration: number;
  stepsPerBar: number;
  stepsPerBeat: number;
}

/** The meter of a clip `bars` long in `tempo`'s signature. */
export function meterOf(tempo: Tempo, bars: number): Meter {
  const stepsPerBeat = (STEPS_PER_QUARTER * 4) / tempo.beatUnit;
  const stepsPerBar = stepsPerBeat * tempo.beatsPerBar;
  return { duration: bars * stepsPerBar, stepsPerBar, stepsPerBeat };
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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

export interface UsePianoRollPlaybackOptions {
  /** Where the metronome clicks; leave it out for no metronome. */
  destination?: AudioNode | null;
  /** The shape every note is played with. @default DEFAULT_NOTE_ENVELOPE */
  envelope?: EnvelopePoint[];
  /** Whether the clip loops, or plays once through. @default true */
  looping?: boolean;
  /** The steps the loop covers; unset, the whole clip. */
  loopRegion?: TransportRegion | null;
  meter: Meter;
  /** Whether the metronome clicks on each beat. @default false */
  metronome?: boolean;
  /** The notes, which you own: edits to them are heard on the next pass. */
  notes: readonly Note[];
  tempo: Tempo;
  /** What plays the notes, such as `useSynthVoices`. */
  voices: Pick<
    UseSynthVoicesReturn,
    "releaseAll" | "releaseNote" | "triggerNote"
  >;
}

/**
 * Plays a piano roll's notes: play on from where it stopped, stop back at the
 * start, the loop or once through, and the metronome. It also plays what the
 * roll auditions (a key pressed, a note drawn or dragged), through
 * `onNoteOn` and `onNoteOff`. The drift-free look-ahead timing lives in
 * `useTransportClock`; this hook schedules notes on its step boundaries and
 * reads its position, so the audio and the playhead come from one source.
 */
export function usePianoRollPlayback({
  destination = null,
  envelope = DEFAULT_NOTE_ENVELOPE,
  looping = true,
  loopRegion = null,
  meter,
  metronome = false,
  notes,
  tempo,
  voices: { releaseAll, releaseNote, triggerNote },
}: UsePianoRollPlaybackOptions) {
  // Looping off, the clip plays once, from its start to its end.
  const region =
    looping && loopRegion ? loopRegion : { end: meter.duration, start: 0 };

  const [playingPitches, setPlayingPitches] = useState<number[]>([]);

  // What the scheduler reads, outside React.
  const live = useRef({
    destination,
    envelope,
    looping,
    meter,
    metronome,
    notes,
    region,
  });
  live.current = {
    destination,
    envelope,
    looping,
    meter,
    metronome,
    notes,
    region,
  };

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
  const onNoteOn = useCallback(
    (pitch: number, details: PianoRollPrimitive.Root.NoteOnEventDetails) => {
      const fromKeys = details.reason === "press" || details.reason === "glide";
      if (isPlayingRef.current && !fromKeys) {
        return;
      }
      auditionedRef.current.add(pitch);
      triggerNote(pitch, live.current.envelope, details.velocity);
    },
    [triggerNote]
  );

  const onNoteOff = useCallback(
    (pitch: number) => {
      if (auditionedRef.current.delete(pitch)) {
        releaseNote(pitch, live.current.envelope);
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
        // A deactivated note stays silent, and one with a chance plays that often.
        if (
          note.start < step ||
          note.start >= step + 1 ||
          note.muted ||
          Math.random() >= (note.chance ?? 1)
        ) {
          continue;
        }
        const at = time + (note.start - step) * secondsPerStep;
        // A deviation strays the velocity by up to its amount, a new roll each time.
        const velocity = clamp(
          (note.velocity ?? 1) + Math.random() * (note.deviation ?? 0),
          0,
          1
        );
        triggerNote(note.pitch, current.envelope, velocity, at);
        releaseNote(
          note.pitch,
          current.envelope,
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

  /** Moves the playhead: plays from there, or parks it there when stopped. */
  const seek = useCallback(
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
    /** The playhead in seconds, a live value for the transport. */
    clock,
    commitLoopRegion,
    isPlaying,
    onNoteOff,
    onNoteOn,
    // Stopping where it is, to play on from there.
    pause: stop,
    play,
    playingPitches,
    /** The playhead in steps, a live value for the timeline. */
    position,
    seek,
    stop: stopPlayback,
  };
}
