import { useCallback, useEffect, useMemo, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import { usePublishInspector } from "@/lib/inspector";
import {
  CHANNELS,
  type Channel,
  createRigelEngine,
  DEFAULT_DESK,
  FADER_MIN,
  type Knob,
  type Strip,
} from "./audio/engine";
import { renderStem } from "./audio/stems";
import { LABELS } from "./ui/params";

const MASTER_DEFAULT = -3;
const gainOf = (db: number) => (db <= FADER_MIN ? 0 : 10 ** (db / 20));

/**
 * What the panel reads and calls: the desk's strips, the master and the
 * transport, and the engine that mixes them on the shared bus. The panel is
 * drawing; the sound is `audio/`.
 */
export function useRigel() {
  const [engine] = useState(() => createRigelEngine());
  const [desk, setDesk] = useState(DEFAULT_DESK);
  const [master, setMaster] = useState(MASTER_DEFAULT);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [analysers, setAnalysers] = useState<Record<
    Channel,
    AnalyserNode
  > | null>(null);
  const [masterAnalysers, setMasterAnalysers] = useState<AnalyserNode[]>([]);

  const bus = useMasterBus(gainOf(master));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    const nodes = {} as Record<Channel, AnalyserNode>;
    for (const channel of CHANNELS) {
      const node = engine.analyser(channel);
      if (node) {
        nodes[channel] = node;
      }
    }
    setAnalysers(nodes);
    // The master's meter listens to the bus, one analyser a side.
    const splitter = bus.context.createChannelSplitter(2);
    const sides = [0, 1].map((side) => {
      const node = bus.context.createAnalyser();
      node.fftSize = 1024;
      splitter.connect(node, side);
      return node;
    });
    bus.connect(splitter);
    setMasterAnalysers(sides);
    return () => {
      bus.disconnect(splitter);
      splitter.disconnect();
      setMasterAnalysers([]);
      setAnalysers(null);
      engine.detach();
    };
  }, [bus, engine]);

  // The six loops are rendered once, as stems would be decoded.
  useEffect(() => {
    let current = true;
    Promise.all(CHANNELS.map((channel) => renderStem(channel))).then(
      (buffers) => {
        if (current) {
          engine.load(
            Object.fromEntries(
              CHANNELS.map((channel, index) => [channel, buffers[index]])
            )
          );
          setReady(true);
        }
      }
    );
    return () => {
      current = false;
    };
  }, [engine]);

  const toggle = useCallback(() => {
    if (playing) {
      engine.stop();
      setPlaying(false);
      return;
    }
    const ctx = bus?.context;
    // Not awaited: on a first press the promise can wait for the pointer's release.
    if (ctx && ctx.state === "suspended" && "resume" in ctx) {
      (ctx as AudioContext).resume().catch(() => undefined);
    }
    engine.play();
    setPlaying(true);
  }, [bus, engine, playing]);

  const onStrip = useCallback(
    <K extends keyof Strip>(channel: Channel, key: K, value: Strip[K]) => {
      setDesk((current) => ({
        ...current,
        [channel]: { ...current[channel], [key]: value },
      }));
      engine.set(channel, key, value);
    },
    [engine]
  );
  const onKnob = useCallback(
    (channel: Channel, knob: Knob, value: number) =>
      onStrip(channel, knob, value),
    [onStrip]
  );

  const inspected = useMemo(() => {
    const patch: Record<string, number | string> = {
      master: `${master} dB`,
      transport: playing ? "playing" : "stopped",
    };
    for (const channel of CHANNELS) {
      const strip = desk[channel];
      patch[LABELS[channel].toLowerCase()] =
        `${strip.fader} dB${strip.mute ? " M" : ""}${strip.solo ? " S" : ""}`;
    }
    return patch;
  }, [desk, master, playing]);
  usePublishInspector({ output: bus, patch: inspected });

  return {
    analysers,
    desk,
    master,
    masterAnalysers,
    onKnob,
    onStrip,
    playing,
    ready,
    setMaster,
    toggle,
  };
}
