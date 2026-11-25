import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { usePublishInspector } from "@/lib/inspector";
import { type PolarisParam, polarisDevice } from "./audio/device";
import { createPolarisEngine, type PolarisEngine } from "./audio/engine";
import wasmUrl from "./audio/kernel.wasm?url";
import { renderLoop } from "./audio/loop";

/**
 * What the page reads and calls: the transport and the values, on the shared
 * bus. The panel draws itself from the description (`ui/panel.ts`); the sound
 * is the kernel jz compiled (`audio/`).
 */
export function usePolaris() {
  const [settings, setSettings] = useState(() => polarisDevice.defaults());
  const [engine, setEngine] = useState<PolarisEngine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  // The values turned before the engine is made, so it starts on them.
  const latest = useRef(settings);
  latest.current = settings;

  // The unit owns its output level: the shared bus stays at unity.
  const bus = useMasterBus(1);

  // The module's bytes and the loop, fetched and rendered once.
  useEffect(() => {
    if (!bus) {
      return;
    }
    let current = true;
    let made: PolarisEngine | null = null;
    Promise.all([
      fetch(wasmUrl).then((response) => response.arrayBuffer()),
      renderLoop(),
    ]).then(async ([wasm, loop]) => {
      if (!current) {
        return;
      }
      made = createPolarisEngine(wasm, latest.current);
      made.load(loop);
      const attached = await made.attach(bus);
      if (current) {
        setEngine(made);
        setReady(attached);
      }
    });
    return () => {
      current = false;
      made?.detach();
      setEngine(null);
      setReady(false);
      setPlaying(false);
    };
  }, [bus]);

  const toggle = useCallback(() => {
    if (!engine) {
      return;
    }
    if (playing) {
      engine.stop();
      setPlaying(false);
      return;
    }
    const ctx = bus?.context;
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
    engine.play();
    setPlaying(true);
  }, [bus, engine, playing]);

  const onParam = useCallback(
    (id: PolarisParam, value: number) => {
      setSettings((current) => ({ ...current, [id]: value }));
      engine?.set(id, value);
    },
    [engine]
  );

  const inspected = useMemo(
    () => ({ transport: playing ? "running" : "stopped", ...settings }),
    [playing, settings]
  );
  usePublishInspector({ output: bus, patch: inspected });

  return { onParam, playing, ready, settings, toggle };
}
