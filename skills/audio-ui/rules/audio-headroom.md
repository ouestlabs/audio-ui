---
title: Leave headroom below full scale
impact: HIGH
impactDescription: no clipping, no sudden loud output
tags: web-audio, gain, clipping, resonance, fader
---

## Leave headroom below full scale

Everything adds up: each voice, every resonant filter and the master volume. A full-scale oscillator already peaks at 1.0, and a lowpass at Q = 12 dB boosts the harmonics at its cutoff by 12 dB, about ×4. Past 1.0 the output clips: harsh distortion, and on a loud system a sudden jump in volume. The registry Fader defaults to -60 to +6 dB, so a master volume left at its defaults can push the output above unity.

**Incorrect (no headroom, resonance unbounded, a fader that goes past 0 dB):**

```tsx
voice.gain.value = 1; // a sawtooth peaks at about 1 before the filter
<Knob aria-label="Resonance" max={40} min={0} /> // up to ×100 at the cutoff
<Fader aria-label="Volume" /> // -60 to +6 dB: +6 dB is above unity
```

**Correct (the loudest case stays under 1.0):**

```tsx
const VOICE_GAIN = 0.2; // room for a resonant peak and for more than one voice

voice.gain.setTargetAtTime(VOICE_GAIN, ctx.currentTime, 0.01);
<Knob aria-label="Resonance (dB)" max={12} min={0} /> // at most ×4 at the cutoff
<Fader aria-label="Volume (dB)" max={0} min={-60} />  // never above unity
```

Work the worst case out: voices × voice gain × resonance boost × master gain should stay below 1. A `DynamicsCompressorNode` before `ctx.destination` is a safety net for what you didn't foresee, not a replacement for sizing the gains.
