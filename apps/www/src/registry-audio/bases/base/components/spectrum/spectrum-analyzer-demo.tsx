"use client";

import type { Piano as PianoPrimitive } from "@audio-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import { SpectrumAnalyzer } from "@/registry-audio/bases/base/audio/elements/spectrum-analyzer";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import { useWebAudio } from "@/registry-audio/bases/base/hooks/use-web-audio";
import type { EnvelopePoint } from "@/registry-audio/bases/base/lib/synth-voice";

const VOLUME = 0.5;
/** ADSR-shaped, with a long sustain so a held note stays on the analyzer. */
const ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.1, y: 1 },
  { x: 0.3, y: 0.7 },
  { x: 0.7, y: 0.7 },
  { x: 1, y: 0.05 },
];

/** Play the keyboard, or a MIDI one, and watch the spectrum: a sawtooth note lights its pitch and every harmonic above it, and the peaks hold a moment after you let go. */
export default function SpectrumAnalyzerDemo() {
  const webAudio = useWebAudio();
  const master = useMasterBus(VOLUME);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
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
  }, [master, webAudio]);

  useEffect(() => releaseAll, [releaseAll]);

  const play = useCallback(
    (pitch: number, velocity: number) => {
      const ctx = webAudio.getContext();
      if (ctx?.state === "suspended") {
        ctx.resume();
      }
      triggerNote(pitch, ENVELOPE, velocity);
    },
    [triggerNote, webAudio]
  );
  const noteOn = useCallback(
    (pitch: number, details: PianoPrimitive.Root.NoteOnEventDetails) =>
      play(pitch, details.velocity),
    [play]
  );
  const noteOff = useCallback(
    (pitch: number) => releaseNote(pitch, ENVELOPE),
    [releaseNote]
  );
  // A MIDI keyboard plays the same voices and lights the keys it holds.
  const midi = useMidiInput({ onNoteOff: noteOff, onNoteOn: play });

  return (
    <div className="flex w-full flex-col gap-3">
      <SpectrumAnalyzer aria-label="Spectrum" source={spectrum} />
      <Piano
        activeNotes={midi.activeNotes}
        aria-label="Keyboard"
        maxPitch={72}
        minPitch={48}
        onNoteOff={noteOff}
        onNoteOn={noteOn}
        size="sm"
      />
    </div>
  );
}
