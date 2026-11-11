"use client";

import { midiToHz } from "@audio-ui/engine/pitch";
import { useCallback, useState } from "react";
import {
  type MonoSynthNote,
  type MonoSynthState,
  monoSynthDevice,
} from "@/registry-audio/bases/base/devices/mono-synth/device";
import { createMonoSynthEngine } from "@/registry-audio/bases/base/devices/mono-synth/engine";
import { MonoSynthPanel } from "@/registry-audio/bases/base/devices/mono-synth/panel";
import { useDeviceEngines } from "@/registry-audio/bases/base/hooks/use-device-engines";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

/**
 * A monophonic analog synth you can plug in: its state, a panel that draws
 * and plays it, and a Web Audio engine that makes the sound, each its own
 * file. The engine is the whole synth: every note goes to it, and a note
 * played while another is held glides to it. Play the keyboard, or connect a
 * MIDI keyboard and play legato lines on it.
 */
export default function BlockMonoSynth() {
  const [state, setState] = useState<MonoSynthState>(() =>
    monoSynthDevice.defaults()
  );
  const master = useMasterBus(1);
  const [engine] = useDeviceEngines({
    create: createMonoSynthEngine,
    destination: master,
    state,
  });

  const playKey = useCallback(
    (note: MonoSynthNote) => engine?.noteOn(note, { id: PANEL_NOTE }),
    [engine]
  );
  const releaseKey = useCallback(
    () => engine?.noteOff({ id: PANEL_NOTE }),
    [engine]
  );
  const midi = useMidiInput({
    onNoteOff: (pitch: number) => engine?.noteOff({ id: `midi-${pitch}` }),
    onNoteOn: (pitch: number, velocity: number) =>
      engine?.noteOn(
        { frequency: midiToHz(pitch), velocity },
        { id: `midi-${pitch}` }
      ),
  });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <MonoSynthPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
