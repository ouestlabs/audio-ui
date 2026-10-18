---
title: Spectrum on a Plot
impact: MEDIUM
impactDescription: a readable spectrum on a log axis, without a render per frame
tags: plot, spectrum, analyser
---

## Spectrum on a Plot

FFT bins are spaced linearly: drawn as they come, everything below 1 kHz is squeezed into the first few pixels. The spectrum behind an equalizer has to be resampled onto the plot's logarithmic frequency axis, and it changes every frame.

**Incorrect (linear bins through state):**

```tsx
const [bins, setBins] = useState<number[]>([]);

useEffect(() => {
  const data = new Float32Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getFloatFrequencyData(data);
    setBins(Array.from(data)); // linear axis, React render per frame
    frame = requestAnimationFrame(tick);
  };
  let frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [analyser]);
```

**Correct (the registry hook: log axis, a source):**

```bash
npx shadcn@latest add @audio-ui/use-spectrum
```

```tsx
import { PlotTraceArea } from "@/components/audio-ui/plot";
import { useSpectrum } from "@/hooks/use-spectrum";

const spectrum = useSpectrum(analyser); // Source<Float32Array>, dB per point on a log axis

<PlotTraceArea fillTo={-100} max={-10} min={-100} source={spectrum} />
```

Without the registry, the same loop uses `logSpectrum` and `holdPeaks` from `@audio-ui/core/analysis`, and a `Plot.Trace` on the source. Set the analyser's `minDecibels` and `maxDecibels` first, or `getFloatFrequencyData` reads a different range than the plot shows:

```ts
import { createSource } from "@audio-ui/react";
import { holdPeaks, logSpectrum } from "@audio-ui/core/analysis";

analyser.fftSize = 4096;
analyser.minDecibels = -96;
analyser.maxDecibels = 0;
const bins = new Float32Array(analyser.frequencyBinCount);
const points = new Float32Array(256); // dB per point, log axis 20 Hz to 20 kHz
const peaks = new Float32Array(256).fill(-96);
const holding = new Float32Array(256);
const live = createSource<ArrayLike<number>>(points);
const held = createSource<ArrayLike<number>>(peaks);

let last = performance.now();
function tick(now: number) {
  analyser.getFloatFrequencyData(bins);
  logSpectrum(bins, ctx.sampleRate, points);
  holdPeaks(points, peaks, holding, (now - last) / 1000);
  last = now;
  live.set(points); // the same arrays, published again
  held.set(peaks);
  frame = requestAnimationFrame(tick);
}
let frame = requestAnimationFrame(tick);
```

On the plot: `<Plot.Root minX={20} maxX={20000} minY={-96} maxY={0} scaleX="log">` with `<Plot.Trace fillTo={-96} source={live} />` and `<Plot.Trace source={held} />` inside `Plot.Graph`. `Plot.Root` is a positioned `div` that needs a height. Markup and CSS: [directions.md](../directions.md).
