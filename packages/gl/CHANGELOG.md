# @audio-ui/gl

## 0.5.0

### Minor Changes

- c8ff343: Waveform: `createWaveformLane(canvas, inputs, { shared: true })` draws on the page's one WebGL context and copies the picture onto `canvas`, a 2D canvas, so a page draws as many lanes as it has clips, past the sixteen contexts a browser keeps; lanes reading one recording share what is on the GPU for it. `zoom` may be left out for a lane that fits its clips to its box, and a clip's `peak` for the lane to read it from its leaves or its samples. Lane: a lane scrolled out of sight up or down draws nothing until it comes near. A lane's own context is let go of when the lane is destroyed (`releaseContext`, kept by `keepContext` for a lane started again on the same canvas), and `hasWebGL2` asks once and lets its probe go, so a page that mounts lanes often never loses one it draws on.

## 0.4.0

### Minor Changes

- f2dd152: Lane: a recording streamed from a file is drawn without being read whole. `LaneSamples.leaves` gives the recording summed up 256 frames at a time (`waveformLeaves`, `leavesPeak`): a waveform lane draws from them zoomed out, and past a leaf a device pixel reads only the frames it shows, a chunk of `CHUNK_FRAMES` at a time (`feedChunks`), letting go of the oldest. A spectrogram lane does the same from the recording's `spectra` (`LaneSamples.spectra`, made once by `spectrogramSpectra` of `@audio-ui/engine/analysis`), reading the frames it shows once a column of the view is narrower than one of theirs. A band of `WaveformBands` may be a reader with its leaves too, so a streamed recording is drawn by band, each band as tall as its leaves' loudest when no peak is given. Stretches of a clip that read as one line within a quarter of a pixel are drawn as one part (`joinParts`), so a warped clip zoomed out draws a part or two, not one per marker. `readKept` and `partsInView` are exported for lanes over other renderers.

## 0.3.1

### Patch Changes

- 51b47b2: Lane: a lane clears its whole canvas before it draws. The renderers leave the scissor test on, cut to the last part they drew, so a clear only cleared that part: a stereo waveform kept the picture of the frames before under its top row while it zoomed.

## 0.3.0

### Minor Changes

- f1b9489: Lane: a lane draws a change of its inputs and a resize at once, in the frame they happen, when its renderer is loaded and its samples are at hand: a zoom shows the waveform or the spectrogram at the new width with the lane, never a frame late. `visibleClipsNow` gives the clips in view when every recording hands its samples at once; a lane waits only for what it does not hold yet. The waveform lane sets `data-detail` on its canvas (`columns`, or `line` once a sample is wider than a pixel). A lane reads each recording once and keeps it (`SampleCache`, `readOnce`), since a reader may copy or mix the whole recording each time it is asked: before, a lane read it again at every paint.

## 0.2.0

### Minor Changes

- 224e119: Waveform: a recording with several channels is drawn a row each once the rows are tall enough to read, as a DAW draws it, and as one waveform below that: `layout` is `auto`, `split` or `mix`, a clip gives its `channels`, and `splitsChannels` and `waveformRows` tell the layout for a lane height.

## 0.1.0

### Minor Changes

- 964575b: A new package, `@audio-ui/gl`: audio drawn on the GPU with no UI framework in it. `lane` places a canvas on what a timeline's view shows and gives the clips in it, `waveform` draws a lane's clips as waveforms on one WebGL context (exact peaks with the RMS inside, a line through the samples zoomed in, plain or by band), and `spectrogram` draws them as spectrograms on one of four frequency axes, with the band zoom, the pointer's cell and the frequency axis laid out for a lane, over `gl-waveform` and `gl-spectrogram`.
