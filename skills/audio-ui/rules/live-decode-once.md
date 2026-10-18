---
title: "Waveform peaks: decode once"
impact: HIGH
impactDescription: no audio decoding on render
tags: waveform, peaks, decode
---

## Waveform peaks: decode once

Decoding and reducing an audio file is expensive. Do it once per file, at a resolution above the widest view, and pass the result as a plain prop.

**Incorrect:**

```tsx
function Track({ file }: { file: ArrayBuffer }) {
  const peaks = computePeaks(decode(file), width); // on every render, at the current width
  return <Waveform.Root peaks={peaks} />;
}
```

**Correct:**

```ts
// npx shadcn@latest add @audio-ui/audio-decode, then: import { computePeaks, normalizePeaks } from "@audio-ui/core/analysis"
const channels = await decodeAudioChannels(ctx, file);
const values = normalizePeaks(computePeaks(channels, 4096)); // once, at load
```

The waveform fits the peaks to its own width and zoom.

The primitive takes the result as `peaks` on `Waveform.Root` (the registry component calls the same prop `values`), and draws it on `Waveform.Canvas`; its color is the `--waveform-color` and `--waveform-progress-color` variables, and `count` and `mirrored` belong to `Waveform.Bars`, not the canvas. Markup and CSS: [directions.md](../directions.md).
