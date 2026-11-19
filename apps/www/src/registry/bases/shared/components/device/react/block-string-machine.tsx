import { useCallback, useState } from "react";
import { midiToHz } from "@/engine/pitch";
import {
  type StringMachineNote,
  type StringMachineState,
  stringMachineDevice,
} from "@/registry/bases/shared/devices/string-machine/device";
import { createStringMachineEngine } from "@/registry/bases/shared/devices/string-machine/engine";
import { StringMachinePanel } from "@/registry/bases/shared/devices/string-machine/panel";
import { useMasterBus } from "@/registry/bases/shared/hooks/devices/use-master-bus";
import { usePolyphony } from "@/registry/bases/shared/hooks/devices/use-polyphony";
import { useMidiInput } from "@/registry/bases/shared/hooks/input/use-midi-input";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

/**
 * A string machine you can plug in: its state, a panel that draws and plays
 * it, and a Web Audio engine that makes the sound, each its own file. The
 * engine plays one voice; eight of them play chords. Play the keyboard, or
 * connect a MIDI keyboard and play chords on it.
 */
export default function BlockStringMachine() {
  const [state, setState] = useState<StringMachineState>(() =>
    stringMachineDevice.defaults()
  );
  const master = useMasterBus(1);
  const { noteOff, noteOn } = usePolyphony({
    create: createStringMachineEngine,
    destination: master,
    state,
    // How many notes sound at once: a ninth takes the voice held longest.
    voices: 8,
  });

  const playKey = useCallback(
    (note: StringMachineNote) => noteOn(note, PANEL_NOTE),
    [noteOn]
  );
  const releaseKey = useCallback(() => noteOff(PANEL_NOTE), [noteOff]);
  const midi = useMidiInput({
    onNoteOff: (pitch: number) => noteOff(`midi-${pitch}`),
    onNoteOn: (pitch: number, velocity: number) =>
      noteOn({ frequency: midiToHz(pitch), velocity }, `midi-${pitch}`),
  });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <StringMachinePanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
