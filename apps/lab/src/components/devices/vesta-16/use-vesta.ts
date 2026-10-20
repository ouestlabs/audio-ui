import { createSource } from "@audio-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { useTransportClock } from "@/hooks/use-transport-clock";
import { usePublishInspector } from "@/lib/inspector";
import {
  createVestaEngine,
  DEFAULT_PAD,
  PADS,
  type PadControl,
  type PadSettings,
  STEPS,
} from "./audio/engine";
import { KITS, type Kit, renderKit, SAMPLE_NAMES } from "./audio/kits";
import { NAMES, type OnParam, type Param } from "./ui/params";

/** The first note of a MIDI keyboard or pads that plays a pad: pad 1 is note 36, as on drum pads. */
const FIRST_NOTE = 36;
const volumeGain = (value: number) => (value / 10) ** 2;
const emptyLoop = () =>
  Array.from({ length: PADS }, () =>
    Array.from({ length: STEPS }, () => false)
  );

/**
 * What the panel reads and calls: the kit, the pads' own settings, the loop
 * being recorded, the tempo and the transport that plays them on the shared
 * bus. The panel is drawing; the sound is `audio/`.
 */
export function useVesta() {
  const [engine] = useState(() => createVestaEngine());
  const [kit, setKit] = useState<Kit>("808");
  const [ready, setReady] = useState(false);
  const [pads, setPads] = useState<PadSettings[]>(() =>
    Array.from({ length: PADS }, () => ({ ...DEFAULT_PAD }))
  );
  const [loop, setLoop] = useState(emptyLoop);
  const [selected, setSelected] = useState(0);
  const [recording, setRecording] = useState(false);
  const [bpm, setBpm] = useState(96);
  const [volume, setVolume] = useState(7);
  const [touched, setTouched] = useState<string | null>(null);
  // The step being played, for the lamps to mark: a source, so no render per step.
  const [position] = useState(() => createSource(-1));

  const bus = useMasterBus(volumeGain(volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  // A kit is rendered once, when it is first chosen, and kept.
  const rendered = useRef(new Map<Kit, AudioBuffer[]>());
  useEffect(() => {
    let current = true;
    setReady(false);
    const known = rendered.current.get(kit);
    const loading = known ? Promise.resolve(known) : renderKit(kit);
    loading.then((buffers) => {
      if (current) {
        rendered.current.set(kit, buffers);
        engine.load(buffers);
        setReady(true);
      }
    });
    return () => {
      current = false;
    };
  }, [engine, kit]);

  const loopRef = useRef(loop);
  loopRef.current = loop;
  const clock = useTransportClock({
    bpm,
    onStep: (step, time) => {
      for (const [pad, steps] of loopRef.current.entries()) {
        if (steps[step]) {
          engine.trigger(pad, time);
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

  /** A pad is struck: it sounds now, it is the one the knobs edit, and with the recording on it is written to the nearest step. */
  const strike = useCallback(
    (pad: number, velocity = 1) => {
      wake();
      setSelected(pad);
      setTouched(null);
      if (bus) {
        engine.trigger(pad, bus.context.currentTime + 0.005, velocity);
      }
      if (recording && isPlaying) {
        const step = Math.round(getPosition()) % STEPS;
        setLoop((current) =>
          current.map((steps, index) =>
            index === pad ? steps.map((on, at) => on || at === step) : steps
          )
        );
      }
    },
    [bus, engine, getPosition, isPlaying, recording, wake]
  );
  const onPadOn = useCallback(
    (value: string, details: { velocity: number }) =>
      strike(Number(value), details.velocity),
    [strike]
  );
  const midi = useMidiInput({
    onNoteOn: (note, velocity) => {
      const pad = note - FIRST_NOTE;
      if (pad >= 0 && pad < PADS) {
        strike(pad, velocity);
      }
    },
  });
  const activePads = useMemo(
    () =>
      midi.activeNotes
        .map((note) => note - FIRST_NOTE)
        .filter((pad) => pad >= 0 && pad < PADS)
        .map(String),
    [midi.activeNotes]
  );

  const toggle = useCallback(() => {
    if (isPlaying) {
      clock.stop();
      return;
    }
    wake();
    clock.start();
  }, [clock, isPlaying, wake]);

  /** A knob moved: a pad's own four act on the chosen pad, the tempo and the volume on the whole machine. */
  const onParam = useCallback<OnParam>(
    (param: Param, value) => {
      setTouched(`${NAMES[param]} ${Math.round(value)}`);
      if (param === "tempo") {
        setBpm(value);
      } else if (param === "volume") {
        setVolume(value);
      } else {
        const next = {
          ...pads[selected],
          [param as PadControl]: value,
        } as PadSettings;
        setPads((current) =>
          current.map((pad, index) => (index === selected ? next : pad))
        );
        engine.setPad(selected, next);
      }
    },
    [engine, pads, selected]
  );

  const changeKit = useCallback((value: string) => {
    setKit(value as Kit);
    setTouched(`${value} kit`);
  }, []);
  const stepKit = useCallback(
    (by: number) =>
      changeKit(
        KITS[(KITS.indexOf(kit) + by + KITS.length) % KITS.length] ?? "808"
      ),
    [changeKit, kit]
  );
  const previous = useCallback(() => stepKit(-1), [stepKit]);
  const next = useCallback(() => stepKit(1), [stepKit]);

  const toggleRecording = useCallback(() => setRecording((on) => !on), []);
  const clearPad = useCallback(() => {
    setLoop((current) =>
      current.map((steps, index) =>
        index === selected ? steps.map(() => false) : steps
      )
    );
    setTouched(`${SAMPLE_NAMES[selected]} cleared`);
  }, [selected]);
  const clearAll = useCallback(() => {
    setLoop(emptyLoop());
    setTouched("Loop cleared");
  }, []);

  const hits = useMemo(
    () => loop.reduce((sum, steps) => sum + steps.filter(Boolean).length, 0),
    [loop]
  );
  const inspected = useMemo(
    () => ({
      bpm,
      hits,
      kit,
      pad: SAMPLE_NAMES[selected] ?? "",
      recording: recording ? "on" : "off",
      transport: isPlaying ? "running" : "stopped",
      volume,
      ...pads[selected],
    }),
    [bpm, hits, isPlaying, kit, pads, recording, selected, volume]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    activePads,
    bpm,
    changeKit,
    clearAll,
    clearPad,
    hits: loop[selected] ?? [],
    isPlaying,
    kit,
    next,
    onPadOn,
    onParam,
    pad: pads[selected] ?? DEFAULT_PAD,
    position,
    previous,
    readout: touched ?? `${Math.round(bpm)} BPM  ${hits} hits`,
    ready,
    recording,
    selected,
    title: `${kit} ${SAMPLE_NAMES[selected]}`.toUpperCase(),
    toggle,
    toggleRecording,
    volume,
  };
}
