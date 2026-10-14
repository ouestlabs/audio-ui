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
