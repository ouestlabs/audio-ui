import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePublishInspector } from "@/lib/inspector";
import {
  createCapellaEngine,
  type Decay,
  type Harmonic,
  type Leslie,
  type Settings,
  volumeGain,
} from "./audio/engine";
import { type Patch, PRESETS, patchOf } from "./audio/presets";
import type { OnDrawbar, OnKnob, OnSwitch } from "./ui/params";

/**
 * What the panel reads and calls: the registration on its drawbars, the
 * switches and knobs, and the organ that plays them, on the shared bus. The
 * panel is drawing; the sound is `audio/`.
 */
export function useCapella() {
  const [preset, setPreset] = useState<number | null>(0);
  const [patch, setPatch] = useState<Patch>(() => patchOf(0));
  const [engine] = useState(() => createCapellaEngine(patchOf(0)));

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(patch.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  /** The nine drawbars as they are written on the organ: 88 8000 000. */
  const registration = patch.drawbars.join("");

  // What the lab shows of the organ: where its sound comes out, and the registration it plays.
  const inspected = useMemo(
    () => ({
      click: patch.click,
      drawbars: registration,
      drive: patch.drive,
      leslie: patch.leslie,
      percussion: patch.percussion
        ? `${patch.harmonic} ${patch.decay.toLowerCase()}`
        : "off",
      volume: patch.volume,
    }),
    [patch, registration]
  );
  usePublishInspector({ output: bus, patch: inspected });

  const onDrawbar = useCallback<OnDrawbar>(
    (index, level) => {
      const drawbars = patch.drawbars.map((current, at) =>
        at === index ? level : current
      );
      setPatch((current) => ({ ...current, drawbars }));
      setPreset(null);
      engine.set("drawbars", drawbars);
    },
    [engine, patch.drawbars]
  );
  const onKnob = useCallback<OnKnob>(
    (knob, value) => {
      setPatch((current) => ({ ...current, [knob]: value }));
      if (knob !== "volume") {
        engine.set(knob, value);
      }
    },
    [engine]
  );
  const onSwitch = useCallback<OnSwitch>(
    (key, value) => {
      setPatch((current) => ({ ...current, [key]: value }));
      engine.set(key as keyof Settings, value as never);
    },
    [engine]
  );

  /** The switches speak in words; each one sets its own part of the patch. */
  const setPercussion = useCallback(
    (value: string) => onSwitch("percussion", value === "On"),
    [onSwitch]
  );
  const setHarmonic = useCallback(
    (value: string) => onSwitch("harmonic", value as Harmonic),
    [onSwitch]
  );
  const setDecay = useCallback(
    (value: string) => onSwitch("decay", value as Decay),
    [onSwitch]
  );
  const setLeslie = useCallback(
    (value: string) => onSwitch("leslie", value as Leslie),
    [onSwitch]
  );

  /** A preset key loads a whole registration: the drawbars, the switches and the knobs. */
  const load = useCallback(
    (index: number) => {
      const next = patchOf(index);
      engine.releaseAll();
      setPreset(index);
      setPatch(next);
      for (const [key, value] of Object.entries(next)) {
        if (key !== "volume") {
          engine.set(key as keyof Settings, value as never);
        }
      }
    },
    [engine]
  );

  // The page's one MIDI input: a keyboard plays the organ, and its notes light the keys.
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
    load,
    noteOff: engine.noteOff,
    onDrawbar,
    onKnob,
    patch,
    preset,
    presets: PRESETS,
    pressKey,
    setDecay,
    setHarmonic,
    setLeslie,
    setPercussion,
    registration: `${registration.slice(0, 2)} ${registration.slice(2, 6)} ${registration.slice(6)}`,
  };
}
