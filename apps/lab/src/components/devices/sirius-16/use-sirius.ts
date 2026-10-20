import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useTransportClock } from "@/hooks/use-transport-clock";
import { usePublishInspector } from "@/lib/inspector";
import {
  createSiriusEngine,
  DEFAULTS,
  type Param,
  type Wave,
} from "./audio/engine";
import { PRESETS, patternOf, pitchesOf, STEPS } from "./audio/patterns";
import { type Knobbed, NAMES, type OnParam } from "./ui/params";

const LAST_PRESET = PRESETS.length - 1;
/** How much of a step a note lasts, when the next one does not slide into it. */
const GATE = 0.55;
const pad = (n: number) => String(n + 1).padStart(2, "0");
const volumeGain = (value: number) => (value / 10) ** 2;

/**
 * What the panel reads and calls: the line on its steps, the knobs, the
 * tempo, the LCD and the transport that plays them on the shared bus. The
 * panel is drawing; the sound is `audio/`.
 */
export function useSirius() {
  const [engine] = useState(() => createSiriusEngine(DEFAULTS));
  const [preset, setPreset] = useState(0);
  const [pattern, setPattern] = useState(() => patternOf(0));
  const [pitches, setPitches] = useState(() => pitchesOf(0));
  const [settings, setSettings] = useState(DEFAULTS);
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
  const pitchesRef = useRef(pitches);
  pitchesRef.current = pitches;
  const clock = useTransportClock({
    bpm,
    onReset: () => engine.silence(),
    onStep: (step, time) => {
      const [gate, accent, slide] = patternRef.current;
      if (!gate?.[step]) {
        return;
      }
      const before = (step + STEPS - 1) % STEPS;
      const after = (step + 1) % STEPS;
      // A slid note glides from the one before it, if that one is still open.
      const tied = Boolean(slide?.[step] && gate[before]);
      engine.noteOn(
        time,
        pitchesRef.current[step] ?? 0,
        Boolean(accent?.[step]),
        tied
      );
      // It stays open into the next step when that step slides into it.
      if (!(gate[after] && slide?.[after])) {
        engine.noteOff(time + (60 / bpm / 4) * GATE);
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
  const toggle = useCallback(() => {
    if (isPlaying) {
      clock.stop();
      return;
    }
    wake();
    clock.start();
  }, [clock, isPlaying, wake]);

  /** A knob moved: the engine follows, and the LCD reads it out. */
  const onParam = useCallback<OnParam>(
    (param: Knobbed, value) => {
      setTouched(`${NAMES[param]} ${Math.round(value)}`);
      if (param === "tempo") {
        setBpm(value);
      } else if (param === "volume") {
        setVolume(value);
      } else {
        setSettings((current) => ({ ...current, [param]: value }));
        engine.set(param as Param, value);
      }
    },
    [engine]
  );
  const changeWave = useCallback(
    (value: string) => {
      setSettings((current) => ({ ...current, wave: value as Wave }));
      setTouched(null);
      engine.set("wave", value as Wave);
    },
    [engine]
  );
  const onPitch = useCallback((step: number, value: number) => {
    setPitches((current) =>
      current.map((pitch, index) => (index === step ? value : pitch))
    );
    setTouched(null);
  }, []);

  /** A pattern loads its steps, its pitches and its tempo; the sound of the voice stays as it is. */
  const load = useCallback((index: number) => {
    setPreset(index);
    setPattern(patternOf(index));
    setPitches(pitchesOf(index));
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
      accents: pattern[1]?.filter(Boolean).length ?? 0,
      pattern: presetTitle,
      slides: pattern[2]?.filter(Boolean).length ?? 0,
      steps: pattern[0]?.filter(Boolean).length ?? 0,
      tempo: bpm,
      volume,
      wave: settings.wave,
      accent: settings.accent,
      cutoff: settings.cutoff,
      decay: settings.decay,
      envmod: settings.envmod,
      resonance: settings.resonance,
    }),
    [bpm, pattern, presetTitle, settings, volume]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    bpm,
    changeWave,
    isPlaying,
    next,
    onParam,
    onPitch,
    pattern,
    pitches,
    position,
    presetTitle,
    previous,
    readout: touched ?? `${Math.round(bpm)} BPM`,
    setPattern,
    settings,
    toggle,
    volume,
  };
}
