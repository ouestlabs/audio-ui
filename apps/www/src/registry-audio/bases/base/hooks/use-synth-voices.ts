"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  type EnvelopePoint,
  noteToFrequency,
  SEMITONES_PER_OCTAVE,
  SUSTAIN_SPLIT_X,
  scheduleEnvelopeRamp,
  sliceEnvelope,
} from "@/registry-audio/bases/base/lib/synth-voice";

const DEFAULT_ATTACK_DECAY_SECONDS = 0.4;
const DEFAULT_RELEASE_SECONDS = 0.3;
const RELEASE_STOP_MARGIN_SECONDS = 0.05;
const DEFAULT_PEAK_GAIN = 0.25;
const PITCH_BEND_SMOOTHING_SECONDS = 0.02;

export interface UseSynthVoicesOptions {
  attackDecaySeconds?: number;
  /** The node every voice's gain connects to, typically a master gain the block also drives with a Volume fader. */
  destination: AudioNode | null;
  oscillatorType?: OscillatorType;
  peakGain?: number;
  releaseSeconds?: number;
}

export interface UseSynthVoicesReturn {
  /** Immediately releases and stops every currently-sounding voice, call on unmount or when disabling. */
  releaseAll: () => void;
  /** Runs the release phase for `note` and schedules the voice to stop. No-op if the note isn't sounding. `time` schedules a future release (e.g. loop playback); omit for an immediate live release. */
  releaseNote: (
    note: number,
    envelopePoints: EnvelopePoint[],
    time?: number
  ) => void;
  /** Retunes every currently-sounding voice by `semitones` (e.g. from a MIDI pitch bend wheel), a channel-wide shift, not per-note, matching how real synths respond to pitch bend. Pass 0 to return to pitch. */
  setPitchBend: (semitones: number) => void;
  /** Starts a voice for `note` and runs its attack/decay up to the sustain level. No-op if the note is already sounding. `velocityScale` (0-1) scales peak gain, e.g. from MIDI velocity/127. `time` schedules a future trigger (e.g. loop playback); omit to trigger immediately. */
  triggerNote: (
    note: number,
    envelopePoints: EnvelopePoint[],
    velocityScale?: number,
    time?: number
  ) => void;
}

interface ActiveVoice {
  gain: GainNode;
  oscillator: OscillatorNode;
  /** The gain value the attack/decay ramp settles at, used as the release ramp's starting point for scheduled-future releases, where the live AudioParam hasn't actually run the ramp yet at the moment `releaseNote` is called. */
  sustainValue: number;
  velocityScale: number;
}

/**
 * A polyphonic pool of oscillator+gain voices, one per held note, each
 * shaped by an Envelope's points: attack/decay plays up to `SUSTAIN_SPLIT_X`
 * and holds there while the note is down, release plays the rest on note-off.
 */
export function useSynthVoices({
  attackDecaySeconds = DEFAULT_ATTACK_DECAY_SECONDS,
  destination,
  oscillatorType = "sawtooth",
  peakGain = DEFAULT_PEAK_GAIN,
  releaseSeconds = DEFAULT_RELEASE_SECONDS,
}: UseSynthVoicesOptions): UseSynthVoicesReturn {
  const voicesRef = useRef(new Map<number, ActiveVoice>());
  const destinationRef = useRef(destination);
  destinationRef.current = destination;

  const stopVoice = useCallback((voice: ActiveVoice, stopTime: number) => {
    voice.oscillator.stop(stopTime);
    voice.oscillator.addEventListener(
      "ended",
      () => {
        voice.oscillator.disconnect();
        voice.gain.disconnect();
      },
      { once: true }
    );
  }, []);

  const triggerNote = useCallback(
    (
      note: number,
      envelopePoints: EnvelopePoint[],
      velocityScale = 1,
      time?: number
    ) => {
      const destinationNode = destinationRef.current;
      const ctx = destinationNode?.context;
      if (!(ctx && destinationNode) || voicesRef.current.has(note)) {
        return;
      }
      const startTime = time ?? ctx.currentTime;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = oscillatorType;
      oscillator.frequency.setValueAtTime(noteToFrequency(note), startTime);
      gain.gain.value = 0;

      oscillator.connect(gain);
      gain.connect(destinationNode);
      oscillator.start(startTime);

      const attackDecayPoints = sliceEnvelope(
        envelopePoints,
        0,
        SUSTAIN_SPLIT_X
      );
      const sustainValue =
        (attackDecayPoints.at(-1)?.y ?? 0) * peakGain * velocityScale;
      scheduleEnvelopeRamp(
        gain.gain,
        attackDecayPoints,
        startTime,
        attackDecaySeconds,
        peakGain * velocityScale,
        0
      );

      voicesRef.current.set(note, {
        gain,
        oscillator,
        sustainValue,
        velocityScale,
      });
    },
    [attackDecaySeconds, oscillatorType, peakGain]
  );

  const releaseNote = useCallback(
    (note: number, envelopePoints: EnvelopePoint[], time?: number) => {
      const voice = voicesRef.current.get(note);
      const ctx = destinationRef.current?.context;
      if (!(ctx && voice)) {
        return;
      }
      voicesRef.current.delete(note);
      const releaseTime = time ?? ctx.currentTime;
      // A live release reads the AudioParam's real current value (correct
      // mid-ramp too); a scheduled-future release can't, the attack/decay
      // ramp hasn't actually run yet at call time, so it falls back to the
      // analytically-computed sustain value instead.
      const fromValue =
        time === undefined ? voice.gain.gain.value : voice.sustainValue;

      const releasePoints = sliceEnvelope(envelopePoints, SUSTAIN_SPLIT_X, 1);
      scheduleEnvelopeRamp(
        voice.gain.gain,
        releasePoints,
        releaseTime,
        releaseSeconds,
        peakGain * voice.velocityScale,
        fromValue
      );

      stopVoice(
        voice,
        releaseTime + releaseSeconds + RELEASE_STOP_MARGIN_SECONDS
      );
    },
    [peakGain, releaseSeconds, stopVoice]
  );

  const releaseAll = useCallback(() => {
    const ctx = destinationRef.current?.context;
    if (!ctx) {
      return;
    }
    for (const voice of voicesRef.current.values()) {
      voice.gain.gain.cancelScheduledValues(ctx.currentTime);
      voice.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      stopVoice(voice, ctx.currentTime + 0.1);
    }
    voicesRef.current.clear();
  }, [stopVoice]);

  const setPitchBend = useCallback((semitones: number) => {
    const ctx = destinationRef.current?.context;
    if (!ctx) {
      return;
    }
    const ratio = 2 ** (semitones / SEMITONES_PER_OCTAVE);
    for (const [note, voice] of voicesRef.current.entries()) {
      voice.oscillator.frequency.setTargetAtTime(
        noteToFrequency(note) * ratio,
        ctx.currentTime,
        PITCH_BEND_SMOOTHING_SECONDS
      );
    }
  }, []);

  useEffect(() => releaseAll, [releaseAll]);

  return { releaseAll, releaseNote, setPitchBend, triggerNote };
}
