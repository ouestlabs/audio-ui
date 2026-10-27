import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePublishInspector } from "@/lib/inspector";
import { algorithmOf } from "./audio/algorithms";
import { createNovaEngine, type Param, volumeGain } from "./audio/engine";
import { type Patch, PRESETS, patchOf } from "./audio/presets";
import { type Knobbed, type OnParam, readout } from "./ui/params";

/**
 * What the panel reads and calls: the voice on its knobs and sliders, the
 * algorithm on the LCD, and the engine that plays them, on the shared bus. The
 * panel is drawing; the sound is `audio/`.
 */
export function useNova() {
  const [preset, setPreset] = useState(0);
  const [patch, setPatch] = useState<Patch>(() => patchOf(0));
  const [touched, setTouched] = useState<Knobbed | null>(null);
  const [engine] = useState(() => createNovaEngine(patchOf(0)));

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(patch.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  // What the lab shows of the device: where its sound comes out, and the voice it plays.
  const inspected = useMemo(
    () => ({ voice: PRESETS[preset]?.name ?? "", ...patch }),
    [patch, preset]
  );
  usePublishInspector({ output: bus, patch: inspected });

  /** A knob, a slider or an algorithm button moved: the engine follows, and the LCD reads it out. */
  const onParam = useCallback<OnParam>(
    (param, value) => {
      setPatch((current) => ({ ...current, [param]: value }));
      setTouched(param);
      if (param !== "volume") {
        engine.set(param, value);
      }
    },
    [engine]
  );
  const changeAlgorithm = useCallback(
    (index: number) => onParam("algorithm", index + 1),
    [onParam]
  );

  /** A voice loads every control at once, the engine included. */
  const load = useCallback(
    (index: number) => {
      const next = patchOf(index);
      engine.releaseAll();
      setPreset(index);
      setPatch(next);
      setTouched(null);
      for (const [key, value] of Object.entries(next)) {
        if (key !== "volume") {
          engine.set(key as Param, value);
        }
      }
    },
    [engine]
  );

  // The page's one MIDI input: a keyboard plays the voices, and its notes light the keys.
  const midi = useMidiInput({
    onNoteOff: engine.noteOff,
    onNoteOn: engine.noteOn,
  });
  /** A key of the on-screen keyboard: its details carry the velocity. */
  const pressKey = useCallback(
    (pitch: number, details: { velocity: number }) =>
      engine.noteOn(pitch, details.velocity),
    [engine]
  );

  const algorithm = algorithmOf(patch.algorithm);
  return {
    activeNotes: midi.activeNotes,
    algorithm,
    changeAlgorithm,
    load,
    noteOff: engine.noteOff,
    onParam,
    patch,
    preset,
    pressKey,
    presetTitle: `${String(preset + 1).padStart(2, "0")} ${PRESETS[preset]?.name.toUpperCase()}`,
    readout: touched
      ? readout(touched, patch[touched])
      : `Algorithm ${patch.algorithm}`,
  };
}
