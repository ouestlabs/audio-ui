"use client";

import { createSource, type Source } from "@audio-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { CompressorPanel } from "@/registry-audio/bases/base/audio/panels/compressor-panel";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import {
  type CompressorState,
  compressorDevice,
} from "@/registry-audio/bases/base/lib/compressor-device";
import {
  type CompressorEngine,
  createCompressorEngine,
} from "@/registry-audio/bases/base/lib/compressor-engine";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const LOOP_SECONDS = 2;
const PULSES_PER_LOOP = 8;
const PULSE_DECAY_SECONDS = 0.18;
const SIGNAL_GAIN = 0.8;
const FLOOR_DB = -80;
const FFT_SIZE = 1024;
/** How fast the level falls back between pulses, in dB per frame. */
const LEVEL_FALL_DB = 1.2;
const MASTER_VOLUME = 0.7;

/** Noise bursts that start loud and fade, eight to a loop, every other one quieter, so the level moves along the curve. */
function pulses(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * LOOP_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  const pulseLength = data.length / PULSES_PER_LOOP;
  for (let index = 0; index < data.length; index += 1) {
    const seconds = (index % pulseLength) / ctx.sampleRate;
    const accent = Math.floor(index / pulseLength) % 2 === 0 ? 1 : 0.35;
    data[index] =
      (Math.random() * 2 - 1) *
      accent *
      SIGNAL_GAIN *
      Math.exp(-seconds / PULSE_DECAY_SECONDS);
  }
  return buffer;
}

/** Gain reduction in dB, written into one text node as the source moves: no React render per frame. */
function ReductionReadout({ source }: { source: Source<number> }) {
  const element = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const node = element.current?.appendChild(document.createTextNode(""));
    if (!node) {
      return;
    }
    const paint = () => {
      node.data = `${source.getSnapshot().toFixed(1)} dB`;
    };
    paint();
    const unsubscribe = source.subscribe(paint);
    return () => {
      unsubscribe();
      node.remove();
    };
  }, [source]);
  return (
    <output
      aria-label="Gain reduction"
      className="font-mono text-muted-foreground text-xs tabular-nums"
      ref={element}
    />
  );
}

/**
 * A compressor you can plug in: its state, a panel that draws it, an engine
 * that plays it, side by side. Each is its own file and none knows the others:
 * the state is a plain object, so a host keeps its own and uses what it needs.
 * Press play and turn the knobs.
 */
export default function BlockCompressor() {
  const [state, setState] = useState<CompressorState>(() =>
    compressorDevice.defaults()
  );
  const [playing, setPlaying] = useState(false);
  const master = useMasterBus(MASTER_VOLUME);
  const [level] = useState(() => createSource(FLOOR_DB));
  const [reduction] = useState(() => createSource(0));
  const engine = useRef<CompressorEngine | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const ctx = webAudio.getContext();
    if (!(playing && ctx && master)) {
      return;
    }
    ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = pulses(ctx);
    source.loop = true;
    const compressor = createCompressorEngine(ctx, stateRef.current);
    const tap = ctx.createAnalyser();
    tap.fftSize = FFT_SIZE;
    source.connect(tap);
    source.connect(compressor.input);
    compressor.output.connect(master);
    engine.current = compressor;
    source.start();

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
      reduction.set(compressor.reduction);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source.stop();
      source.disconnect();
      tap.disconnect();
      compressor.dispose();
      engine.current = null;
      level.set(FLOOR_DB);
      reduction.set(0);
    };
  }, [level, master, playing, reduction]);

  // The engine follows the state, whoever changed it: a knob or a call.
  useEffect(() => {
    engine.current?.update(state);
  }, [state]);

  const togglePlaying = useCallback(() => setPlaying((on) => !on), []);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <CompressorPanel level={level} onValueChange={setState} value={state}>
        <Button
          aria-label={
            playing ? "Stop the signal" : "Play a pulsing signal through it"
          }
          onClick={togglePlaying}
          size="icon-sm"
          variant="outline"
        >
          {playing ? (
            <IconPlaceholder
              hugeicons="PauseIcon"
              lucide="PauseIcon"
              phosphor="PauseIcon"
              remixicon="RiPauseLine"
              tabler="IconPlayerPause"
            />
          ) : (
            <IconPlaceholder
              hugeicons="PlayIcon"
              lucide="PlayIcon"
              phosphor="PlayIcon"
              remixicon="RiPlayLine"
              tabler="IconPlayerPlay"
            />
          )}
        </Button>
        <ReductionReadout source={reduction} />
      </CompressorPanel>
    </div>
  );
}
