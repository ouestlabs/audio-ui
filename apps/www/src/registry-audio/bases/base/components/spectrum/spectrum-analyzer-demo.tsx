"use client";

import { useCallback, useEffect, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { SpectrumAnalyzer } from "@/registry-audio/bases/base/audio/elements/spectrum-analyzer";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
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

/** Play a chord of sawtooth notes and watch the spectrum: each note lights its pitch and every harmonic above it, and the peaks hold a moment after you stop. */
export default function SpectrumAnalyzerDemo() {
  const master = useMasterBus(VOLUME);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [playing, setPlaying] = useState(false);
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

  const toggle = useCallback(() => {
    const ctx = webAudio.getContext();
    if (ctx?.state === "suspended") {
      ctx.resume();
    }
    for (const pitch of CHORD) {
      if (playing) {
        releaseNote(pitch, ENVELOPE);
      } else {
        triggerNote(pitch, ENVELOPE, 0.6);
      }
    }
    setPlaying(!playing);
  }, [playing, releaseNote, triggerNote]);

  return (
    <div className="flex w-full flex-col gap-3">
      <SpectrumAnalyzer aria-label="Spectrum" source={spectrum} />
      <Button
        aria-label={playing ? "Stop the chord" : "Play a chord"}
        className="self-start"
        onClick={toggle}
        size="icon-sm"
        variant="outline"
      >
        {playing ? (
          <IconPlaceholder
            hugeicons="PauseIcon"
            lucide="PauseIcon"
            phosphor="PauseIcon"
            remixicon="RiPauseLine"
            tabler="IconPlayerPause"
          />
        ) : (
          <IconPlaceholder
            hugeicons="PlayIcon"
            lucide="PlayIcon"
            phosphor="PlayIcon"
            remixicon="RiPlayLine"
            tabler="IconPlayerPlay"
          />
        )}
      </Button>
    </div>
  );
}
