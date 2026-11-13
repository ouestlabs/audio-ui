---
"@audio-ui/gl": minor
---

Lane: a recording streamed from a file is drawn without being read whole. `LaneSamples.leaves` gives the recording summed up 256 frames at a time (`waveformLeaves`, `leavesPeak`): a waveform lane draws from them zoomed out, and past a leaf a device pixel reads only the frames it shows, a chunk of `CHUNK_FRAMES` at a time (`feedChunks`), letting go of the oldest. A spectrogram lane does the same from the recording's `spectra` (`LaneSamples.spectra`, made once by `spectrogramSpectra` of `@audio-ui/engine/analysis`), reading the frames it shows once a column of the view is narrower than one of theirs. Stretches of a clip that read as one line within a quarter of a pixel are drawn as one part (`joinParts`), so a warped clip zoomed out draws a part or two, not one per marker. `readKept` and `partsInView` are exported for lanes over other renderers.
