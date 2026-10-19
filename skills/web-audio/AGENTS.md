# audio/ui web-audio

**Version 1.2.0**  
audio/ui  
October 2026

> **Note:**  
> This document is for agents and LLMs building audio interfaces with audio/ui. It is generated from `rules/` by `bun run skill:build` in `apps/www`: edit the rules, not this file.

---

## Abstract

How to get sound out of audio/ui controls and show it live, for AI agents and LLMs: the audio context, click-free parameter ramps, gain, scheduling, and meters, spectra, waveforms and playheads that never re-render React per frame. Each rule shows the incorrect code an agent tends to write and the correct code with the real audio/ui API.

---

## Table of Contents

1. [Web Audio](#1-web-audio): **CRITICAL**
   - 1.1 [Create the AudioContext lazily, resume it in a gesture](#11-create-the-audiocontext-lazily-resume-it-in-a-gesture)
   - 1.2 [Ramp parameters, never assign them](#12-ramp-parameters-never-assign-them)
   - 1.3 [Schedule on the audio clock](#13-schedule-on-the-audio-clock)
   - 1.4 [dB on the control, linear gain on the node](#14-db-on-the-control-linear-gain-on-the-node)
   - 1.5 [Leave headroom below full scale](#15-leave-headroom-below-full-scale)
   - 1.6 [Play the notes the way the roll shows them](#16-play-the-notes-the-way-the-roll-shows-them)
   - 1.7 [Clean up what you create](#17-clean-up-what-you-create)
2. [Live Data](#2-live-data): **CRITICAL**
   - 2.1 [Signals go through a source, not state](#21-signals-go-through-a-source-not-state)
   - 2.2 [Detect pitch with a period search, not the loudest FFT bin](#22-detect-pitch-with-a-period-search-not-the-loudest-fft-bin)
   - 2.3 [Meter a microphone as it delivers the signal](#23-meter-a-microphone-as-it-delivers-the-signal)
   - 2.4 [Meter levels from an AnalyserNode](#24-meter-levels-from-an-analysernode)
   - 2.5 [One MIDI input for the page, connected from a click](#25-one-midi-input-for-the-page-connected-from-a-click)
   - 2.6 [Playheads and playback position](#26-playheads-and-playback-position)
   - 2.7 [Waveform peaks: decode once](#27-waveform-peaks-decode-once)
   - 2.8 [Showing a live value as text](#28-showing-a-live-value-as-text)
   - 2.9 [Spectrum on a Plot](#29-spectrum-on-a-plot)

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

A note that starts on a press (a pad, a key) must not wait for `resume()`: on the first press the promise can stay pending until the pointer is released, and the voice arrives after the key is up. Call `ctx.resume()` without awaiting it, schedule the voice at `ctx.currentTime` now, and add a one-time `pointerup` listener that resumes as well.

The registry ships this as a lib: `npx shadcn@latest add @audio-ui/web-audio`. Use one context per page; every connected node must come from it.

On touch, `pointerdown` does not count as a user activation: a pad that starts the context on strike can stay silent for its first tap. Resume the context on `pointerup` or `click` as well (`touchend` on older iOS), and keep playing from `pointerdown` once it runs.

Track "playing" yourself: a context created inside the click can already be `running`, so a play/pause toggle that reads `ctx.state` right after `new AudioContext()` suspends it on the first click.

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

`setInterval` and `setTimeout` drift, and browsers throttle them in background tabs. A sequencer that plays a note when its own timer fires swings and stalls.

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

The clock looks ahead and hands you the exact `AudioContext` time of each step. Start every node at that `time`. `clock.getPosition()` gives the playhead in steps for the UI; `@audio-ui/musical-time` converts tempo to seconds. `start()` does not resume a suspended context: call `ctx.resume()` in the same click first (rule `audio-resume-in-gesture`).

Without the registry, the same clock is a timer that only looks ahead: every 25 ms it schedules the steps that fall in the next 120 ms at their exact audio time. The timer decides when to look, the audio clock decides when a note sounds:

```ts
let next = ctx.currentTime;
let step = 0;
const timer = setInterval(() => {
  while (next < ctx.currentTime + 0.12) {
    for (const row of pattern) {
      if (row[step]) playAt(next); // osc.start(next)
    }
    next += 60 / bpm / 4;
    step = (step + 1) % 16;
  }
}, 25);
```

Read `bpm` from a ref so a tempo change applies on the next step, publish `step` through a source (`-1` on stop), and `clearInterval(timer)` on cleanup.

Drum voices need no library: a kick is a sine whose pitch falls from 150 to 40 Hz while its gain decays, started at `time`:

```ts
function kick(ctx: AudioContext, out: AudioNode, time: number, decay = 0.4) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + decay);
}
```

A snare is band-passed noise plus a short triangle click, a hat is high-passed noise with a very short decay. The registry's `drum-synthesis` lib is this same code with `triggerKick`, `triggerSnare` and `triggerHihat`, and it has no imports: copy `https://www.audio-ui.dev/r/base-nova/drum-synthesis.json` by hand if you do not use shadcn.

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

### 1.6 Play the notes the way the roll shows them

**Impact: HIGH (muted notes stay silent, chance and deviation are heard)**

The piano roll draws a note's `muted`, `chance` and `deviation`, but it plays nothing: the sequencer you write does. One that reads only `pitch`, `start`, `length` and `velocity` plays a deactivated note, plays a 25% note every time and never varies a velocity the user gave room to stray. A note can also start between steps, after a humanize or a stretch, so it starts at its own time inside the step.

**Incorrect (only the basic fields, only notes on a step):**

```tsx
onStep: (step, time) => {
  for (const note of notes) {
    if (note.start === step) {
      playNote(note.pitch, note.velocity ?? 1, time, note.length * secondsPerStep);
    }
  }
},
```

**Correct (every field the roll edits):**

```tsx
onStep: (step, time) => {
  for (const note of notes) {
    if (note.start < step || note.start >= step + 1) continue; // its step, even off the grid
    if (note.muted) continue; // deactivated: on the roll, silent
    if (Math.random() >= (note.chance ?? 1)) continue; // rolled each time round
    const velocity = Math.min(
      1,
      Math.max(0, (note.velocity ?? 1) + Math.random() * (note.deviation ?? 0))
    );
    const at = time + (note.start - step) * secondsPerStep;
    playNote(note.pitch, velocity, at, note.length * secondsPerStep);
  }
},
```

`deviation` is signed: positive strays up from the velocity, negative down. Leave muted notes out of a MIDI export too. `block-piano-roll` plays notes this way.

### 1.7 Clean up what you create

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

### 2.2 Detect pitch with a period search, not the loudest FFT bin

**Impact: HIGH (a tuner that names the right note and its cents, down to the low strings)**

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

### 2.3 Meter a microphone as it delivers the signal

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

Feed `analysers` to the `useAudioLevels` hook of the rule `live-meter-levels`, or the registry's `useMicrophone` hook does all of this and gives the analyser. The up-mix copies a mono signal to both channels (left and right both read the full level), and passes a real stereo signal through unchanged.

### 2.4 Meter levels from an AnalyserNode

**Impact: HIGH (the meter shows real dB levels)**

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
    // K-weighting for 48 kHz: [b0, b1, b2] and [a1, a2] for the shelf and the high-pass
    this.shelf = { b: [1.5351248595869702, -2.6916961894063807, 1.19839281085285], a: [-1.6906592931824103, 0.7324807742158501], s: [0, 0] };
    this.hp = { b: [0.9950299263000474, -1.9900598526000948, 0.9950299263000474], a: [-1.9900474548339797, 0.9900722503662099], s: [0, 0] };
    this.block = Math.round(sampleRate * 0.1); // the 100 ms steps of BS.1770 (a 400 ms window, every 100 ms)
    this.blocks = []; // mean squares of the last 30 steps, enough for the 3 s short term
    this.all = []; // every 400 ms block since the start, for the integrated value
    this.sum = 0;
    this.count = 0;
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
      if (++this.count === this.block) {
        this.blocks.push(this.sum / this.count);
        this.all.push(this.sum / this.count);
        if (this.blocks.length > 30) this.blocks.shift();
        this.sum = 0;
        this.count = 0;
        const momentary = this.blocks.slice(-4); // the last 400 ms
        const shortTerm = this.blocks; // the last 3 s
        this.port.postMessage({
          momentary: loudness(momentary),
          shortTerm: loudness(shortTerm),
          integrated: integrated(this.all),
        });
      }
    }
    return true;
  }
}
function loudness(blocks) {
  if (blocks.length === 0) return -70;
  const mean = blocks.reduce((s, x) => s + x, 0) / blocks.length;
  return -0.691 + 10 * Math.log10(mean + 1e-12);
}
// Integrated loudness: every 400 ms block above -70 LUFS, then drop the blocks 10 LU below the mean of the rest.
function integrated(blocks) {
  const kept = blocks.map((ms) => -0.691 + 10 * Math.log10(ms + 1e-12)).filter((l) => l > -70);
  if (kept.length === 0) return -70;
  const first = kept.reduce((s, l) => s + Math.pow(10, l / 10), 0) / kept.length;
  const second = kept.filter((l) => l > 10 * Math.log10(first) - 10);
  if (second.length === 0) return -70;
  return 10 * Math.log10(second.reduce((s, l) => s + Math.pow(10, l / 10), 0) / second.length);
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

// After loadLufs(ctx): connect the source to new AudioWorkletNode(ctx, "audioui-lufs"). Its port posts
// `{ momentary, shortTerm, integrated }` every 100 ms; publish each through a source. The integrated value gates
// the 400 ms blocks: the worklet posts `integrated` with the gate already applied (blocks above -70 LUFS, then the ones 10 LU below the average of the rest dropped), so publish it as it comes.

### 2.5 One MIDI input for the page, connected from a click

**Impact: HIGH (a MIDI keyboard that plays every instrument, with no stuck notes)**

`navigator.requestMIDIAccess()` may prompt for permission, so asking on mount either shows a prompt nobody asked for or is refused. Each component that opens its own access replaces the others' `onmidimessage` handler, so only the last one hears the keyboard. And raw messages hide traps: many keyboards send a note-on with velocity 0 to release a key, so a parser that only reads note-off leaves notes stuck.

**Incorrect (access on mount, one handler per component, raw bytes):**

```tsx
useEffect(() => {
  navigator.requestMIDIAccess().then((access) => {
    for (const input of access.inputs.values()) {
      input.onmidimessage = ({ data }) => {
        if (data?.[0] === 0x90) voices.triggerNote(data[1], envelope); // velocity 0 never releases
        if (data?.[0] === 0x80) voices.releaseNote(data[1], envelope);
      };
    }
  });
}, []);
```

**Correct (the registry hook, and a connect button anywhere on the page):**

```bash
npx shadcn@latest add @audio-ui/use-midi-input @audio-ui/midi-connect-control
```

```tsx
import { MidiConnectControl } from "@/components/audio-ui/midi-connect-control";
import { Piano } from "@/components/audio-ui/piano";
import { useMidiInput } from "@/hooks/use-midi-input";

const midi = useMidiInput({
  onNoteOff: (note) => voices.releaseNote(note, envelope),
  // velocity from 0 to 1; notes arrive outside a click, so resume a suspended context
  onNoteOn: (note, velocity) => {
    if (ctx.state === "suspended") ctx.resume();
    voices.triggerNote(note, envelope, velocity);
  },
});

<MidiConnectControl /> {/* asks for access on click; renders nothing without Web MIDI */}
<Piano activeNotes={midi.activeNotes} aria-label="Piano" />
```

Every component that calls `useMidiInput` hears the same devices, and one `MidiConnectControl` (or `midi.requestAccess` from a click) connects them all. Held keys are released when the device goes away. Without React, `createMidiInput()` from `@audio-ui/core/midi` is the same input as a source, and `parseMidiMessage` reads a raw message (channel, velocity from 0 to 1, pitch bend from -1 to 1).

### 2.6 Playheads and playback position

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

### 2.7 Waveform peaks: decode once

**Impact: HIGH (no audio decoding on render)**

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

The primitive takes the result as `peaks` on `Waveform.Root` (the registry component calls the same prop `values`), and draws it on `Waveform.Canvas`; its color is the `--waveform-color` and `--waveform-progress-color` variables, and `count` and `mirrored` belong to `Waveform.Bars`, not the canvas. Markup and CSS: the design skill's `directions.md`.

### 2.8 Showing a live value as text

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

### 2.9 Spectrum on a Plot

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

On the plot: `<Plot.Root minX={20} maxX={20000} minY={-96} maxY={0} scaleX="log">` with `<Plot.Trace fillTo={-96} source={live} />` and `<Plot.Trace source={held} />` inside `Plot.Graph`. `Plot.Root` is a positioned `div` that needs a height. Markup and CSS: the design skill's `directions.md`.

---

## References

1. https://www.audio-ui.dev/docs
2. https://www.audio-ui.dev/llms.txt
3. https://developer.mozilla.org/docs/Web/API/Web_Audio_API
4. https://web.dev/articles/audio-scheduling
