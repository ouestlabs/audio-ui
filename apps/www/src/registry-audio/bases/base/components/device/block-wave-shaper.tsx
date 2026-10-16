"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { WaveShaperPanel } from "@/registry-audio/bases/base/audio/panels/wave-shaper-panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type WaveShaperNote,
  type WaveShaperState,
  waveShaperDevice,
} from "@/registry-audio/bases/base/lib/wave-shaper-device";
import {
  createWaveShaperEngine,
  type WaveShaperEngine,
} from "@/registry-audio/bases/base/lib/wave-shaper-engine";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/**
 * A wave shaper synth you can plug in: its state, a panel that draws and plays
 * it and an engine that makes the sound, each its own file and none knowing
 * the others. Press the pad and move: pitch goes across, the resonance up.
 */
export default function BlockWaveShaper() {
  const [state, setState] = useState<WaveShaperState>(() =>
    waveShaperDevice.defaults()
  );
  const master = useMasterBus(1);
  const [engine, setEngine] = useState<WaveShaperEngine | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const synth = createWaveShaperEngine(ctx, stateRef.current);
    synth.output.connect(master);
    setEngine(synth);
    return () => {
      synth.dispose();
      setEngine(null);
    };
  }, [master]);

  // The engine follows the state, whoever changed it: a button or a knob.
  useEffect(() => {
    engine?.update(state);
  }, [engine, state]);

  const play = useCallback(
    (note: WaveShaperNote) => engine?.noteOn(note),
    [engine]
  );
  const release = useCallback(() => engine?.noteOff(), [engine]);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <WaveShaperPanel
        onNoteOff={release}
        onNoteOn={play}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
