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

**Correct (the registry hook: RMS in dB per channel, the loudest sample held as the peak, a source):**

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

For stereo, split the signal with a `ChannelSplitterNode` and connect each output to its own `AnalyserNode`. The hook's source also carries each channel's peak, the loudest sample held a moment, so the bar says how loud the signal sounds and the mark how near it comes to clipping, and it publishes nothing while the signal is silent.

A mono source through a `ChannelSplitterNode` leaves the second analyser at zero. Up-mix first: give the node feeding the splitter `channelCount: 2` with `channelCountMode: "explicit"`, so both bars move.

Without the registry, the same loop is a few lines per channel:

```ts
import { peakDb, rmsDb } from "@audio-ui/engine/analysis";
import { createSource } from "@audio-ui/react";

const buffer = new Float32Array(analyser.fftSize);
const source = createSource({ levels: [-60, -60], peaks: [-60, -60] });
const peaks = [-60, -60];

function read(analyser: AnalyserNode, channel: number) {
  analyser.getFloatTimeDomainData(buffer);
  // The bar is the RMS, how loud it sounds; the mark the loudest sample, how near it comes to clipping.
  const loudest = Math.max(-60, peakDb(buffer));
  peaks[channel] = Math.max(loudest, peaks[channel] - 0.4); // a slow fall holds the peak
  return Math.max(-60, rmsDb(buffer));
}
// In one requestAnimationFrame loop: source.set({ levels: [read(left, 0), read(right, 1)], peaks: [...peaks] });
```

## Loudness (LUFS) from samples, not from an analyser

A loudness readout is not RMS. It filters the signal first (K-weighting: a high shelf of +4 dB above about 1.7 kHz, then a high-pass at 38 Hz), averages the squared result over 400 ms (momentary) or 3 s (short-term), and gates the integrated value (-70 LUFS, then 10 LU under the loudness of the rest). A plain `rmsDb` is fine for a meter, and wrong to print as LUFS. An `AnalyserNode` cannot give it either: its block is about 43 ms at 48 kHz, read when the page paints, with gaps between. It takes every sample, on the audio thread:

```bash
npx shadcn@latest add @audio-ui/use-loudness
```

```tsx
import { useLoudness } from "@/hooks/use-loudness";

// The node whose sound to measure, in stereo. It is only listened to, never heard.
const { clear, source } = useLoudness(output);
// source: { momentary, shortTerm, integrated } in LUFS, every 100 ms, -Infinity until there is enough to read.
// clear() starts the integrated loudness over.
```

Outside React, `createLoudnessMeter(ctx, onLoudness)` from the `loudness` lib does the same: connect what to measure to its `input`. Its filter is designed for the context's own rate, through `@audio/weighting-k`: the coefficients printed in BS.1770 are for 48 kHz only.
