import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePublishInspector } from "@/lib/inspector";
import {
  type Chorus,
  createLyraEngine,
  type Param,
  volumeGain,
} from "./audio/engine";
import { type Patch, PRESETS, patchOf } from "./audio/presets";
import { type Knobbed, NAMES, type OnParam } from "./ui/params";

/**
 * What the panel reads and calls: the patch on its sliders, the patch name on
 * the LCD, and the engine that plays them, on the shared bus. The panel is
 * drawing; the sound is `audio/`.
 */
export function useLyra() {
  const [preset, setPreset] = useState(0);
  const [patch, setPatch] = useState<Patch>(() => patchOf(0));
  const [touched, setTouched] = useState<Knobbed | null>(null);
  const [engine] = useState(() => createLyraEngine(patchOf(0)));

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(patch.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  // What the lab shows of the device: where its sound comes out, and the patch it plays.
  const inspected = useMemo(
    () => ({ patch: PRESETS[preset]?.name ?? "", ...patch }),
    [patch, preset]
  );
  usePublishInspector({ output: bus, patch: inspected });

  /** A slider or the volume moved: the engine follows, and the LCD reads it out. */
  const onParam = useCallback<OnParam>(
    (param, value) => {
      setPatch((current) => ({ ...current, [param]: value }));
      setTouched(param);
      if (param !== "volume") {
        engine.set(param as Param, value);
      }
    },
    [engine]
  );
  const changeChorus = useCallback(
    (value: string) => {
      setPatch((current) => ({ ...current, chorus: value as Chorus }));
      setTouched(null);
      engine.set("chorus", value as Chorus);
    },
    [engine]
  );

  /** A patch loads every control at once, the engine included. */
  const load = useCallback(
    (index: number) => {
      const next = patchOf(index);
      engine.releaseAll();
      setPreset(index);
      setPatch(next);
      setTouched(null);
      for (const [key, value] of Object.entries(next)) {
        if (key !== "volume") {
          engine.set(key as Param, value as never);
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

  return {
    activeNotes: midi.activeNotes,
    changeChorus,
    load,
    noteOff: engine.noteOff,
    onParam,
    patch,
    preset,
    pressKey,
    presetTitle: `${String(preset + 1).padStart(2, "0")} ${PRESETS[preset]?.name.toUpperCase()}`,
    readout: touched
      ? `${NAMES[touched]} ${Math.round(patch[touched])}`
      : `Chorus ${patch.chorus}`,
  };
}
