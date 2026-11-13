# @audio-ui/gl

## 0.2.0

### Minor Changes

- 224e119: Waveform: a recording with several channels is drawn a row each once the rows are tall enough to read, as a DAW draws it, and as one waveform below that: `layout` is `auto`, `split` or `mix`, a clip gives its `channels`, and `splitsChannels` and `waveformRows` tell the layout for a lane height.

## 0.1.0

### Minor Changes

- 964575b: A new package, `@audio-ui/gl`: audio drawn on the GPU with no UI framework in it. `lane` places a canvas on what a timeline's view shows and gives the clips in it, `waveform` draws a lane's clips as waveforms on one WebGL context (exact peaks with the RMS inside, a line through the samples zoomed in, plain or by band), and `spectrogram` draws them as spectrograms on one of four frequency axes, with the band zoom, the pointer's cell and the frequency axis laid out for a lane, over `gl-waveform` and `gl-spectrogram`.
