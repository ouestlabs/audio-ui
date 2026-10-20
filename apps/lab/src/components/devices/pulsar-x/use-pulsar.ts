import { pitchName } from "@audio-ui/core/pitch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { usePublishInspector } from "@/lib/inspector";
import {
  createPulsarEngine,
  cutoffHertz,
  DEFAULTS,
  type Param,
  volumeGain,
  type Wave,
} from "./audio/engine";
import { ROOT, type Scale, snap } from "./audio/scales";
import type { Knobbed, OnParam } from "./ui/params";

/** How long an arrow key's note lasts, in milliseconds: the keyboard has no finger to lift. */
const KEY_NOTE_MS = 450;
const NAMES: Record<Knobbed, string> = {
  feedback: "Feedback",
  glide: "Glide",
  mix: "Echo mix",
  resonance: "Resonance",
  time: "Echo time",
  vibrato: "Vibrato",
  volume: "Volume",
};
const hertzOf = (semitones: number) =>
  440 * 2 ** ((ROOT + semitones - 69) / 12);
const kilohertz = (hz: number) =>
  hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;

/**
 * What the panel reads and calls: the finger's place on the plate, the scale,
 * the knobs, and the voice that follows them, on the shared bus. The panel is
 * drawing; the sound is `audio/`.
 */
export function usePulsar() {
  const [engine] = useState(() => createPulsarEngine(DEFAULTS));
  const [settings, setSettings] = useState(DEFAULTS);
  const [volume, setVolume] = useState(DEFAULTS.volume);
  const [scale, setScale] = useState<Scale>("Major");
  const [point, setPoint] = useState({ x: 12, y: 60 });
  const [touching, setTouching] = useState(false);
  const [held, setHeld] = useState(false);
  const [keyHeld, setKeyHeld] = useState(false);
  const [touched, setTouched] = useState<string | null>(null);

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  // The finger's place is the pitch and the brightness.
  useEffect(() => {
    engine.pitch(point.x);
    engine.brightness(point.y);
  }, [engine, point]);

  // The voice sounds while a finger is down, while a key's note lasts, or while it is held.
  const open = touching || keyHeld || held;
  useEffect(() => {
    engine.gate(open);
  }, [engine, open]);

  // A finger lifted anywhere, even off the plate, lets go.
  useEffect(() => {
    if (!touching) {
      return;
    }
    const release = () => setTouching(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [touching]);
  const press = useCallback(() => setTouching(true), []);
  /** The plate was moved: the pitch snaps to the scale, and the thumb goes to the note. */
  const onPoint = useCallback(
    (next: { x: number; y: number }) => {
      setPoint({ x: snap(next.x, scale), y: next.y });
      setTouched(null);
    },
    [scale]
  );
  /** An arrow key moves the dot and plays it for a moment; the next key restarts the moment. */
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyDown = useCallback((event: React.KeyboardEvent) => {
    if (!event.key.startsWith("Arrow")) {
      return;
    }
    setKeyHeld(true);
    if (keyTimer.current) {
      clearTimeout(keyTimer.current);
    }
    keyTimer.current = setTimeout(() => setKeyHeld(false), KEY_NOTE_MS);
  }, []);
  useEffect(
    () => () => {
      if (keyTimer.current) {
        clearTimeout(keyTimer.current);
      }
    },
    []
  );

  const changeScale = useCallback((value: string) => {
    setScale(value as Scale);
    setPoint((current) => ({ ...current, x: snap(current.x, value as Scale) }));
    setTouched(`${value} scale`);
  }, []);
  const changeWave = useCallback(
    (value: string) => {
      setSettings((current) => ({ ...current, wave: value as Wave }));
      setTouched(`${value} wave`);
      engine.set("wave", value as Wave);
    },
    [engine]
  );
  const changeHold = useCallback((value: string) => {
    setHeld(value === "On");
    setTouched(value === "On" ? "Hold on" : "Hold off");
  }, []);
  const onParam = useCallback<OnParam>(
    (param, value) => {
      setTouched(`${NAMES[param]} ${Math.round(value)}`);
      if (param === "volume") {
        setVolume(value);
        return;
      }
      setSettings((current) => ({ ...current, [param]: value }));
      engine.set(param as Param, value);
    },
    [engine]
  );

  const note = pitchName(ROOT + Math.round(point.x));
  const inspected = useMemo(
    () => ({
      brightness: Math.round(point.y),
      feedback: settings.feedback,
      glide: settings.glide,
      hold: held ? "on" : "off",
      mix: settings.mix,
      note,
      resonance: settings.resonance,
      scale,
      time: settings.time,
      vibrato: settings.vibrato,
      volume,
      wave: settings.wave,
    }),
    [held, note, point.y, scale, settings, volume]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    changeHold,
    changeScale,
    changeWave,
    held,
    keyDown,
    onParam,
    onPoint,
    point,
    press,
    readout: touched ?? `${kilohertz(cutoffHertz(point.y))} cutoff`,
    scale,
    settings,
    title: `${note}  ${kilohertz(hertzOf(point.x))}`,
    touching: open,
    volume,
  };
}
