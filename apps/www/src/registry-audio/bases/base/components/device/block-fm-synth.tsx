"use client";

import { midiToHz } from "@audio/note";
import { useCallback, useState } from "react";
import {
  type FmSynthNote,
  type FmSynthState,
  fmSynthDevice,
} from "@/registry-audio/bases/base/devices/fm-synth/device";
import { createFmSynthEngine } from "@/registry-audio/bases/base/devices/fm-synth/engine";
import { FmSynthPanel } from "@/registry-audio/bases/base/devices/fm-synth/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { usePolyphony } from "@/registry-audio/bases/base/hooks/use-polyphony";

/** The note the panel's keyboard holds: one at a time, under its own name. */
const PANEL_NOTE = "panel";

/**
 * An eighties four-operator FM synth you can plug in: its state, a panel that
 * draws and plays it, and a Web Audio engine that makes the sound, each its
 * own file. The engine plays one voice; eight of them play chords. Play the
 * keyboard, or connect a MIDI keyboard and play chords on it.
 */
export default function BlockFmSynth() {
  const [state, setState] = useState<FmSynthState>(() =>
    fmSynthDevice.defaults()
  );
  const master = useMasterBus(1);
  const { noteOff, noteOn } = usePolyphony({
    create: createFmSynthEngine,
    destination: master,
    state,
    // How many notes sound at once: a ninth takes the voice held longest.
    voices: 8,
  });

  const playKey = useCallback(
    (note: FmSynthNote) => noteOn(note, PANEL_NOTE),
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
      <FmSynthPanel
        activeNotes={midi.activeNotes}
        onNoteOff={releaseKey}
        onNoteOn={playKey}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
