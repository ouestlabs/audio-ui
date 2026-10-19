---
title: Detect pitch with a period search, not the loudest FFT bin
impact: HIGH
impactDescription: a tuner that names the right note and its cents, down to the low strings
tags: pitch, tuner, yin, analyser, microphone
---

## Detect pitch with a period search, not the loudest FFT bin

The loudest bin of an FFT is the loudest harmonic, not the pitch: a plucked string often has a stronger second harmonic, so the tuner reads an octave high. And bins are linear, 11 Hz apart at 2048 samples: at 82 Hz (low E) one bin is 13% of the pitch, far from the single cents a tuner needs. Pitch is the repeating period of the waveform, found in the time domain.

**Incorrect (the loudest frequency bin):**

```ts
const bins = new Float32Array(analyser.frequencyBinCount);
analyser.getFloatFrequencyData(bins);
const loudest = bins.indexOf(Math.max(...bins));
const hz = (loudest * ctx.sampleRate) / analyser.fftSize; // a harmonic, 11 Hz coarse
```

**Correct (the registry's YIN period search on the time-domain samples):**

```bash
npx shadcn@latest add @audio-ui/tuner @audio-ui/use-microphone @audio-ui/use-pitch
```

```tsx
import { Tuner } from "@/components/audio-ui/tuner";
import { useMicrophone } from "@/hooks/use-microphone";
import { usePitch } from "@/hooks/use-pitch";

const microphone = useMicrophone(); // raw signal, never played back
const pitch = usePitch(microphone.analyser); // a source: no render per reading

<button onClick={microphone.start}>Listen</button>; // from a click
<Tuner source={pitch} />;
```

For a frequency from samples you already have, `detectPitch(samples, sampleRate)` and `nearestNote(frequency)` from `@audio-ui/core/pitch` are pure functions, with no React and no Web Audio: they work in any framework. The analyser's `fftSize` must hold two periods of the lowest pitch: 4096 at 48 kHz reaches about 40 Hz.

Without the registry, `detectPitch(samples, sampleRate)` returns `{ frequency, confidence }`, or `null` when the signal is too quiet or has no clear pitch (noise, a chord, silence). `nearestNote(frequency)` returns `{ name, octave, pitch, cents }` (a sharp is written `"A#"`, and positive `cents` means sharp), or `null` for a frequency that is not positive and finite, so guard both. Feed an `AnalyserNode` that is never connected to the speakers, read it in a `requestAnimationFrame` loop, and publish the reading through a source:

```ts
import { createSource } from "@audio-ui/react";
import { detectPitch, nearestNote } from "@audio-ui/core/pitch";

const reading = createSource<{ name: string; octave: number; cents: number } | null>(null);
const samples = new Float32Array(analyser.fftSize);

function tick() {
  analyser.getFloatTimeDomainData(samples);
  const pitch = detectPitch(samples, ctx.sampleRate);
  const note = pitch && pitch.confidence > 0.8 ? nearestNote(pitch.frequency) : null;
  reading.set(note);
  frame = requestAnimationFrame(tick);
}
```

A tuner is a display, not a control: it needs none of the knob, fader or meter kit, only the tokens of a skin. Test it without a microphone by feeding an `OscillatorNode` into the same analyser.
