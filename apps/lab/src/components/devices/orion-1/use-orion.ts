import { useCallback, useEffect, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { createOrionEngine, volumeGain, type Wave } from "./audio/engine.ts";
import { type Patch, PRESETS, patchOf } from "./audio/presets.ts";
import { type Knobbed, NAMES, type OnParam } from "./ui/params.ts";

const LAST_PRESET = PRESETS.length - 1;
const pad = (n: number) => String(n + 1).padStart(2, "0");

/**
 * What the panel reads and calls: the patch on its controls, the preset on
 * the LCD, and the voice that plays them, on the shared bus. The panel is
 * drawing; the sound is `audio/`.
 */
export function useOrion() {
  const [power, setPower] = useState(true);
  const [preset, setPreset] = useState(0);
  const [patch, setPatch] = useState<Patch>(() => patchOf(0));
  const [touched, setTouched] = useState<Knobbed | null>(null);
  const [held, setHeld] = useState(0);
  const [engine] = useState(() => createOrionEngine());

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(patch.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  const togglePower = useCallback(() => {
    setPower((on) => {
      engine.setPower(!on);
      return !on;
    });
  }, [engine]);

  /** A control moved: the engine follows, and the LCD reads it out. */
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
  const changeWave = useCallback(
    (value: string) => {
      setPatch((current) => ({ ...current, wave: value as Wave }));
      setTouched(null);
      engine.set("wave", value as Wave);
    },
    [engine]
  );

  /** A preset loads every control at once, the engine included. */
  const load = useCallback(
    (index: number) => {
      const next = patchOf(index);
      setPreset(index);
      setPatch(next);
      setTouched(null);
      for (const [key, value] of Object.entries(next)) {
        if (key !== "volume") {
          engine.set(key as Parameters<typeof engine.set>[0], value as never);
        }
      }
    },
    [engine]
  );
  const previous = useCallback(
    () => load(preset === 0 ? LAST_PRESET : preset - 1),
    [load, preset]
  );
  const next = useCallback(
    () => load(preset === LAST_PRESET ? 0 : preset + 1),
    [load, preset]
  );

  const noteOn = useCallback(
    (pitch: number) => {
      setHeld((count) => count + 1);
      engine.noteOn(pitch);
    },
    [engine]
  );
  const noteOff = useCallback(
    (pitch: number) => {
      setHeld((count) => Math.max(0, count - 1));
      engine.noteOff(pitch);
    },
    [engine]
  );

  return {
    changeWave,
    held,
    next,
    noteOff,
    noteOn,
    onParam,
    patch,
    power,
    presetTitle: `${pad(preset)} ${PRESETS[preset]?.name}`,
    previous,
    readout: touched
      ? `${NAMES[touched]} ${Math.round(patch[touched])}`
      : patch.wave,
    togglePower,
  };
}
