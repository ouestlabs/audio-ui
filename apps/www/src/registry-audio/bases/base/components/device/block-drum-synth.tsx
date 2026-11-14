import { useCallback, useState } from "react";
import {
  type DrumSynthNote,
  type DrumSynthState,
  drumSynthDevice,
} from "@/registry-audio/bases/base/devices/drum-synth/device";
import { createDrumSynthEngine } from "@/registry-audio/bases/base/devices/drum-synth/engine";
import { DrumSynthPanel } from "@/registry-audio/bases/base/devices/drum-synth/panel";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/**
 * A synthesized drum you can plug in: its state, a panel that draws and
 * strikes it, and a Web Audio engine that makes the sound, each its own file.
 * One engine plays every hit, each ringing for its decay. Strike the pad, or
 * play it from a MIDI keyboard or pad controller, as hard as you like.
 */
export default function BlockDrumSynth() {
  const [state, setState] = useState<DrumSynthState>(() =>
    drumSynthDevice.defaults()
  );
  const master = useMasterBus(1);
  const [engine] = useDeviceEngines({
    create: createDrumSynthEngine,
    destination: master,
    state,
  });

  const strike = useCallback(
    (note: DrumSynthNote) => {
      webAudio.resume();
      engine?.noteOn(note);
    },
    [engine]
  );
  const midi = useMidiInput({
    onNoteOn: (_pitch: number, velocity: number) => strike({ velocity }),
  });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <DrumSynthPanel
        activeNotes={midi.activeNotes}
        onNoteOn={strike}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
