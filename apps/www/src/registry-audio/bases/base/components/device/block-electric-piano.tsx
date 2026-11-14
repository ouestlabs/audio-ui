import { midiToHz } from "@audio-ui/engine/pitch";
import { useCallback, useState } from "react";
import {
  type ElectricPianoNote,
  type ElectricPianoState,
  electricPianoDevice,
} from "@/registry-audio/bases/base/devices/electric-piano/device";
import { createElectricPianoEngine } from "@/registry-audio/bases/base/devices/electric-piano/engine";
import { ElectricPianoPanel } from "@/registry-audio/bases/base/devices/electric-piano/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { usePolyphony } from "@/registry-audio/bases/base/hooks/use-polyphony";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

/**
 * A tine electric piano you can plug in: its state, a panel that draws and
 * plays it, and a Web Audio engine that makes the sound, each its own file.
 * The engine plays one voice; ten of them play chords. Play the keyboard, or
 * connect a MIDI keyboard and play chords on it: a hard key barks and pings.
 */
export default function BlockElectricPiano() {
  const [state, setState] = useState<ElectricPianoState>(() =>
    electricPianoDevice.defaults()
  );
  const master = useMasterBus(1);
  const { noteOff, noteOn } = usePolyphony({
    create: createElectricPianoEngine,
    destination: master,
    state,
    // How many notes ring at once: an eleventh takes the voice held longest.
    voices: 10,
  });

  const playKey = useCallback(
    (note: ElectricPianoNote) => noteOn(note, PANEL_NOTE),
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
      <ElectricPianoPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
