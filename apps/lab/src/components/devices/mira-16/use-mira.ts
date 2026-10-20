import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { useTransportClock } from "@/hooks/use-transport-clock";
import { usePublishInspector } from "@/lib/inspector";
import {
  type BassSettings,
  createMiraEngine,
  DEFAULT_BASS,
  DEFAULT_KIT,
  INSTRUMENTS,
  type Instrument,
  type Kit,
} from "./audio/engine";
import { PRESETS, patternOf, pitchesOf, STEPS } from "./audio/patterns";
import {
  BASS_NAMES,
  isBass,
  MIDI_NOTES,
  NAMES,
  type OnParam,
} from "./ui/params";

/** The rows of the pattern after the instruments: the bass gate, then its accent. */
const BASS_GATE = INSTRUMENTS.length;
const BASS_ACCENT = BASS_GATE + 1;
/** How much of a step a bass note lasts. */
const GATE = 0.55;
const LAST_PRESET = PRESETS.length - 1;
const pad = (n: number) => String(n + 1).padStart(2, "0");
const volumeGain = (value: number) => (value / 10) ** 2;

/**
 * What the panel reads and calls: the pattern on its steps, the kit on its
 * knobs, the tempo, the LCD, and the transport that plays them on the shared
 * bus. The panel is drawing; the sound is `audio/`.
 */
export function useMira() {
  const [engine] = useState(() => createMiraEngine());
  const [preset, setPreset] = useState(0);
  const [pattern, setPattern] = useState(() => patternOf(0));
  const [pitches, setPitches] = useState(() => pitchesOf(0));
  const [kit, setKit] = useState<Kit>(DEFAULT_KIT);
  const [bass, setBass] = useState<BassSettings>(DEFAULT_BASS);
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
  const pitchesRef = useRef(pitches);
  pitchesRef.current = pitches;
  const clock = useTransportClock({
    bpm,
    onReset: () => engine.silence(),
    onStep: (step, time) => {
      for (const [row, instrument] of INSTRUMENTS.entries()) {
        if (patternRef.current[row]?.[step]) {
          engine.trigger(instrument, time);
        }
      }
      if (patternRef.current[BASS_GATE]?.[step]) {
        engine.noteOn(
          time,
          pitchesRef.current[step] ?? 0,
          Boolean(patternRef.current[BASS_ACCENT]?.[step])
        );
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
      } else if (isBass(param)) {
        setBass((current) => ({ ...current, [param]: value }));
        setTouched(`Bass ${BASS_NAMES[param]} ${Math.round(value)}`);
        engine.setBass(param, value);
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

  const onPitch = useCallback((step: number, value: number) => {
    setPitches((current) =>
      current.map((pitch, index) => (index === step ? value : pitch))
    );
    setTouched(null);
  }, []);

  /** A pattern loads its steps, its bass pitches and its tempo; the sound of the kit stays as it is. */
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
      bass: pattern[BASS_GATE]?.filter(Boolean).length ?? 0,
      cutoff: bass.cutoff,
      instrument: NAMES[selected].long,
      pattern: presetTitle,
      tempo: bpm,
      volume,
      ...kit[selected],
    }),
    [bass, bpm, kit, pattern, presetTitle, selected, volume]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    bpm,
    isPlaying,
    kit,
    midiConnected: midi.isConnected,
    bass,
    next,
    onParam,
    onPitch,
    pattern,
    pitches,
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
