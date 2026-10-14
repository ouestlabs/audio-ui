# audio/ui

**Version 1.0.0**  
audio/ui  
October 2026

> **Note:**  
> This document is for agents and LLMs building audio interfaces with audio/ui. It is generated from `rules/` by `bun run skill:build` in `apps/www`: edit the rules, not this file.

---

## Abstract

How to build audio interfaces in React with audio/ui, for AI agents and LLMs. Rules across six categories, prioritized by impact from critical (sound that starts, never clicks and stays in time; live data that never re-renders React per frame) to incremental (styling, AI control). Each rule explains what goes wrong, shows the incorrect code an agent tends to write and the correct code with the real audio/ui API.

---

## Table of Contents

1. [Web Audio](#1-web-audio): **CRITICAL**
   - 1.1 [Create the AudioContext lazily, resume it in a gesture](#11-create-the-audiocontext-lazily-resume-it-in-a-gesture)
   - 1.2 [Ramp parameters, never assign them](#12-ramp-parameters-never-assign-them)
   - 1.3 [Schedule on the audio clock](#13-schedule-on-the-audio-clock)
   - 1.4 [dB on the control, linear gain on the node](#14-db-on-the-control-linear-gain-on-the-node)
   - 1.5 [Leave headroom below full scale](#15-leave-headroom-below-full-scale)
   - 1.6 [Clean up what you create](#16-clean-up-what-you-create)
2. [Live Data](#2-live-data): **CRITICAL**
   - 2.1 [Signals go through a source, not state](#21-signals-go-through-a-source-not-state)
   - 2.2 [Meter a microphone as it delivers the signal](#22-meter-a-microphone-as-it-delivers-the-signal)
   - 2.3 [Meter levels from an AnalyserNode](#23-meter-levels-from-an-analysernode)
   - 2.4 [Playheads and playback position](#24-playheads-and-playback-position)
   - 2.5 [Waveform peaks: decode once](#25-waveform-peaks-decode-once)
   - 2.6 [Showing a live value as text](#26-showing-a-live-value-as-text)
   - 2.7 [Spectrum on a Plot](#27-spectrum-on-a-plot)
3. [Values & Events](#3-values--events): **HIGH**
   - 3.1 [Controlled or uncontrolled, never both](#31-controlled-or-uncontrolled-never-both)
   - 3.2 [Size step and largeStep to the range](#32-size-step-and-largestep-to-the-range)
   - 3.3 [Sound on change, persistence on commit](#33-sound-on-change-persistence-on-commit)
   - 3.4 [Logarithmic scales for frequency](#34-logarithmic-scales-for-frequency)
   - 3.5 [Rejecting a change](#35-rejecting-a-change)
   - 3.6 [Anchors for bipolar controls](#36-anchors-for-bipolar-controls)
4. [Accessibility](#4-accessibility): **HIGH**
   - 4.1 [Accessible names](#41-accessible-names)
   - 4.2 [Keep the focusable part](#42-keep-the-focusable-part)
   - 4.3 [Focus and hit areas](#43-focus-and-hit-areas)
5. [Without React](#5-without-react): **HIGH**
   - 5.1 [Draw from the snapshot](#51-draw-from-the-snapshot)
   - 5.2 [Keep a native range input for keyboard and screen readers](#52-keep-a-native-range-input-for-keyboard-and-screen-readers)
   - 5.3 [One controller per control, created once](#53-one-controller-per-control-created-once)
   - 5.4 [Pass every option to setOptions, then redraw](#54-pass-every-option-to-setoptions-then-redraw)
   - 5.5 [Prepare the pointer before pressing the controller](#55-prepare-the-pointer-before-pressing-the-controller)
   - 5.6 [Import public entries, never internal](#56-import-public-entries-never-internal)
   - 5.7 [Tear down what you attach](#57-tear-down-what-you-attach)
6. [Styling](#6-styling): **MEDIUM**
   - 6.1 [Headless primitives: style by state](#61-headless-primitives-style-by-state)
   - 6.2 [Registry components: props before className](#62-registry-components-props-before-classname)
   - 6.3 [Semantic tokens only](#63-semantic-tokens-only)
   - 6.4 [Never edit the package](#64-never-edit-the-package)
7. [AI Control](#7-ai-control): **MEDIUM**
   - 7.1 [Keep the person in charge](#71-keep-the-person-in-charge)
   - 7.2 [Schemas come from the instance](#72-schemas-come-from-the-instance)
   - 7.3 [Tools edit state, not the DOM](#73-tools-edit-state-not-the-dom)
   - 7.4 [apply is pure and re-clamps](#74-apply-is-pure-and-re-clamps)
   - 7.5 [Give the model the current state](#75-give-the-model-the-current-state)
   - 7.6 [Wiring: AI SDK, Anthropic or OpenAI SDKs, MCP](#76-wiring-ai-sdk-anthropic-or-openai-sdks-mcp)

---

## 1. Web Audio

**Impact: CRITICAL**

Getting sound out at all, without clicks, at the right level and in time: the audio context, parameter ramps, gain, scheduling and cleanup.

### 1.1 Create the AudioContext lazily, resume it in a gesture

**Impact: CRITICAL (sound starts at all, and SSR doesn't crash)**

A context created at module load runs on the server in Next.js and starts `suspended` in every browser. `resume()` only works inside a user gesture.

**Incorrect:**

```tsx
const ctx = new AudioContext(); // module scope: crashes on the server

useEffect(() => {
  ctx.resume(); // not a gesture: stays suspended
}, []);
```

**Correct:**

```tsx
"use client";

let ctx: AudioContext | null = null;
export const getContext = () => (ctx ??= new AudioContext());

<Button
  onClick={async () => {
    await getContext().resume();
    start();
  }}
>
  Play
</Button>
```

The registry ships this as a lib: `npx shadcn@latest add @audio-ui/web`. Use one context per page; every connected node must come from it.

### 1.2 Ramp parameters, never assign them

**Impact: CRITICAL (removes clicks and zipper noise while dragging)**

Setting `.value` jumps the parameter instantly. At audio rate that jump is a click, and a drag is a burst of clicks ("zipper noise").

**Incorrect:**

```ts
onValueChange={(v) => { gain.gain.value = v; }}
```

**Correct:**

```ts
onValueChange={(v) => {
  gain.gain.setTargetAtTime(v, ctx.currentTime, 0.01); // ~10 ms glide
}}
```

### 1.3 Schedule on the audio clock

**Impact: CRITICAL (sample-accurate timing that survives background tabs)**

`setInterval` and `setTimeout` drift, and browsers throttle them in background tabs. A sequencer driven by them swings and stalls.

**Incorrect:**

```ts
setInterval(() => {
  step = (step + 1) % 16;
  if (pattern[row][step]) playKick(); // starts "now", whenever now happens to be
}, (60 / bpm / 4) * 1000);
```

**Correct:**

```tsx
// npx shadcn@latest add @audio-ui/use-transport-clock
const clock = useTransportClock({
  bpm,
  totalSteps: 16,
  onStep: (step, time) => {
    if (pattern[row][step]) playKick(time); // osc.start(time), envelope at time
  },
  onReset: () => releaseAll(), // seek/stop: silence what was scheduled ahead
});
```

The clock looks ahead and hands you the exact `AudioContext` time of each step. Start every node at that `time`. `clock.getPosition()` gives the playhead in steps for the UI; `@audio-ui/musical-time` converts tempo to seconds.

### 1.4 dB on the control, linear gain on the node

**Impact: HIGH (correct and safe output levels)**

People think in dB; `GainNode.gain` is a linear multiplier.

**Incorrect:**

```ts
gain.gain.setTargetAtTime(db, ctx.currentTime, 0.01); // -6 becomes a gain of -6: inverted and loud
```

**Correct:**

```ts
const SILENCE_DB = -60;
const toGain = (db: number) => (db <= SILENCE_DB ? 0 : 10 ** (db / 20));

gain.gain.setTargetAtTime(toGain(db), ctx.currentTime, 0.01);
```

### 1.5 Leave headroom below full scale

**Impact: HIGH (no clipping, no sudden loud output)**

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

### 1.6 Clean up what you create

**Impact: MEDIUM (no orphan oscillators or loops after unmount)**

Nodes and loops outlive an unmounted component: oscillators keep running, analysers keep sampling.

**Incorrect:**

```tsx
useEffect(() => {
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.start();
}, [ctx]);
```

**Correct:**

```tsx
useEffect(() => {
  const osc = ctx.createOscillator();
  osc.connect(ctx.destination);
  osc.start();
  return () => {
    osc.stop();
    osc.disconnect();
  };
}, [ctx]);
```

Don't `close()` a context other components share.

---

## 2. Live Data

**Impact: CRITICAL**

Meters, spectra, waveforms and playheads follow signals that change every frame, so they read from sources instead of React state.

### 2.1 Signals go through a source, not state

**Impact: CRITICAL (no React render per frame)**

A level, a playhead or a spectrum changes 60 times a second. Through `setState`, that is 60 React renders a second of everything under the state owner. Meter, Plot traces and dots, Waveform and Timeline take a **`source`** instead and write each frame straight to the DOM.

A source is any `{ getSnapshot, subscribe }` object. `createSource` from `@audio-ui/react` makes one you push to with `set`.

**Incorrect:**

```tsx
const [levels, setLevels] = useState([-100, -100]);

useEffect(() => {
  const tick = () => {
    setLevels(readLevels()); // re-renders the whole mixer every frame
    frame = requestAnimationFrame(tick);
  };
  let frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, []);

<Meter aria-label="Master" value={levels} />
```

**Correct:**

```tsx
import { createSource, type Meter as MeterPrimitive } from "@audio-ui/react";
import { Meter } from "@/components/audio-ui/meter";

const [levels] = useState(() =>
  createSource<MeterPrimitive.Root.Frame>({ levels: [] })
);

useEffect(() => {
  const tick = () => {
    levels.set({ levels: readLevels() });
    frame = requestAnimationFrame(tick);
  };
  let frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [levels]);

<Meter aria-label="Master" source={levels} />
```

`value` is right for levels that change rarely (a static mock, a settings preview).

### 2.2 Meter a microphone as it delivers the signal

**Impact: HIGH (a meter that reads true on both bars, with no feedback)**

A meter exists to show the signal as it is. By default the browser processes a microphone for calls: echo cancellation, noise suppression and automatic gain flatten the very levels the meter is there to show. Most laptop microphones are mono, so a splitter's second output stays silent and the right bar never moves. And an analyser connected to `ctx.destination` plays the microphone out of the speakers, which feeds back into itself.

**Incorrect (processed audio, a dead right bar, a feedback loop):**

```ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const input = ctx.createMediaStreamSource(stream);
const splitter = ctx.createChannelSplitter(2);
input.connect(splitter); // a mono microphone: output 1 is silent
const right = ctx.createAnalyser();
splitter.connect(right, 1);
right.connect(ctx.destination); // the microphone plays out of the speakers
```

**Correct (the raw signal, up-mixed to two channels, analysers left unconnected):**

```ts
// from a click: the person decides when the browser asks for the microphone
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    autoGainControl: false,
    channelCount: { ideal: 2 },
    echoCancellation: false,
    noiseSuppression: false,
  },
});
const input = ctx.createMediaStreamSource(stream);

// Two channels whatever the microphone delivers: a mono one feeds both bars.
const stereo = ctx.createGain();
stereo.channelCount = 2;
stereo.channelCountMode = "explicit";
stereo.channelInterpretation = "speakers";
const splitter = ctx.createChannelSplitter(2);
input.connect(stereo);
stereo.connect(splitter);

// One AnalyserNode per output, never connected to ctx.destination.
const analysers = [0, 1].map((output) => {
  const analyser = ctx.createAnalyser();
  splitter.connect(analyser, output);
  return analyser;
});

// Release the microphone when the meter stops or unmounts.
const release = () => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};
```

Feed `analysers` to the `useLevels` hook of the rule `live-meter-levels`. The up-mix copies a mono signal to both channels (left and right both read the full level), and passes a real stereo signal through unchanged.

### 2.3 Meter levels from an AnalyserNode

**Impact: HIGH (the meter shows real dB levels)**

A Meter takes dB per channel. `getByteFrequencyData` gives frequency magnitudes from 0 to 255, not a level: averaging them reads quiet bass as silence and pins at the top for no reason. Measure RMS on the time-domain samples and convert to dB.

**Incorrect (averaged frequency bytes, re-rendered every frame):**

```tsx
const data = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(data);
const level = data.reduce((sum, v) => sum + v, 0) / data.length; // 0..255, not dB
setLevels([level, level]);
```

**Correct (RMS in dB per channel, peak hold, published to a source):**

```tsx
// hooks/use-levels.ts
"use client";

import { createSource, type Meter } from "@audio-ui/react";
import { useEffect, useState } from "react";

const SILENCE_DB = -100;
const PEAK_HOLD_MS = 1500;
const PEAK_FALL_DB_PER_S = 12;

function rmsDb(analyser: AnalyserNode, buffer: Float32Array<ArrayBuffer>) {
  analyser.getFloatTimeDomainData(buffer);
  let sum = 0;
  for (const sample of buffer) {
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / buffer.length);
  return rms > 0 ? 20 * Math.log10(rms) : SILENCE_DB;
}

/** One analyser per channel. Memoize the array: a new one restarts sampling. */
export function useLevels(analysers: AnalyserNode[]) {
  const [source] = useState(() => createSource<Meter.Root.Frame>({ levels: [] }));

  useEffect(() => {
    const channels = analysers.map((analyser) => ({
      analyser,
      buffer: new Float32Array(analyser.fftSize),
      holdUntil: 0,
      peak: SILENCE_DB,
    }));
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      const levels: number[] = [];
      const peaks: number[] = [];
      for (const channel of channels) {
        const db = rmsDb(channel.analyser, channel.buffer);
        if (db >= channel.peak) {
          channel.peak = db;
          channel.holdUntil = now + PEAK_HOLD_MS;
        } else if (now > channel.holdUntil) {
          channel.peak = Math.max(db, channel.peak - PEAK_FALL_DB_PER_S * elapsed);
        }
        levels.push(db);
        peaks.push(channel.peak);
      }
      source.set({ levels, peaks });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysers, source]);

  return source;
}
```

```tsx
// a component that shows them
import { Meter } from "@/components/audio-ui/meter";
import { useLevels } from "@/hooks/use-levels";

const levels = useLevels(analysers);

<Meter aria-label="Master" source={levels} />;
```

For stereo, split the signal with a `ChannelSplitterNode` and connect each output to its own `AnalyserNode`.

### 2.4 Playheads and playback position

**Impact: HIGH (a smooth playhead instead of 4 jumps a second)**

A seekable Waveform and every Timeline playhead follow a `source` of the position, in the same unit as their `duration`.

**Incorrect:**

```tsx
const [time, setTime] = useState(0);
<audio onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} /> // ~4 updates/s: the playhead stutters
```

**Correct:**

```tsx
const [position] = useState(() => createSource(0));

useEffect(() => {
  let frame = 0;
  const tick = () => {
    position.set(audio.currentTime); // or clock.getPosition() for a sequencer
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}, [audio, position]);
```

Commit seeks (the user dropping the playhead) through `onValueCommitted`, then set `audio.currentTime`.

### 2.5 Waveform peaks: decode once

**Impact: HIGH (no audio decoding on render)**

Decoding and reducing an audio file is expensive. Do it once per file, at a resolution above the widest view, and pass the result as a plain prop.

**Incorrect:**

```tsx
function Track({ file }: { file: ArrayBuffer }) {
  const peaks = computePeaks(decode(file), width); // on every render, at the current width
  return <Waveform values={peaks} />;
}
```

**Correct:**

```ts
// npx shadcn@latest add @audio-ui/waveform-dsp
const channels = await decodeAudioChannels(ctx, file);
const values = normalizePeaks(computePeaks(channels, 4096)); // once, at load
```

The waveform fits the peaks to its own width and zoom.

### 2.6 Showing a live value as text

**Impact: MEDIUM (only the readout re-renders, not the mixer around it)**

A number readout of a live level has to re-render to change. Subscribe to the source in the smallest component that shows it, never in a parent that also renders the controls.

**Incorrect (the whole channel strip re-renders every frame):**

```tsx
function ChannelStrip({ levels }: { levels: Levels }) {
  const frame = useSyncExternalStore(levels.subscribe, levels.getSnapshot);
  return (
    <div>
      <Fader aria-label="Volume" />
      <Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
      <Meter aria-label="Level" source={levels} />
      <span>{Math.round(frame.peaks?.[0] ?? -100)} dB</span>
    </div>
  );
}
```

**Correct (a leaf owns the subscription):**

```tsx
import type { Meter as MeterPrimitive, Source } from "@audio-ui/react";
import { useSyncExternalStore } from "react";
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";
import { Meter } from "@/components/audio-ui/meter";

type Levels = Source<MeterPrimitive.Root.Frame>;

function PeakReadout({ levels }: { levels: Levels }) {
  const frame = useSyncExternalStore(levels.subscribe, levels.getSnapshot);
  return <span className="tabular-nums">{Math.round(frame.peaks?.[0] ?? -100)} dB</span>;
}

function ChannelStrip({ levels }: { levels: Levels }) {
  return (
    <div>
      <Fader aria-label="Volume" />
      <Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
      <Meter aria-label="Level" source={levels} />
      <PeakReadout levels={levels} />
    </div>
  );
}
```

### 2.7 Spectrum on a Plot

**Impact: MEDIUM (a readable spectrum on a log axis, without a render per frame)**

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

---

## 3. Values & Events

**Impact: HIGH**

How a control's value flows: controlled or uncontrolled, change versus commit, scales, anchors and rejected changes.

### 3.1 Controlled or uncontrolled, never both

**Impact: HIGH (no frozen or jumping controls)**

A control either owns its value (`defaultValue`) or follows yours (`value` + `onValueChange`). Passing `value` without updating it freezes the control; passing both makes it jump.

**Incorrect:**

```tsx
<Fader defaultValue={0} value={gain} />          // which one wins?
<Fader value={gain} />                           // frozen: nothing updates gain
```

**Correct:**

```tsx
<Fader defaultValue={0} />                                   // uncontrolled
<Fader onValueChange={setGain} value={gain} />               // controlled
```

`defaultValue` is still useful on a controlled Knob: it is the double-tap reset target.

### 3.2 Size step and largeStep to the range

**Impact: HIGH (a 0 to 1 control gets a hundred positions instead of two)**

`step` defaults to `1` and `largeStep` (Page Up/Down, Shift + arrows) to `10`: sized for the default 0 to 100 range. On a mix, pan or 0 to 1 gain control, `step={1}` leaves only the two ends, and `largeStep={10}` sends one key press straight to the end of the range. Set both whenever the range isn't 0 to 100 (XYPad: `stepX` and `stepY`).

**Incorrect (two positions, and Page Up jumps to the end):**

```tsx
<Knob aria-label="Mix" max={1} min={0} />
<Knob anchor={0} aria-label="Pan" max={1} min={-1} step={0.01} /> // Shift + arrow jumps to a hard pan
```

**Correct (a fine step and a large step about a tenth of the range):**

```tsx
<Knob aria-label="Mix" largeStep={0.1} max={1} min={0} step={0.01} />
<Knob anchor={0} aria-label="Pan" largeStep={0.1} max={1} min={-1} step={0.01} />
<XYPad aria-label="Filter" maxX={1} maxY={1} minX={0} minY={0} stepX={0.01} stepY={0.01} />
```

With `scale="log"` the keys and the wheel move a share of the travel instead (1%, or 10% with Shift and the Page keys), so `largeStep` matters only on linear scales.

### 3.3 Sound on change, persistence on commit

**Impact: HIGH (one write per gesture instead of hundreds)**

`onValueChange` fires on every step of a drag, wheel tick and key press. `onValueCommitted` fires once when the gesture ends. Writing to storage, undo history or the network on change turns one drag into hundreds of writes.

**Incorrect:**

```tsx
<Knob
  onValueChange={(v) => {
    setCutoff(v);
    history.push({ cutoff: v });      // hundreds of undo steps per drag
    fetch("/api/preset", { method: "PATCH", body: JSON.stringify({ cutoff: v }) });
  }}
  value={cutoff}
/>
```

**Correct:**

```tsx
<Knob
  onValueChange={(v) => {
    setCutoff(v);
    filter.frequency.setTargetAtTime(v, ctx.currentTime, 0.01);
  }}
  onValueCommitted={(v) => {
    history.push({ cutoff: v });
    savePreset({ cutoff: v });
  }}
  value={cutoff}
/>
```

A drag commits once, on release. A wheel tick, a key press and a reset are each a whole interaction (`eventDetails.reason` is `"wheel"`, `"keyboard"`, `"reset"`), so spinning the wheel or holding an arrow key commits on every step. When the write is expensive (a network request), also coalesce the commits:

```tsx
const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

<Knob
  onValueCommitted={(v) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => savePreset({ cutoff: v }), 300); // once, after a wheel spin stops
  }}
/>
```

### 3.4 Logarithmic scales for frequency

**Impact: MEDIUM (usable travel across the audible range)**

Hearing is logarithmic. On a linear 20 Hz to 20 kHz knob, the whole musical range sits in the first few degrees.

**Incorrect:**

```tsx
<Knob aria-label="Cutoff" max={20_000} min={20} />
```

**Correct:**

```tsx
<Knob aria-label="Cutoff" max={20_000} min={20} scale="log" />
```

`scale="log"` needs a positive `min`. Use it for frequency, Q and ratios. Level in dB is already logarithmic: keep it linear in dB.

### 3.5 Rejecting a change

**Impact: MEDIUM (the control and its announced value stay in sync)**

To refuse a value (a locked track, a value an app rule forbids), cancel the change. Ignoring it in state leaves the control and the announced value out of sync for a frame.

**Incorrect:**

```tsx
<Fader onValueChange={(v) => { if (!locked) setGain(v); }} value={gain} />
```

**Correct:**

```tsx
<Fader
  onValueChange={(v, eventDetails) => {
    if (locked) {
      eventDetails.cancel();
      return;
    }
    setGain(v);
  }}
  value={gain}
/>
```

`eventDetails.reason` says what caused the change (`"drag"`, `"keyboard"`, `"wheel"`, `"reset"`, `"input-change"`), and on a piano roll `eventDetails.edit` says what was edited.

### 3.6 Anchors for bipolar controls

**Impact: LOW (the center reads as the center)**

A pan or detune control is centered. Without an anchor, the indicator arc grows from the minimum, so "center" looks like "half way".

**Incorrect:**

```tsx
<Knob aria-label="Pan" defaultValue={0} max={1} min={-1} step={0.01} />
```

**Correct:**

```tsx
<Knob anchor={0} aria-label="Pan" defaultValue={0} largeStep={0.1} max={1} min={-1} step={0.01} />
```

---

## 4. Accessibility

**Impact: HIGH**

Every control stays usable with a keyboard, a screen reader and a finger, whatever it looks like.

### 4.1 Accessible names

**Impact: HIGH (controls usable with a screen reader)**

The primitives set the role, `aria-valuenow` and `aria-valuetext`. Only you know what the control is for.

**Incorrect:**

```tsx
<div className="flex gap-4">
  <Knob />
  <Knob />
</div>
```

**Correct:**

```tsx
<div className="flex gap-4">
  <Knob aria-label="Cutoff" />
  <Knob aria-label="Resonance" />
</div>
```

With several channels, a Meter names each one from its `aria-label` ("Master 1", "Master 2").

The value text is announced too. `format` takes `Intl.NumberFormat` options such as `{ maximumFractionDigits: 1 }` or `{ style: "percent" }`, but `Intl` has no hertz or decibel unit, and an unknown unit throws while the control renders. Put the unit in `formatValue` on the registry Knob and Fader (it prints the readout and the announced text), or in `getAriaValueText` on the primitive's thumb:

```tsx
<Knob
  aria-label="Cutoff"
  formatValue={(hz) => `${Math.round(hz)} Hz`}
  max={20_000}
  min={20}
  scale="log"
/>

<Knob.Thumb getAriaValueText={(formatted) => `${formatted} Hz`} />
```

### 4.2 Keep the focusable part

**Impact: HIGH (keyboard and screen reader access survive restyling)**

The thumb holds the input that the keyboard and screen readers reach. Replacing it with a `div` keeps the look and loses the control.

**Incorrect:**

```tsx
<Fader.Control>
  <div className="my-thumb" style={{ bottom: `${percent}%` }} />
</Fader.Control>
```

**Correct:**

```tsx
<Fader.Control>
  <Fader.Thumb render={(props, state) => <MyThumb {...props} active={state.dragging} />} />
</Fader.Control>
```

`render` takes an element (`render={<span />}`) or a function of `(props, state)`. Always spread `props`.

### 4.3 Focus and hit areas

**Impact: MEDIUM (visible focus, and thumbs you can grab on touch)**

The headless primitives draw nothing, focus ring included. A thumb sized for the design (often 10 to 14px) is too small to grab with a finger.

**Incorrect (focus removed, hit area as small as the drawing):**

```css
.thumb {
  width: 12px;
  height: 12px;
  outline: none;
}
```

**Correct (a visible focus ring, a larger invisible hit area):**

```css
.thumb {
  position: relative;
  width: 12px;
  height: 12px;
}

.thumb:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* widen what the pointer can grab, not what is drawn */
.thumb::before {
  content: "";
  position: absolute;
  inset: -8px;
}
```

---

## 5. Without React

**Impact: HIGH**

Vue, Svelte, Solid, Angular, web components or the plain DOM: the same controls built on the framework-free controllers of `@audio-ui/core`.

### 5.1 Draw from the snapshot

**Impact: HIGH (the view matches the scale, sweep and formatting exactly)**

The controller already computed what to draw: `angle`, `percent`, `anchorPercent`, `formatted`, `dragging`, `disabled`. Recomputing geometry from `value` gets the sweep wrong (the knob turns 288°, not 270°), ignores `scale="log"`, and shows the value instead of the dragged one. Subscribe, read the snapshot, draw it.

**Incorrect (geometry recomputed from the value):**

```ts
const angle = ((value - min) / (max - min)) * 270 - 135; // wrong sweep, linear only
thumb.style.rotate = `${angle}deg`;
label.textContent = String(value);
```

**Correct (everything from the snapshot):**

```ts
const render = () => {
  const s = knob.getSnapshot();
  thumb.style.rotate = `${s.angle}deg`;
  label.textContent = s.formatted;
  root.toggleAttribute("data-dragging", s.dragging);
};
const unsubscribe = knob.subscribe(render);
render();
```

`getSnapshot` returns the same object until something changes, so it can back a framework store directly ([core.md](./core.md)).

### 5.2 Keep a native range input for keyboard and screen readers

**Impact: HIGH (the control is focusable, named, announced and submitted with forms)**

The controllers handle keys, but something has to take focus, carry the name and announce the value. The React primitives use a visually hidden `<input type="range">` inside the thumb: do the same. Route its keys to `keyDown` (and prevent the default when it returns `true`), and its `input` event to `type`, which is how assistive technology sets a value.

**Incorrect (a focusable div that handles keys itself):**

```html
<div class="knob" tabindex="0" onkeydown="value++"></div>
```

**Correct (a real range input wired to the controller):**

```html
<div class="knob-thumb">
  <input type="range" aria-label="Cutoff" class="visually-hidden" />
</div>
```

```ts
input.addEventListener("keydown", (event) => {
  if (knob.keyDown(event)) {
    event.preventDefault(); // arrows, Page Up/Down, Home, End, Delete to reset
  }
});
input.addEventListener("input", (event) => knob.type(Number(input.value), event));

// in render(): keep the input in step with the snapshot
input.value = String(s.value);
input.setAttribute("aria-valuetext", s.formatted);
input.disabled = s.disabled;
```

Hide it with a visually-hidden style, not `display: none`, or it can't take focus.

### 5.3 One controller per control, created once

**Impact: HIGH (drags, focus and the uncontrolled value survive option changes)**

A controller holds the gesture in flight and, when uncontrolled, the value. Recreating it whenever an option changes (a reactive block, a computed, a re-render) drops the drag under the pointer and resets the value. Create it once per mounted control and hand it new options with `setOptions`.

**Incorrect (a new controller on every change):**

```ts
// Vue
const knob = computed(() => createKnobController({ max: props.max, min: props.min }));
```

**Correct (created once, options updated):**

```ts
// Vue
const knob = createKnobController();
watchEffect(() => {
  knob.setOptions(options());
  sync();
});
```

Every primitive follows the same shape: `create<Name>Controller` from `@audio-ui/core/<name>` (`createKnobController`, `createFaderController`, `createXYPadController`, `createSequencerController`…).

### 5.4 Pass every option to setOptions, then redraw

**Impact: HIGH (a disabled, rescaled or re-ranged control shows it at once)**

`setOptions` **replaces** the options (it doesn't merge) and **notifies no one**: subscribers only hear about value and gesture changes. React gets away with it because it re-renders anyway; any other adapter must keep the full options and redraw after setting them.

Create the controller empty and call `setOptions` before the first draw, as the React primitives do. Every option then applies from the start, on any release.

**Incorrect (a partial object, no redraw):**

```ts
knob.setOptions({ disabled: true }); // max, min, step, callbacks... are gone
// and the view still shows an enabled knob
```

**Correct (merge, set, redraw):**

```ts
let current: KnobOptions = { max: 100, min: 0, onValueChange };

function update(next: Partial<KnobOptions>) {
  current = { ...current, ...next };
  knob.setOptions(current);
  render(); // draws from knob.getSnapshot()
}
```

### 5.5 Prepare the pointer before pressing the controller

**Impact: HIGH (touch drags don't scroll the page, and the keys work right after a click)**

`press(event, element)` starts the drag, but it doesn't know about the page around it. Left unprepared, a touch drag scrolls the page instead of turning the knob, the browser selects text or starts a native drag while you turn, a right-click turns the knob, and the arrow keys do nothing right after a click because focus stayed behind. The React primitives do all four; so must any other adapter.

**Incorrect (the raw event goes straight to the controller):**

```ts
control.addEventListener("pointerdown", (event) => knob.press(event, control));
```

**Correct (the primary button only, no browser gesture, focus on the hidden input):**

```ts
control.style.touchAction = "none"; // a touch drag turns the knob, it doesn't scroll the page

control.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) {
    return; // the primary button only
  }
  event.preventDefault(); // no text selection or native drag while turning
  input.focus({ preventScroll: true }); // the arrow keys work right after a click
  knob.press(event, control); // a disabled knob ignores it
});
```

`input` is the hidden `<input type="range">` of the rule `core-native-range-input`.

### 5.6 Import public entries, never internal

**Impact: MEDIUM (upgrades don't break the adapter)**

`@audio-ui/core/internal` holds helpers for the official adapters and may change in any release. Everything an adapter needs is public: the controllers in `@audio-ui/core/<name>`, and the shared values, scales, sources and frame helpers in `@audio-ui/core`.

**Incorrect:**

```ts
import { someHelper } from "@audio-ui/core/internal";
```

**Correct:**

```ts
import { createKnobController, STATE_ATTRIBUTES_MAPPING } from "@audio-ui/core/knob";
import { createFrameTask, createSource, resolveScale } from "@audio-ui/core";
```

### 5.7 Tear down what you attach

**Impact: MEDIUM (no listeners or redraws on unmounted controls)**

`subscribe` and `attachWheel` return their own removers. A control unmounted without them keeps redrawing a detached node and swallowing wheel events.

**Incorrect:**

```ts
knob.subscribe(render);
knob.attachWheel(control);
control.addEventListener("pointerdown", onPointerDown);
```

**Correct:**

```ts
const unsubscribe = knob.subscribe(render);
const detachWheel = knob.attachWheel(control);
control.addEventListener("pointerdown", onPointerDown);

function destroy() {
  unsubscribe();
  detachWheel();
  control.removeEventListener("pointerdown", onPointerDown);
}
```

In Vue, call the removers in `onScopeDispose`; in Svelte, return them from `$effect`; in a web component, from `disconnectedCallback`.

---

## 6. Styling

**Impact: MEDIUM**

Styling the registry components through their props and tokens, and the headless primitives through their state.

### 6.1 Headless primitives: style by state

**Impact: MEDIUM (state styles without extra renders)**

`@audio-ui/react` ships no CSS. Every part accepts `className` and `style` as a value **or a function of its state**, and exposes state as `data-*` attributes and CSS variables.

**Incorrect:**

```tsx
const [dragging, setDragging] = useState(false);

<Knob.Root onPointerDown={() => setDragging(true)} onPointerUp={() => setDragging(false)}>
  <Knob.Control className={dragging ? "knob dragging" : "knob"} />
</Knob.Root>
```

**Correct:**

```tsx
<Knob.Root>
  <Knob.Control className={(state) => (state.dragging ? "knob dragging" : "knob")} />
</Knob.Root>
```

```css
/* or plain CSS on the attributes */
.knob[data-dragging] { cursor: grabbing; }
.knob[data-disabled] { opacity: 0.5; }
```

Common hooks (check the part's API reference for the exact list, don't invent names):

| Hook | Examples |
| --- | --- |
| Data attributes | `data-disabled`, `data-dragging`, `data-orientation` (Fader), `data-active` (Knob.Mark, live Waveform), `data-clipping` (Meter), `data-selected`, `data-scrubbing` |
| CSS variables | `--xy-pad-x` / `--xy-pad-y`, `--knob-mark-angle`, `--waveform-position`, `--waveform-level`, `--timeline-unit`, `--sequencer-velocity`, `--piano-roll-velocity` |

Read the part list in the docs' **Anatomy** section: a part outside its parent does nothing.

```tsx
import { Knob } from "@audio-ui/react/knob"; // one entry per primitive keeps the bundle small

<Knob.Root aria-label="Cutoff" defaultValue={50}>
  <Knob.Control>
    <Knob.Track />
    <Knob.Indicator />
    <Knob.Thumb />
  </Knob.Control>
  <Knob.Value />
</Knob.Root>
```

### 6.2 Registry components: props before className

**Impact: MEDIUM (keeps proportions and theme)**

The copied components (`@/components/audio-ui/*`) carry size variants and options. Overriding their internals with classes breaks proportions and the theme.

**Incorrect:**

```tsx
<Knob className="h-24 w-24 [&_svg]:stroke-[6]" />
<Fader className="[&_[data-slot=thumb]]:hidden" />
```

**Correct:**

```tsx
import { Fader } from "@/components/audio-ui/fader";
import { Knob } from "@/components/audio-ui/knob";

<Knob size="lg" />
<Fader marks={[0, -6, -12, -24]} orientation="horizontal" valueLabel="always" />
```

`className` is for layout around the component (grid placement, margins). If a look needs a change the props don't offer, edit the copied file: it belongs to the project.

### 6.3 Semantic tokens only

**Impact: MEDIUM (themes and dark mode keep working)**

**Incorrect:**

```tsx
<div className="bg-zinc-900 text-green-400">
  <Meter className="[&_[data-clipping]]:bg-red-500" />
</div>
```

**Correct:**

```tsx
<div className="bg-card text-card-foreground">
  <Meter />  {/* clipping already uses the destructive token */}
</div>
```

### 6.4 Never edit the package

**Impact: LOW (upgrades keep working)**

Changes made inside `node_modules/@audio-ui/react` (or a fork of it) vanish on the next install and block every upgrade. The look lives in your code: either the headless parts styled by state, or the registry component copied into the project.

**Incorrect (patching the installed package):**

```bash
# lost on the next install, conflicts with every upgrade
sed -i 's/strokeWidth = 4/strokeWidth = 6/' node_modules/@audio-ui/react/dist/index.js
```

**Correct (style the parts, or own a copy):**

```tsx
<Knob.Indicator strokeWidth={6} /> // the part's own prop
```

```bash
npx shadcn@latest add @audio-ui/knob   # then edit components/audio-ui/knob.tsx: it belongs to the project
```

---

## 7. AI Control

**Impact: MEDIUM**

Letting a model operate the components through typed tools that edit the same state a person does.

### 7.1 Keep the person in charge

**Impact: HIGH (no unattended recording, no loud playback, edits stay undoable)**

The person and the model edit the **same** state: every change shows in the component, undo works, and any value can be overridden by hand. Some actions never belong to the model.

**Incorrect (the model can record, play and set any level):**

```ts
const tools = {
  startRecording: { schema: z.object({}), apply: () => recorder.start() },
  setVolume: { schema: z.object({ db: z.number() }), apply: (s, { db }) => ({ ...s, db }) },
};
```

**Incorrect (undo recorded inside a state updater):**

```ts
setState((prev) => {
  history.push(prev); // an updater must be pure: React runs it twice in StrictMode, so every edit is recorded twice
  return tools[name].apply(prev, args);
});
```

**Correct (consent stays with a click, levels are bounded, one undo step per call):**

```ts
const tools = {
  setVolume: {
    description: "Set the output volume in dB.",
    schema: z.object({ db: z.number().min(-60).max(0) }), // never above 0 dB
    apply: (state, { db }) => ({ ...state, db }),
  },
};
```

```tsx
// npx shadcn@latest add @audio-ui/history
import { emptyHistory, recordChange, settleChange, undo } from "@/lib/history";

const historyRef = useRef(emptyHistory<PianoRollState>());

// in applyTool, before showing `next`: what it replaces is one step
historyRef.current = recordChange(
  settleChange(historyRef.current),
  stateRef.current
);
stateRef.current = next;
setState(next);

const undoLast = () => {
  const step = undo(historyRef.current, stateRef.current);
  if (step) {
    historyRef.current = step.history;
    stateRef.current = step.present;
    setState(step.present);
  }
};
```

The history lives in a ref and is updated from the handler, never from inside a `setState` updater. The person's own edits go through the same history, so one Undo takes back either.

Starting the microphone, recording, uploading and starting playback stay behind a button the person presses.

### 7.2 Schemas come from the instance

**Impact: HIGH (rejects hallucinated instruments and out-of-range steps)**

Bounds, enums and lengths come from the config of the component on screen. A hard-coded schema lets the model name instruments that don't exist or steps past the grid.

**Incorrect:**

```ts
const schema = z.object({
  instrument: z.enum(["kick", "snare", "hat"]), // this kit has a clap and no hat
  step: z.number(),                            // unbounded
});
```

**Correct:**

```ts
function createDrumTools({ instruments, stepCount }: { instruments: [string, ...string[]]; stepCount: number }) {
  const toggleStep = z.object({
    instrument: z.enum(instruments),
    step: z.number().int().min(0).max(stepCount - 1),
  });
  // ...
}
```

Build the tool set with a factory that takes the config. For a piano roll it is installable:

```bash
npx shadcn@latest add @audio-ui/piano-roll-tools   # needs zod
```

```ts
const tools = createPianoRollTools({ minPitch: 36, maxPitch: 72, stepCount: 32 });
// setNotes, addNotes, removeNotes, transpose, clear, setTempo
// state: { bpm, notes: { id, pitch, start, length, velocity }[] }, start/length in grid steps
```

### 7.3 Tools edit state, not the DOM

**Impact: HIGH (UI, audio and undo never fall out of sync)**

audio/ui components are controlled: their whole state is a plain value. The model produces the next value through tools; React renders it and the audio follows, exactly as when a person drags.

```
text ─▶ model ─▶ { name, args } ─▶ schema.parse ─▶ apply(state, args) ─▶ setState ─▶ component + audio
```

Each tool is `{ description, schema, apply }`: a sentence for the model, a zod schema of its arguments, and a pure reducer. One function turns a call into the next state, wherever the state lives.

**Incorrect (the model drives the interface the way a user would):**

```ts
execute: async ({ selector, value }) => {
  document.querySelector(selector)?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
};
```

**Correct (a call becomes the next state):**

```tsx
const [state, setState] = useState<PianoRollState>({ bpm: 120, notes: [] });
// The latest state, for calls that arrive before the next render: a model can
// call two tools in one step, and a state variable is stale until then.
const stateRef = useRef(state);

/** One tool call from the model. Throwing sends the message back, and the model retries. */
const applyTool = (name: string, input: unknown) => {
  // `tools["constructor"]` is truthy: only the tools you made count.
  if (!Object.hasOwn(tools, name)) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const tool = tools[name as keyof typeof tools];
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.message);
  }
  const next = tool.apply(stateRef.current, parsed.data as never);
  stateRef.current = next;
  setState(next);
  return `${name} applied`;
};
```

The state lives in the browser, so this function does too. How a call from a server-side model reaches it is the rule `ai-structured-tool-calls`.

### 7.4 apply is pure and re-clamps

**Impact: MEDIUM (every tool call yields a valid state)**

A schema catches wrong types; it can't catch every odd combination (a note that starts in range and ends past the grid). Clamp and snap again in `apply`, the way the component would.

**Incorrect:**

```ts
apply: (state, { notes }) => ({ ...state, notes: [...state.notes, ...notes] }),
```

**Correct:**

```ts
apply: (state, { notes }) => ({
  ...state,
  notes: [...state.notes, ...notes.map((n, i) => clampNoteToDomain(n, nextId(state) + i, domain))],
}),
```

Pure reducers are testable without a model: test them like any function.

### 7.5 Give the model the current state

**Impact: MEDIUM (relative edits land on the right notes and values)**

"Remove the last two notes", "a bit brighter" and "double the tempo" are relative to what is there. Without the current state, the model guesses ids and values, or rewrites everything.

**Incorrect (the model edits blind):**

```ts
const result = await generateText({
  model,
  tools: aiTools,
  system: "You edit a piano roll.",
  prompt: userText,
});
```

**Correct (the state the tools act on is in context):**

```ts
const result = await generateText({
  model,
  tools: aiTools,
  system: [
    "You edit a piano roll. Pitches are MIDI numbers, start and length are grid steps.",
    `Range: ${minPitch} to ${maxPitch}, ${stepCount} steps.`,
    `Current state: ${JSON.stringify({ bpm: state.bpm, notes: state.notes })}`,
  ].join("\n"),
  prompt: userText,
});
```

For large states, expose a read tool (`getNotes`, `getMix`) instead of inlining everything.

### 7.6 Wiring: AI SDK, Anthropic or OpenAI SDKs, MCP

**Impact: MEDIUM (validated arguments instead of parsed prose, run where the state lives)**

Asking the model to answer in JSON and parsing its text breaks on the first stray sentence, and nothing checks the values. Tool calls carry arguments the schema validates before anything touches state.

The state of a component lives in the browser, but the model is called from a server route (the API key can't ship to the page). So the server declares the tools with their schemas and **no** `execute`, and the browser runs each call on its state and sends the result back.

**Incorrect (prose parsed as JSON):**

```ts
const { text } = await generateText({ model, prompt: `${userText}\nAnswer with JSON notes.` });
setState((prev) => ({ ...prev, notes: JSON.parse(text) })); // throws, or writes anything
```

**Incorrect (an `execute` that needs browser state, on the server):**

```ts
tool({
  description: t.description,
  inputSchema: t.schema,
  execute: async (args) => setState((prev) => t.apply(prev, args)), // no setState in a route
});
```

**Correct (Vercel AI SDK: schemas on the server, the call runs in the browser):**

```ts
// app/api/chat/route.ts
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import type { ZodType } from "zod";
import { pianoRollTools } from "@/lib/piano-roll-ai"; // createPianoRollTools(your roll's config)
import type { PianoRollState } from "@/lib/piano-roll-tools";

// No `execute`. The schemas are widened to ZodType: `tool()` can't infer one
// input type from six different schemas.
const tools = Object.fromEntries(
  Object.entries(pianoRollTools).map(([name, t]) => [
    name,
    tool({ description: t.description, inputSchema: t.schema as ZodType }),
  ])
);

export async function POST(request: Request) {
  const { messages, state }: { messages: UIMessage[]; state: PianoRollState } =
    await request.json();

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: "anthropic/claude-sonnet-4.5", // a model id on the AI Gateway, or a provider's model
    system: `You edit a piano roll through tools. Current state: ${JSON.stringify(state)}`,
    tools,
  });
  return result.toUIMessageStreamResponse();
}
```

```tsx
// components/use-roll-chat.ts
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";

export function useRollChat(
  applyTool: (name: string, input: unknown) => string, // from the rule ai-tools-edit-state
  getState: () => PianoRollState
) {
  const chat = useChat({
    onToolCall: ({ toolCall }) => {
      const { toolCallId, toolName } = toolCall;
      try {
        // Not awaited: waiting on the output inside onToolCall can deadlock the chat.
        chat.addToolOutput({ output: applyTool(toolName, toolCall.input), tool: toolName, toolCallId });
      } catch (cause) {
        chat.addToolOutput({
          errorText: cause instanceof Error ? cause.message : "The tool call failed.",
          state: "output-error",
          tool: toolName,
          toolCallId,
        });
      }
    },
    // Once every call has its output, the model gets them back and answers.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ body, messages }) => ({
        body: { ...body, messages, state: getState() }, // the roll as it is now
      }),
    }),
  });
  return chat;
}
```

Written against AI SDK 6 and 7 (`inputSchema`, `addToolOutput`).

**Correct (Anthropic or OpenAI SDKs, MCP servers):** send `z.toJSONSchema(t.schema)` (zod 4) as each tool's input schema. On a tool call, wherever the state lives:

```ts
const parsed = t.schema.safeParse(input);
if (!parsed.success) {
  return { isError: true, content: parsed.error.message }; // the model retries
}
const next = t.apply(current, parsed.data);
return { content: "applied" };
```

Prefer few, coarse tools (`setNotes` replaces the whole roll) over many tiny ones: models do better writing a whole phrase at once.

---

## References

1. https://www.audio-ui.dev/docs
2. https://www.audio-ui.dev/llms.txt
3. https://developer.mozilla.org/docs/Web/API/Web_Audio_API
4. https://web.dev/articles/audio-scheduling
5. https://www.w3.org/WAI/ARIA/apg/patterns/slider/
