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

## Loudness (LUFS) from samples, not from an analyser

A loudness readout is not RMS. It filters the signal first (K-weighting: a high shelf of +4 dB above about 1.7 kHz, then a second-order high-pass at 38 Hz), averages the squared result over 400 ms (momentary) or 3 s (short term), and gates the integrated value (-70 LUFS absolute, then 10 LU below the average). A plain `rmsDb` is fine for a meter, and wrong to print as LUFS.

An `AnalyserNode` cannot give a true 400 ms window (its block is about 43 ms at 48 kHz), so do the filter and the windows in an `AudioWorklet`, which sees every sample. It loads once per context from a blob, as the registry's key detector does:

```ts
const LUFS_WORKLET = `
class Lufs extends AudioWorkletProcessor {
  constructor() {
    super();
    // K-weighting for 48 kHz: [b0, b1, b2, a1, a2] for the shelf and the high-pass
    this.shelf = { b: [1.5351248595869702, -2.6916961894063807, 1.19839281085285], a: [-1.6906592931824103, 0.7324807742158501], s: [0, 0] };
    this.hp = { b: [0.9950299263000474, -1.9900598526000948, 0.9950299263000474], a: [-1.9900474548339797, 0.9900722503662099], s: [0, 0] };
    this.sum = 0;
    this.count = 0;
    this.window = Math.round(sampleRate * 0.4);
    this.port.onmessage = () => {};
  }
  biquad(f, x) {
    const { b, a, s } = f;
    const y = b[0] * x + s[0];
    s[0] = b[1] * x - a[0] * y + s[1];
    s[1] = b[2] * x - a[1] * y;
    return y;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const y = this.biquad(this.hp, this.biquad(this.shelf, channel[i]));
      this.sum += y * y;
      if (++this.count === this.window) {
        // mean square over 400 ms -> momentary loudness in LUFS (-0.691 is the BS.1770 offset)
        this.port.postMessage(-0.691 + 10 * Math.log10(this.sum / this.count + 1e-12));
        this.sum = 0;
        this.count = 0;
      }
    }
    return true;
  }
}
registerProcessor("audioui-lufs", Lufs);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();
export function loadLufs(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) return cached;
  const url = URL.createObjectURL(new Blob([LUFS_WORKLET], { type: "text/javascript" }));
  const done = ctx.audioWorklet.addModule(url).then(() => true, () => false).finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

// After loadLufs(ctx): connect the source to new AudioWorkletNode(ctx, "audioui-lufs"), read the
// momentary value on node.port.onmessage, and publish it through a source. Short term is the same
// mean square over 3 s (a window of sampleRate * 3), and the integrated value gates the 400 ms blocks.
