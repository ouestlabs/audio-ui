"use client";

import { useCallback, useEffect, useState } from "react";
import { SpectrumAnalyzer } from "@/registry-audio/bases/base/audio/elements/spectrum-analyzer";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/envelope-ramp";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const VOLUME = 0.4;
/** A, E, A and E again: a fifth, so the harmonics of the notes meet on the spectrum. */
const CHORD = [45, 52, 57, 64];
/** Held at full level until it is released. */
const ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.1, y: 1 },
  { x: 0.9, y: 1 },
  { x: 1, y: 0.05 },
];

/** Press play, in the bar above, or play a MIDI keyboard connected from it, to hold a chord of sawtooth notes and watch the spectrum: each note lights its pitch and every harmonic above it, and the peaks hold a moment after you stop. */
export default function SpectrumAnalyzerDemo() {
  const master = useMasterBus(VOLUME);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const { playing } = usePlaySwitch();
  const spectrum = useSpectrum(analyser);
  const { releaseAll, releaseNote, triggerNote } = useSynthVoices({
    destination: master,
    oscillatorType: "sawtooth",
  });

  // The analyzer listens to the master bus, alongside the speakers.
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const node = ctx.createAnalyser();
    node.fftSize = 8192;
    node.smoothingTimeConstant = 0.75;
    master.connect(node);
    setAnalyser(node);
    // No disconnect here: the master bus drops all its outputs when it goes, and may already have.
    return () => setAnalyser(null);
  }, [master]);

  useEffect(() => releaseAll, [releaseAll]);

  // The page's play switch, in the preview's bar, holds the chord.
  useEffect(() => {
    if (!playing) {
      return;
    }
    const ctx = webAudio.getContext();
    if (ctx?.state === "suspended") {
      ctx.resume();
    }
    for (const pitch of CHORD) {
      triggerNote(pitch, ENVELOPE, 0.6);
    }
    return () => {
      for (const pitch of CHORD) {
        releaseNote(pitch, ENVELOPE);
      }
    };
  }, [playing, releaseNote, triggerNote]);

  // A MIDI keyboard, connected from the bar, plays the same voices.
  const noteOn = useCallback(
    (pitch: number, velocity: number) => {
      const ctx = webAudio.getContext();
      if (ctx?.state === "suspended") {
        ctx.resume();
      }
      triggerNote(pitch, ENVELOPE, velocity);
    },
    [triggerNote]
  );
  const noteOff = useCallback(
    (pitch: number) => releaseNote(pitch, ENVELOPE),
    [releaseNote]
  );
  useMidiInput({ onNoteOff: noteOff, onNoteOn: noteOn });

  return <SpectrumAnalyzer aria-label="Spectrum" source={spectrum} />;
}
