"use client";

import { useCallback, useState } from "react";
import {
  type PocketSynthNote,
  type PocketSynthState,
  pocketSynthDevice,
} from "@/registry-audio/bases/base/devices/pocket-synth/device";
import { createPocketSynthEngine } from "@/registry-audio/bases/base/devices/pocket-synth/engine";
import { PocketSynthPanel } from "@/registry-audio/bases/base/devices/pocket-synth/panel";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

/**
 * A synth you can plug in: its state, a panel that draws and plays it and an
 * engine that makes the sound, each its own file and none knowing the others.
 * Press the pad and move: pitch goes across, the filter cutoff up.
 */
export default function BlockPocketSynth() {
  const [state, setState] = useState<PocketSynthState>(() =>
    pocketSynthDevice.defaults()
  );
  const master = useMasterBus(1);
  const [engine] = useDeviceEngines({
    create: createPocketSynthEngine,
    destination: master,
    state,
  });

  const play = useCallback(
    (note: PocketSynthNote) => engine?.noteOn(note),
    [engine]
  );
  const release = useCallback(() => engine?.noteOff(), [engine]);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <PocketSynthPanel
        onNoteOff={release}
        onNoteOn={play}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
