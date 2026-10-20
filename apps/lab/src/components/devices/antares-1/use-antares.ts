import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { usePublishInspector } from "@/lib/inspector";
import { createAntaresEngine, SOURCES, type Source } from "./audio/engine";
import { renderLoop } from "./audio/loops";
import { DEFAULTS, type Knob, type Panel, readout } from "./audio/mapping";

/**
 * What the panel reads and calls: the knobs, the switches, the source and the
 * transport, and the compressor that squeezes the loop, on the shared bus. The
 * panel is drawing; the sound is `audio/`.
 */
export function useAntares() {
  const [engine] = useState(() => createAntaresEngine(DEFAULTS));
  const [panel, setPanel] = useState<Panel>(DEFAULTS);
  const [source, setSource] = useState<Source>("Drums");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [touched, setTouched] = useState<string | null>(null);
  const [meters, setMeters] = useState<ReturnType<typeof engine.meters> | null>(
    null
  );

  // The unit owns its output level: the shared bus stays at unity.
  const bus = useMasterBus(1);
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    setMeters(engine.meters());
    return () => {
      setMeters(null);
      engine.detach();
    };
  }, [bus, engine]);

  // The loops are rendered once, as files would be decoded.
  useEffect(() => {
    let current = true;
    Promise.all(SOURCES.map((name) => renderLoop(name))).then((buffers) => {
      if (current) {
        engine.load(
          Object.fromEntries(
            SOURCES.map((name, index) => [name, buffers[index]])
          )
        );
        setReady(true);
      }
    });
    return () => {
      current = false;
    };
  }, [engine]);

  /** Wakes the shared context: the first press is a gesture, and the promise is not awaited. */
  const wake = useCallback(() => {
    const ctx = bus?.context;
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
  }, [bus]);

  const toggle = useCallback(() => {
    if (playing) {
      engine.stop();
      setPlaying(false);
      return;
    }
    wake();
    engine.play(source);
    setPlaying(true);
  }, [engine, playing, source, wake]);

  const changeSource = useCallback(
    (next: string) => {
      setSource(next as Source);
      if (playing) {
        engine.play(next as Source);
      }
    },
    [engine, playing]
  );

  const update = useCallback(
    (next: Panel) => {
      setPanel(next);
      engine.set(next);
    },
    [engine]
  );
  const onKnob = useCallback(
    (knob: Knob, value: number) => {
      const next = { ...panel, [knob]: value };
      setTouched(readout(knob, next));
      update(next);
    },
    [panel, update]
  );
  const setKnee = useCallback(
    (value: string) => {
      setTouched(`${value} knee`);
      update({ ...panel, knee: value as Panel["knee"] });
    },
    [panel, update]
  );
  const setMakeup = useCallback(
    (value: string) => {
      setTouched(value === "Auto" ? "Auto make-up" : "Manual make-up");
      update({ ...panel, auto: value === "Auto" });
    },
    [panel, update]
  );
  const setEngaged = useCallback(
    (value: string) => {
      setTouched(value === "In" ? "Compressor in" : "Compressor out");
      update({ ...panel, engaged: value === "In" });
    },
    [panel, update]
  );

  const inspected = useMemo(
    () => ({
      ...panel,
      auto: panel.auto ? "auto" : "manual",
      engaged: panel.engaged ? "in" : "out",
      source,
      transport: playing ? "running" : "stopped",
    }),
    [panel, playing, source]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    changeSource,
    meters,
    onKnob,
    panel,
    playing,
    readout: touched ?? (panel.engaged ? "Compressing" : "Bypassed"),
    ready,
    setEngaged,
    setKnee,
    setMakeup,
    source,
    toggle,
  };
}
