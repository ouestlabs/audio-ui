"use client";

import { midiToHz } from "@audio/note";
import { useCallback, useState } from "react";
import {
  type TapeKeysNote,
  type TapeKeysState,
  tapeKeysDevice,
} from "@/registry-audio/bases/base/devices/tape-keys/device";
import { createTapeKeysEngine } from "@/registry-audio/bases/base/devices/tape-keys/engine";
import { TapeKeysPanel } from "@/registry-audio/bases/base/devices/tape-keys/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { usePolyphony } from "@/registry-audio/bases/base/hooks/use-polyphony";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

/**
 * A tape-replay keyboard you can plug in: its state, a panel that draws and
 * plays it, and a Web Audio engine that makes the sound, each its own file.
 * The engine plays one key's tape; eight of them play chords. Play the
 * keyboard, or connect a MIDI keyboard and play chords on it, from G2 to F5.
 */
export default function BlockTapeKeys() {
  const [state, setState] = useState<TapeKeysState>(() =>
    tapeKeysDevice.defaults()
  );
  const master = useMasterBus(1);
  const { noteOff, noteOn } = usePolyphony({
    create: createTapeKeysEngine,
    destination: master,
    state,
    // How many keys sound at once: a ninth takes the voice held longest.
    voices: 8,
  });

  const playKey = useCallback(
    (note: TapeKeysNote) => noteOn(note, PANEL_NOTE),
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
      <TapeKeysPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
