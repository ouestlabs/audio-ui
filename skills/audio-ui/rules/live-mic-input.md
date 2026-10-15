---
title: Meter a microphone as it delivers the signal
impact: HIGH
impactDescription: a meter that reads true on both bars, with no feedback
tags: microphone, getUserMedia, analyser, stereo, meter
---

## Meter a microphone as it delivers the signal

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
