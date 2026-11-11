"use client";

import { peakDb } from "@audio-ui/engine/analysis";
import { createSource } from "@audio-ui/react";
import { useEffect, useState } from "react";
import {
  type CompressorState,
  compressorDevice,
} from "@/registry-audio/bases/base/devices/compressor/device";
import { createCompressorEngine } from "@/registry-audio/bases/base/devices/compressor/engine";
import { CompressorPanel } from "@/registry-audio/bases/base/devices/compressor/panel";
import { useDeviceLoop } from "@/registry-audio/bases/base/hooks/use-device-loop";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";

const FLOOR_DB = -80;
/** How fast the level falls back between hits, in dB per frame. */
const LEVEL_FALL_DB = 1.2;
const MASTER_VOLUME = 0.7;

/**
 * A compressor you can plug in: its state, a panel that draws it, an engine
 * that plays it, side by side. Each is its own file and none knows the others:
 * the state is a plain object, so a host keeps its own and uses what it needs.
 * Play it from its session and turn the knobs.
 */
export default function BlockCompressor() {
  const [state, setState] = useState<CompressorState>(() =>
    compressorDevice.defaults()
  );
  const master = useMasterBus(MASTER_VOLUME);
  const { input } = useDeviceLoop({
    create: createCompressorEngine,
    destination: master,
    state,
  });

  // The loudest sample going in, in dB, falling back between hits: the dot on the curve rides it.
  const [level] = useState(() => createSource(FLOOR_DB));
  useEffect(() => {
    if (!input) {
      return;
    }
    const samples = new Float32Array(new ArrayBuffer(input.fftSize * 4));
    let held = FLOOR_DB;
    let frame = 0;
    const tick = () => {
      input.getFloatTimeDomainData(samples);
      const db = Math.max(FLOOR_DB, peakDb(samples));
      held = Math.max(db, held - LEVEL_FALL_DB);
      level.set(held);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      level.set(FLOOR_DB);
    };
  }, [input, level]);

  return (
    <div className="cn-audio-panel h-full w-full min-w-0">
      <CompressorPanel level={level} onValueChange={setState} value={state} />
    </div>
  );
}
