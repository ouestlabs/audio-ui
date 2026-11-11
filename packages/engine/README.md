# @audio-ui/engine

The audio logic behind audio/ui's interfaces, with no UI framework in it: devices as named parameters, musical time and the look-ahead scheduler, levels and the curves a panel draws, MIDI input, scales, and the clip player. It runs on the main thread, in a worker or in an `AudioWorklet`, under any framework or none.

```bash
npm install @audio-ui/engine
```

It builds on [`@audio-ui/core`](../core), the logic of the UI primitives, and on [audio.js](https://audio.js.org) where an atom does the job.

## Modules

Each module is its own subpath, so a page pays only for what it imports:

- `@audio-ui/engine/device`: an effect or an instrument as a description: `defineDevice`, its state, `apply` with what each change did, the bindings an engine implements, and the tools an agent drives it with.
- `@audio-ui/engine/time`: tempos and signatures, bars and beats, grid divisions, tempo-synced note values, warp markers, the metronome, and the look-ahead scheduler a transport clock runs on.
- `@audio-ui/engine/analysis`: levels in dB, a spectrum on a log axis and its held peaks, the curves of a filter, an equalizer and a compressor, waveform peaks, transients and auto-warp.
- `@audio-ui/engine/pitch`: named scales and the pitch classes they keep.
- `@audio-ui/engine/midi`: the page's MIDI inputs as one source, and a raw message read.
- `@audio-ui/engine/playback`: clips placed in frames, the transport on the audio clock, the clip player's processor, streamed recordings, and the mixer's pan law, solo and delay compensation.

Docs: https://www.audio-ui.dev/docs/engine
