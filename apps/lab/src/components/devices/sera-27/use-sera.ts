import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useTransportClock } from "@/hooks/use-transport-clock";
import { usePublishInspector } from "@/lib/inspector";
import {
  bassOf,
  type Chord,
  chordName,
  padOf,
  stringsOf,
} from "./audio/chords";
import { createSeraEngine, DEFAULTS } from "./audio/engine";
import { PATTERNS, type Rhythm } from "./audio/rhythms";
import type { Knobbed } from "./ui/dial";
import { REST } from "./ui/plate";

const STEPS_PER_BEAT = 4;

/**
 * What the panel reads and calls: the chord on the buttons, the finger on the
 * plate, the rhythm and its tempo, and the levels, on the shared bus. The
 * panel is drawing; the sound is `audio/`.
 */
export function useSera() {
  const [engine] = useState(() => createSeraEngine(DEFAULTS));
  const [settings, setSettings] = useState(DEFAULTS);
  const [chord, setChord] = useState<Chord>({ quality: "major", root: 0 });
  const [finger, setFinger] = useState(REST);
  const [rhythm, setRhythm] = useState<Rhythm>("Rock");
  const [bpm, setBpm] = useState(PATTERNS.Rock.bpm);

  // The sections own their levels: the shared bus stays at unity, with its limiter.
  const bus = useMasterBus(1);
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  const strings = useMemo(() => stringsOf(chord), [chord]);

  // The rhythm box: drums, and the bass and stabs of whatever chord is chosen when the step comes.
  const chordRef = useRef(chord);
  chordRef.current = chord;
  const pattern = PATTERNS[rhythm];
  const clock = useTransportClock({
    bpm,
    onStep: (step, time) => {
      const now = chordRef.current;
      if (pattern.kick.includes(step)) {
        engine.drum("kick", time);
      }
      if (pattern.snare.includes(step)) {
        engine.drum("snare", time);
      }
      if (pattern.hat.includes(step)) {
        engine.drum("hat", time);
      }
      for (const bass of pattern.bass) {
        if (bass.step === step) {
          engine.bass(bassOf(now, bass.degree), time);
        }
      }
      if (pattern.chord.includes(step)) {
        engine.stab(padOf(now), time);
      }
    },
    stepsPerBeat: STEPS_PER_BEAT,
    totalSteps: pattern.steps,
  });

  /** Wakes the shared context: the first press is a gesture, and the promise is not awaited. */
  const wake = useCallback(() => {
    const ctx = bus?.context;
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
  }, [bus]);

  const { isPlaying } = clock;
  const toggle = useCallback(() => {
    if (isPlaying) {
      clock.stop();
      return;
    }
    wake();
    clock.start();
  }, [clock, isPlaying, wake]);

  /** A rhythm brings its own tempo, as the box's presets do. */
  const changeRhythm = useCallback((next: string) => {
    setRhythm(next as Rhythm);
    setBpm(PATTERNS[next as Rhythm].bpm);
  }, []);

  /** A chord button goes down: the chord is chosen, and the pad holds it until the button comes up. */
  const pressChord = useCallback(
    (next: Chord) => {
      setChord(next);
      engine.padOn(padOf(next));
    },
    [engine]
  );
  const releaseChord = useCallback(() => engine.padOff(), [engine]);

  /**
   * The finger moved on the plate: a drag strikes every string it crossed,
   * from rest too, a tap or a key the one it landed on. Resting below the
   * strings strikes none.
   */
  const fingerRef = useRef(finger);
  fingerRef.current = finger;
  const strum = useCallback(
    (next: number, reason: string) => {
      const from = fingerRef.current;
      fingerRef.current = next;
      setFinger(next);
      if (reason !== "drag") {
        const pitch = strings[next];
        if (pitch !== undefined) {
          engine.strike(pitch);
        }
        return;
      }
      const way = next > from ? 1 : -1;
      for (let string = from + way; string !== next + way; string += way) {
        const pitch = strings[string];
        if (pitch !== undefined) {
          engine.strike(pitch);
        }
      }
    },
    [engine, strings]
  );
  /** A pointer let go of the plate: the finger goes back to rest, so the next tap strikes even the same string. */
  const lift = useCallback((_value: number, reason: string) => {
    if (reason === "drag" || reason === "track-press") {
      setFinger(REST);
    }
  }, []);

  const onParam = useCallback(
    (param: Knobbed, value: number) => {
      if (param === "tempo") {
        setBpm(value);
        return;
      }
      setSettings((current) => ({ ...current, [param]: value }));
      engine.set(param, value);
    },
    [engine]
  );

  const inspected = useMemo(
    () => ({
      chord: chordName(chord),
      pattern: rhythm,
      tempo: bpm,
      transport: isPlaying ? "running" : "stopped",
      ...settings,
    }),
    [bpm, chord, isPlaying, rhythm, settings]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    bpm,
    changeRhythm,
    chord,
    finger,
    getPosition: clock.getPosition,
    isPlaying,
    lift,
    onParam,
    pressChord,
    releaseChord,
    rhythm,
    settings,
    stepsPerBeat: STEPS_PER_BEAT,
    strings,
    strum,
    toggle,
  };
}
