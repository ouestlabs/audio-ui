"use client";

import { createSource } from "@audio-ui/react";
import { useEffect, useRef, useState } from "react";
import { CompressorPanel } from "@/registry-audio/bases/base/audio/panels/compressor-panel";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import {
  type CompressorState,
  compressorDevice,
} from "@/registry-audio/bases/base/lib/compressor-device";
import {
  type CompressorEngine,
  createCompressorEngine,
} from "@/registry-audio/bases/base/lib/compressor-engine";
import {
  demoKey,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const SIGNAL_GAIN = 0.8;
const FLOOR_DB = -80;
const FFT_SIZE = 1024;
/** How fast the level falls back between pulses, in dB per frame. */
const LEVEL_FALL_DB = 1.2;
const MASTER_VOLUME = 0.7;

/**
 * A compressor you can plug in: its state, a panel that draws it, an engine
 * that plays it, side by side. Each is its own file and none knows the others:
 * the state is a plain object, so a host keeps its own and uses what it needs.
 * Play it from its session and turn the knobs; switch Sidechain on and a kick ducks a held chord.
 */
export default function BlockCompressor() {
  const [state, setState] = useState<CompressorState>(() =>
    compressorDevice.defaults()
  );
  const { playing } = usePlaySwitch();
  const master = useMasterBus(MASTER_VOLUME);
  const [level] = useState(() => createSource(FLOOR_DB));
  const engine = useRef<CompressorEngine | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // With the key on the pulses give way to a held chord that the kick of a loop ducks: the key is heard by the compressor only.
  const keyed = state.external;
  const name = useDemoSource(keyed ? "chord" : "pulses");
  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(playing && ctx && master)) {
      return;
    }
    ctx.resume();
    let cancelled = false;
    let stop = () => undefined;
    const buffers = Promise.all([
      renderDemoSource(name, ctx.sampleRate),
      keyed ? renderDemoSource(demoKey(name), ctx.sampleRate) : null,
    ]);
    buffers.then(([signal, key]) => {
      if (cancelled) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = signal;
      source.loop = true;
      const keySource = key ? ctx.createBufferSource() : null;
      const compressor = createCompressorEngine(ctx, stateRef.current);
      const tap = ctx.createAnalyser();
      tap.fftSize = FFT_SIZE;
      // The pulses are drawn at full scale: the block lowers them to where it has always played them.
      const gain = ctx.createGain();
      gain.gain.value = name === "pulses" ? SIGNAL_GAIN : 1;
      source.connect(gain);
      gain.connect(tap);
      gain.connect(compressor.input);
      if (keySource && key) {
        keySource.buffer = key;
        keySource.loop = true;
        keySource.connect(compressor.sidechain);
      }
      compressor.output.connect(master);
      engine.current = compressor;
      const startAt = ctx.currentTime + 0.05;
      source.start(startAt);
      keySource?.start(startAt);

      const samples = new Float32Array(new ArrayBuffer(tap.fftSize * 4));
      let held = FLOOR_DB;
      let frame = 0;
      const tick = () => {
        tap.getFloatTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample));
        }
        const db =
          peak > 0 ? Math.max(FLOOR_DB, 20 * Math.log10(peak)) : FLOOR_DB;
        held = Math.max(db, held - LEVEL_FALL_DB);
        level.set(held);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      stop = () => {
        cancelAnimationFrame(frame);
        source.stop();
        source.disconnect();
        gain.disconnect();
        keySource?.stop();
        keySource?.disconnect();
        tap.disconnect();
        compressor.dispose();
        engine.current = null;
        level.set(FLOOR_DB);
      };
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [keyed, level, master, name, playing]);

  // The engine follows the state, whoever changed it: a knob or a call.
  useEffect(() => {
    engine.current?.update(state);
  }, [state]);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <CompressorPanel level={level} onValueChange={setState} value={state} />
    </div>
  );
}
