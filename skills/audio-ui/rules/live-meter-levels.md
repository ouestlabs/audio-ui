---
title: Meter levels from an AnalyserNode
impact: HIGH
impactDescription: the meter shows real dB levels
tags: meter, analyser, rms, peak
---

## Meter levels from an AnalyserNode

A Meter takes dB per channel. `getByteFrequencyData` gives frequency magnitudes from 0 to 255, not a level: averaging them reads quiet bass as silence and pins at the top for no reason. Measure RMS on the time-domain samples and convert to dB.

**Incorrect (averaged frequency bytes, re-rendered every frame):**

```tsx
const data = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(data);
const level = data.reduce((sum, v) => sum + v, 0) / data.length; // 0..255, not dB
setLevels([level, level]);
```

**Correct (RMS in dB per channel, peak hold, published to a source):**

```tsx
// hooks/use-levels.ts
"use client";

import { createSource, type Meter } from "@audio-ui/react";
import { useEffect, useState } from "react";

const SILENCE_DB = -100;
const PEAK_HOLD_MS = 1500;
const PEAK_FALL_DB_PER_S = 12;

function rmsDb(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) {
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / buffer.length);
  return rms > 0 ? 20 * Math.log10(rms) : SILENCE_DB;
}

/** One analyser per channel. Memoize the array: a new one restarts sampling. */
export function useLevels(analysers: AnalyserNode[]) {
  const [source] = useState(() => createSource<Meter.Root.Frame>({ levels: [] }));

  useEffect(() => {
    const channels = analysers.map((analyser) => ({
      analyser,
      buffer: new Float32Array(analyser.fftSize),
      holdUntil: 0,
      peak: SILENCE_DB,
    }));
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      const levels: number[] = [];
      const peaks: number[] = [];
      for (const channel of channels) {
        const db = rmsDb(channel.analyser, channel.buffer);
        if (db >= channel.peak) {
          channel.peak = db;
          channel.holdUntil = now + PEAK_HOLD_MS;
        } else if (now > channel.holdUntil) {
          channel.peak = Math.max(db, channel.peak - PEAK_FALL_DB_PER_S * elapsed);
        }
        levels.push(db);
        peaks.push(channel.peak);
      }
      source.set({ levels, peaks });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysers, source]);

  return source;
}
```

```tsx
// a component that shows them
import { Meter } from "@/components/audio-ui/meter";
import { useLevels } from "@/hooks/use-levels";

const levels = useLevels(analysers);

<Meter aria-label="Master" source={levels} />;
```

For stereo, split the signal with a `ChannelSplitterNode` and connect each output to its own `AnalyserNode`.
