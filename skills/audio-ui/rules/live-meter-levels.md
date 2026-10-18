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

**Correct (the registry hook: RMS in dB per channel, peak hold, a source):**

```bash
npx shadcn@latest add @audio-ui/use-audio-levels
```

```tsx
import { Meter } from "@/components/audio-ui/meter";
import { useAudioLevels } from "@/hooks/use-audio-levels";

// One analyser per channel, memoized: a new array restarts the sampling.
const levels = useAudioLevels(analysers);

<Meter aria-label="Master" source={levels} />;
```

For stereo, split the signal with a `ChannelSplitterNode` and connect each output to its own `AnalyserNode`. The hook's source also carries each channel's held peak, and publishes nothing while the signal is silent.

A mono source through a `ChannelSplitterNode` leaves the second analyser at zero. Up-mix first: give the node feeding the splitter `channelCount: 2` with `channelCountMode: "explicit"`, so both bars move.

Without the registry, the same loop is a few lines per channel:

```ts
import { createSource } from "@audio-ui/react";

const buffer = new Float32Array(analyser.fftSize);
const source = createSource({ levels: [-60, -60], peaks: [-60, -60] });
const peaks = [-60, -60];

function read(analyser: AnalyserNode, channel: number) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) {
    sum += sample * sample;
  }
  const db = Math.max(-60, 20 * Math.log10(Math.sqrt(sum / buffer.length) || 1e-6));
  peaks[channel] = Math.max(db, peaks[channel] - 0.4); // a slow fall holds the peak
  return db;
}
// In one requestAnimationFrame loop: source.set({ levels: [read(left, 0), read(right, 1)], peaks: [...peaks] });
```

A loudness readout (LUFS) is not RMS: it filters the signal first (K-weighting, two biquads: a high shelf of +4 dB near 1.7 kHz and a high-pass near 38 Hz), averages the squared result over 400 ms (momentary) or 3 s (short term), and gates the integrated value (-70 LUFS absolute, then 10 LU below the average). A plain `rmsDb` is fine for a meter, and wrong to print as LUFS.
