"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PocketSynthPanel } from "@/registry-audio/bases/base/audio/panels/pocket-synth-panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type PocketSynthNote,
  type PocketSynthState,
  pocketSynthDevice,
} from "@/registry-audio/bases/base/lib/pocket-synth-device";
import {
  createPocketSynthEngine,
  type PocketSynthEngine,
} from "@/registry-audio/bases/base/lib/pocket-synth-engine";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

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
  const [engine, setEngine] = useState<PocketSynthEngine | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(ctx && master)) {
      return;
    }
    const synth = createPocketSynthEngine(ctx, stateRef.current);
    synth.output.connect(master);
    setEngine(synth);
    return () => {
      synth.dispose();
      setEngine(null);
    };
  }, [master]);

  // The engine follows the state, whoever changed it: a button or a call.
  useEffect(() => {
    engine?.update(state);
  }, [engine, state]);

  const play = useCallback(
    (note: PocketSynthNote) => engine?.noteOn(note),
    [engine]
  );
  const release = useCallback(() => engine?.noteOff(), [engine]);

  return (
    <div className="h-full w-full min-w-0">
      <PocketSynthPanel
        onNoteOff={release}
        onNoteOn={play}
        onValueChange={setState}
        value={state}
      />
    </div>
  );
}
