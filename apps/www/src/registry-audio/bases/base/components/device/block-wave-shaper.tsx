"use client";

import { useCallback, useState } from "react";
import {
  type WaveShaperNote,
  type WaveShaperState,
  waveShaperDevice,
} from "@/registry-audio/bases/base/devices/wave-shaper/device";
import { createWaveShaperEngine } from "@/registry-audio/bases/base/devices/wave-shaper/engine";
import { WaveShaperPanel } from "@/registry-audio/bases/base/devices/wave-shaper/panel";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

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
  const [engine] = useDeviceEngines({
    create: createWaveShaperEngine,
    destination: master,
    state,
  });

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
