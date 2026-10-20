import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { useTransportClock } from "@/hooks/use-transport-clock";
import { usePublishInspector } from "@/lib/inspector";
import {
  createVegaEngine,
  DEFAULT_KIT,
  INSTRUMENTS,
  type Instrument,
  type Kit,
} from "./audio/engine";
import { PRESETS, patternOf, STEPS } from "./audio/patterns";
import { MIDI_NOTES, NAMES, type OnParam } from "./ui/params";

const LAST_PRESET = PRESETS.length - 1;
const pad = (n: number) => String(n + 1).padStart(2, "0");
const volumeGain = (value: number) => (value / 10) ** 2;

/**
 * What the panel reads and calls: the pattern on its steps, the kit on its
 * knobs, the tempo, the LCD, and the transport that plays them on the shared
 * bus. The panel is drawing; the sound is `audio/`.
 */
export function useVega() {
  const [engine] = useState(() => createVegaEngine());
  const [preset, setPreset] = useState(0);
  const [pattern, setPattern] = useState(() => patternOf(0));
  const [kit, setKit] = useState<Kit>(DEFAULT_KIT);
  const [selected, setSelected] = useState<Instrument>("kick");
  const [bpm, setBpm] = useState(PRESETS[0]?.bpm ?? 120);
  const [volume, setVolume] = useState(7);
  const [touched, setTouched] = useState<string | null>(null);
  // The step being played, for the grid to light: a source, so no render per step.
  const [position] = useState(() => createSource(-1));

  const bus = useMasterBus(volumeGain(volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  const patternRef = useRef(pattern);
  patternRef.current = pattern;
  const clock = useTransportClock({
    bpm,
    onStep: (step, time) => {
      for (const [row, instrument] of INSTRUMENTS.entries()) {
        if (patternRef.current[row]?.[step]) {
          engine.trigger(instrument, time);
        }
      }
    },
    totalSteps: STEPS,
  });

  const { getPosition, isPlaying } = clock;
  useEffect(() => {
    if (!isPlaying) {
      position.set(-1);
      return;
    }
    let frame = 0;
    const tick = () => {
      position.set(getPosition());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getPosition, isPlaying, position]);

  /** Wakes the shared context: the first press is a gesture, and the promise is not awaited. */
  const wake = useCallback(() => {
    const ctx = bus?.context;
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
  }, [bus]);

  /** Plays an instrument now: a key of the panel, or a note of a MIDI keyboard. */
  const hit = useCallback(
    (instrument: Instrument, velocity = 1) => {
      wake();
      if (bus) {
        engine.trigger(instrument, bus.context.currentTime + 0.005, velocity);
      }
    },
    [bus, engine, wake]
  );
  const midi = useMidiInput({
    onNoteOn: (note, velocity) => {
      const instrument = MIDI_NOTES[note];
      if (instrument) {
        hit(instrument, velocity);
      }
    },
  });

  const toggle = useCallback(() => {
    if (isPlaying) {
      clock.stop();
      return;
    }
    wake();
    clock.start();
  }, [clock, isPlaying, wake]);

  const select = useCallback(
    (instrument: Instrument) => {
      setSelected(instrument);
      setTouched(null);
      hit(instrument);
    },
    [hit]
  );

  /** A knob moved: the engine follows (the selected instrument's three), and the LCD reads it out. */
  const onParam = useCallback<OnParam>(
    (param, value) => {
      if (param === "tempo") {
        setBpm(value);
        setTouched(`Tempo ${Math.round(value)}`);
      } else if (param === "volume") {
        setVolume(value);
        setTouched(`Volume ${Math.round(value)}`);
      } else {
        setKit((current) => ({
          ...current,
          [selected]: { ...current[selected], [param]: value },
        }));
        setTouched(`${NAMES[selected].short} ${param} ${Math.round(value)}`);
        engine.set(selected, param, value);
      }
    },
    [engine, selected]
  );

  /** A pattern loads its steps and its tempo; the sound of the kit stays as it is. */
  const load = useCallback((index: number) => {
    setPreset(index);
    setPattern(patternOf(index));
    setBpm(PRESETS[index]?.bpm ?? 120);
    setTouched(null);
  }, []);
  const previous = useCallback(
    () => load(preset === 0 ? LAST_PRESET : preset - 1),
    [load, preset]
  );
  const next = useCallback(
    () => load(preset === LAST_PRESET ? 0 : preset + 1),
    [load, preset]
  );

  const presetTitle = `${pad(preset)} ${PRESETS[preset]?.name.toUpperCase()}`;
  const inspected = useMemo(
    () => ({
      instrument: NAMES[selected].long,
      pattern: presetTitle,
      tempo: bpm,
      volume,
      ...kit[selected],
    }),
    [bpm, kit, presetTitle, selected, volume]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    bpm,
    isPlaying,
    kit,
    midiConnected: midi.isConnected,
    next,
    onParam,
    pattern,
    position,
    presetTitle,
    previous,
    readout: touched ?? `${Math.round(bpm)} BPM`,
    select,
    selected,
    setPattern,
    toggle,
    volume,
  };
}
