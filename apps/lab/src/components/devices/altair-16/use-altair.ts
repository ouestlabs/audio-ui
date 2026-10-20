import { computePeaks } from "@audio-ui/core/analysis";
import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePublishInspector } from "@/lib/inspector";
import {
  createAltairEngine,
  DEFAULTS,
  type Param,
  SLICES,
} from "./audio/engine";
import { renderSample, SAMPLES } from "./audio/samples";
import { FIRST_NOTE, type Knobbed, NAMES, type OnParam } from "./ui/params";

const PEAKS = 1024;
const EXTENSION = /\.[^.]+$/;
const volumeGain = (value: number) => (value / 10) ** 2;

interface Loaded {
  buffer: AudioBuffer;
  name: string;
  peaks: ReturnType<typeof computePeaks>;
}

/** A file's name without its extension, for the LCD. */
const titled = (file: string) => file.replace(EXTENSION, "");

/**
 * What the panel reads and calls: the sample on the screen, the knobs, the
 * pads, and the engine that plays them on the shared bus. The panel is
 * drawing; the sound is `audio/`.
 */
export function useAltair() {
  const [engine] = useState(() => createAltairEngine());
  const [index, setIndex] = useState(0);
  const [file, setFile] = useState<Loaded | null>(null);
  const [built, setBuilt] = useState<Loaded | null>(null);
  const [settings, setSettings] = useState(DEFAULTS);
  const [volume, setVolume] = useState(7);
  const [selected, setSelected] = useState(0);
  const [touched, setTouched] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Where the sample is playing, in seconds, for the screen to follow: a source, so no render per frame.
  const [position] = useState(() => createSource(0));

  const bus = useMasterBus(volumeGain(volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  const loaded = file ?? built;
  useEffect(() => {
    engine.load(loaded?.buffer ?? null);
  }, [engine, loaded]);

  // A built-in sample is rendered once, when it is chosen.
  useEffect(() => {
    let current = true;
    setBuilt(null);
    renderSample(SAMPLES[index] ?? SAMPLES[0]).then((buffer) => {
      if (current) {
        setBuilt({
          buffer,
          name: SAMPLES[index]?.name ?? "",
          peaks: computePeaks(
            Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
              buffer.getChannelData(channel)
            ),
            PEAKS
          ),
        });
      }
    });
    return () => {
      current = false;
    };
  }, [index]);

  // The playhead is followed only while something sounds.
  const frame = useRef<number>(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const follow = useCallback(() => {
    const at = engine.position();
    if (at === null) {
      frame.current = 0;
      position.set(
        ((loaded?.buffer.duration ?? 0) / SLICES) * selectedRef.current
      );
      return;
    }
    position.set(at);
    frame.current = requestAnimationFrame(follow);
  }, [engine, loaded, position]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
    },
    []
  );

  /** Wakes the shared context: the first press is a gesture, and the promise is not awaited. */
  const wake = useCallback(() => {
    const ctx = bus?.context;
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
  }, [bus]);

  const strike = useCallback(
    (slice: number, velocity = 1) => {
      wake();
      setFailed(false);
      setSelected(slice);
      setTouched(null);
      engine.strike(slice, velocity);
      if (!frame.current) {
        frame.current = requestAnimationFrame(follow);
      }
    },
    [engine, follow, wake]
  );
  const release = useCallback(
    (slice: number) => engine.release(slice),
    [engine]
  );

  const onPadOn = useCallback(
    (value: string, details: { velocity: number }) =>
      strike(Number(value), details.velocity),
    [strike]
  );
  const onPadOff = useCallback(
    (value: string) => release(Number(value)),
    [release]
  );

  // The page's one MIDI input: pads or keys from note 36 play the slices.
  const midi = useMidiInput({
    onNoteOff: (note) => release(note - FIRST_NOTE),
    onNoteOn: (note, velocity) => {
      const slice = note - FIRST_NOTE;
      if (slice >= 0 && slice < SLICES) {
        strike(slice, velocity);
      }
    },
  });
  const activePads = useMemo(
    () =>
      midi.activeNotes
        .map((note) => note - FIRST_NOTE)
        .filter((slice) => slice >= 0 && slice < SLICES)
        .map(String),
    [midi.activeNotes]
  );

  /** The screen was pressed or dragged: the slice under the pointer plays, once each. */
  const struck = useRef(-1);
  const onScreen = useCallback(
    (at: number) => {
      const length = loaded?.buffer.duration ?? 0;
      if (length === 0) {
        return;
      }
      const slice = Math.min(SLICES - 1, Math.floor((at / length) * SLICES));
      if (slice !== struck.current) {
        release(struck.current);
        struck.current = slice;
        strike(slice, 0.85);
      }
    },
    [loaded, release, strike]
  );
  const onScreenEnd = useCallback(() => {
    release(struck.current);
    struck.current = -1;
  }, [release]);

  /** A knob moved: the engine follows, and the LCD reads it out. */
  const onParam = useCallback<OnParam>(
    (param: Knobbed, value) => {
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
  const setGate = useCallback(
    (gate: boolean) => {
      setSettings((current) => ({ ...current, gate }));
      engine.set("gate", gate);
    },
    [engine]
  );
  const setMono = useCallback(
    (mono: boolean) => {
      setSettings((current) => ({ ...current, mono }));
      engine.set("mono", mono);
    },
    [engine]
  );

  const step = useCallback((by: number) => {
    setFile(null);
    setSelected(0);
    setTouched(null);
    setIndex((current) => (current + by + SAMPLES.length) % SAMPLES.length);
  }, []);
  const next = useCallback(() => step(1), [step]);
  const previous = useCallback(() => step(-1), [step]);

  /** A file of the person's own: decoded once, then sliced like the rest. */
  const load = useCallback(
    async (chosen: File) => {
      const ctx = bus?.context;
      if (!ctx) {
        return;
      }
      setFailed(false);
      try {
        const buffer = await ctx.decodeAudioData(await chosen.arrayBuffer());
        setSelected(0);
        setTouched(null);
        setFile({
          buffer,
          name: titled(chosen.name),
          peaks: computePeaks(
            Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
              buffer.getChannelData(channel)
            ),
            PEAKS
          ),
        });
      } catch {
        setFailed(true);
      }
    },
    [bus]
  );

  const inspected = useMemo(
    () => ({
      cutoff: settings.cutoff,
      pitch: settings.pitch,
      release: settings.release,
      sample: loaded?.name ?? "",
      slice: selected + 1,
      voices: settings.mono ? "mono" : "poly",
      volume,
      "pad mode": settings.gate ? "gate" : "shot",
    }),
    [loaded, selected, settings, volume]
  );
  usePublishInspector({ output: bus, patch: inspected });

  const seconds = loaded ? loaded.buffer.duration : 0;
  const bpm = file ? null : SAMPLES[index]?.bpm;
  return {
    activePads,
    duration: seconds,
    failed,
    load,
    loaded,
    next,
    onPadOn,
    onPadOff,
    onParam,
    onScreen,
    onScreenEnd,
    position,
    previous,
    readout:
      touched ??
      (bpm ? `${bpm} BPM  ${seconds.toFixed(1)} S` : `${seconds.toFixed(1)} S`),
    selected,
    setGate,
    setMono,
    settings,
    volume,
  };
}
