# @audio-ui/gl

Audio drawn on the GPU, with no UI framework in it: a lane of clips as waveforms or a spectrogram on one canvas and one WebGL context, over [gl-waveform](https://github.com/dy/gl-waveform) and [gl-spectrogram](https://github.com/dy/gl-spectrogram), with the frequency axis, the band zoom and the pointer reading that go with them.

```bash
npm install @audio-ui/gl
```

## Modules

Each module is its own subpath, so a page pays only for what it imports:

- `@audio-ui/gl/lane`: what every lane shares: placing the canvas on what the view shows, the clips in view with the frames they read, drawing again on a change of inputs, a resize, a scroll or the theme, and `hasWebGL2`.
- `@audio-ui/gl/waveform`: the waveforms of a lane's clips: the exact lowest and highest of every pixel column with the RMS inside, a line through the samples zoomed in, plain or as the three bands of the sound.
- `@audio-ui/gl/spectrogram`: the spectrograms of a lane's clips on one of four frequency axes, the band zoom, the pointer's cell, and the frequency axis laid out for a lane.

A browser keeps some sixteen WebGL contexts and drops the oldest past that, so a lane draws all its clips on one canvas and one context, and clips of one recording share what is on the GPU for it.

Docs: https://www.audio-ui.dev/docs/gl
