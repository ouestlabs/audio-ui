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
