"use client";

import { midiToHz } from "@audio/note";
import { useCallback, useState } from "react";
import {
  type GuitarNote,
  type GuitarState,
  guitarDevice,
} from "@/registry-audio/bases/base/devices/guitar/device";
import { createGuitarEngine } from "@/registry-audio/bases/base/devices/guitar/engine";
import { GuitarPanel } from "@/registry-audio/bases/base/devices/guitar/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { usePolyphony } from "@/registry-audio/bases/base/hooks/use-polyphony";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

/**
 * A plucked guitar you can plug in: its state, a panel that draws and plays
 * it, and a Web Audio engine that makes the sound, each its own file. The
 * engine plays one string; eight of them play chords. Play the keyboard, or
 * connect a MIDI keyboard and play chords on it.
 */
export default function BlockGuitar() {
  const [state, setState] = useState<GuitarState>(() =>
    guitarDevice.defaults()
  );
  const master = useMasterBus(1);
  const { noteOff, noteOn } = usePolyphony({
    create: createGuitarEngine,
    destination: master,
    state,
    // How many strings sound at once: a ninth takes the voice held longest.
    voices: 8,
  });

  const playKey = useCallback(
    (note: GuitarNote) => noteOn(note, PANEL_NOTE),
    [noteOn]
  );
  const releaseKey = useCallback(() => noteOff(PANEL_NOTE), [noteOff]);
  const midi = useMidiInput({
    onNoteOff: (pitch: number) => noteOff(`midi-${pitch}`),
    onNoteOn: (pitch: number) =>
      noteOn({ frequency: midiToHz(pitch) }, `midi-${pitch}`),
  });

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <GuitarPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
