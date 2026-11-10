"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type MonoSynthNote,
  type MonoSynthState,
  monoSynthDevice,
} from "@/registry-audio/bases/base/devices/mono-synth/device";
import {
  createMonoSynthEngine,
  type MonoSynthEngine,
} from "@/registry-audio/bases/base/devices/mono-synth/engine";
import { MonoSynthPanel } from "@/registry-audio/bases/base/devices/mono-synth/panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useMidiInput } from "@/registry-audio/bases/base/hooks/use-midi-input";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

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
  const [engine, setEngine] = useState<MonoSynthEngine | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const made = createMonoSynthEngine(ctx, stateRef.current);
    made.output.connect(master);
    setEngine(made);
    return () => {
      made.dispose();
      setEngine(null);
    };
  }, [master]);

  // The engine follows the state, whoever changed it: a control or a call.
  useEffect(() => {
    engine?.update(state);
  }, [engine, state]);

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
        { frequency: noteToFrequency(pitch), velocity },
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
