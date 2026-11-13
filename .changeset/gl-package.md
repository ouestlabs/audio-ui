---
"@audio-ui/gl": minor
---

A new package, `@audio-ui/gl`: audio drawn on the GPU with no UI framework in it. `lane` places a canvas on what a timeline's view shows and gives the clips in it, `waveform` draws a lane's clips as waveforms on one WebGL context (exact peaks with the RMS inside, a line through the samples zoomed in, plain or by band), and `spectrogram` draws them as spectrograms on one of four frequency axes, with the band zoom, the pointer's cell and the frequency axis laid out for a lane, over `gl-waveform` and `gl-spectrogram`.
