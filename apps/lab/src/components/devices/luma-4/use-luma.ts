import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { usePublishInspector } from "@/lib/inspector";
import {
  createLumaEngine,
  DEFAULTS,
  type Mode,
  type Param,
  SOURCES,
  type Source,
} from "./audio/engine";
import { renderLoop } from "./audio/loops";

/**
 * What the panel reads and calls: the knobs, the mode, the footswitch, the
 * source and the transport, and the lamp the window shows, on the shared bus.
 * The panel is drawing; the sound is `audio/`.
 */
export function useLuma() {
  const [engine] = useState(() => createLumaEngine(DEFAULTS));
  const [settings, setSettings] = useState(DEFAULTS);
  const [source, setSource] = useState<Source>("Guitar");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [engaged, setEngaged] = useState(true);
  const [lamp, setLamp] = useState<AnalyserNode | null>(null);

  // The unit owns its output level: the shared bus stays at unity.
  const bus = useMasterBus(1);
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    setLamp(engine.lamp());
    return () => {
      setLamp(null);
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

  const changeMode = useCallback(
    (next: string) => {
      setSettings((current) => ({ ...current, mode: next as Mode }));
      engine.set("mode", next as Mode);
    },
    [engine]
  );

  /** The footswitch: the effect in or out, and the lamp wakes the context like any press. */
  const stomp = useCallback(() => {
    wake();
    engine.engage(!engaged);
    setEngaged(!engaged);
  }, [engaged, engine, wake]);

  const onParam = useCallback(
    (param: Param, value: number) => {
      setSettings((current) => ({ ...current, [param]: value }));
      engine.set(param, value);
    },
    [engine]
  );

  const inspected = useMemo(
    () => ({
      effect: engaged ? "on" : "bypassed",
      source,
      transport: playing ? "running" : "stopped",
      ...settings,
    }),
    [engaged, playing, settings, source]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return {
    changeMode,
    changeSource,
    engaged,
    lamp,
    onParam,
    playing,
    ready,
    settings,
    source,
    stomp,
    toggle,
  };
}
