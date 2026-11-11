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
npx shadcn@latest add @audio-ui/tuner
```

```tsx
import { Tuner } from "@/components/audio-ui/tuner";

<Tuner />; // its own start button, the display and the pitch of A4
```

For a tuner of another shape, the pieces it installs:

```tsx
import { TunerDisplay } from "@/components/audio-ui/tuner";
import { useMicrophone } from "@/hooks/use-microphone";
import { usePitch } from "@/hooks/use-pitch";

const microphone = useMicrophone(); // raw signal, never played back
const pitch = usePitch(microphone.analyser); // a source: no render per reading

<button onClick={microphone.start}>Listen</button>; // from a click
<TunerDisplay source={pitch} />;
```

For a frequency from samples you already have, `detectPitch` from `@audio-ui/engine/analysis` and `cents(frequency)` from `@audio-ui/engine/pitch` are pure functions, with no React and no Web Audio: they work in any framework. The analyser's `fftSize` must hold two periods of the lowest pitch: 4096 at 48 kHz reaches about 40 Hz.

Without the registry, `detectPitch(samples, sampleRate, { minHz, maxHz, minLevel, threshold })` returns `{ frequency, confidence }`, or `null` when the signal is quieter than `minLevel` (an RMS level) or has no clear pitch (noise, a chord); it is YIN, from `@audio/pitch-yin`. `cents(frequency)` returns `{ midi, name, hz, cents }` (`name` carries the octave, `"A#4"`, and positive `cents` means sharp), so guard a frequency that is not positive and finite. Feed an `AnalyserNode` that is never connected to the speakers, read it in a `requestAnimationFrame` loop, and publish the reading through a source:

```ts
import { detectPitch } from "@audio-ui/engine/analysis";
import { cents } from "@audio-ui/engine/pitch";
import { createSource } from "@audio-ui/react";

const reading = createSource<{ name: string; cents: number } | null>(null);
const samples = new Float32Array(analyser.fftSize);

function tick() {
  analyser.getFloatTimeDomainData(samples);
  const pitch = detectPitch(samples, ctx.sampleRate, { maxHz: 2000, minHz: 40, minLevel: 0.01, threshold: 0.1 });
  const note = pitch && pitch.confidence > 0.8 ? cents(pitch.frequency) : null;
  reading.set(note);
  frame = requestAnimationFrame(tick);
}
```

A tuner is a display, not a control: it needs none of the knob, fader or meter kit, only the tokens of a skin. Test it without a microphone by feeding an `OscillatorNode` into the same analyser.
