# @audio-ui/core

## 0.6.0

### Minor Changes

- c851819: New `@audio-ui/core/device` entry: an effect or an instrument as a set of named parameters, with no interface and no audio in it, so a panel, an engine and an agent share one description. `defineDevice({ id, name, description, parameters })` takes a descriptor per parameter (a number with its range, step, scale and unit, a toggle, or a choice from a short list of options such as a waveform) and gives back the device's defaults, `set`, `sanitize` (a state loaded from a saved project, repaired), `clampValue`, `normalize` and `denormalize` along the parameter's scale, and `format` for a readout. `describe()` returns the device as JSON, and `apply(state, changes)` changes several parameters at once and says what happened to each: a value out of range is brought in and marked, and an unknown id or a value of the wrong type is refused by name instead of being replaced by a default. `deviceTools(device)` returns the tools that drive a device (`<id>_set` and `<id>_reset`) with a JSON Schema input, for any agent: they report in a sentence a model can read back and never throw on what it sends. The state is a plain object typed by the parameter ids, a choice holding the value of its option, and `deviceTools` gives a model the values it may send. A device that cannot work (a default outside its range, a log scale from zero, a duplicate id) throws a `DeviceDefinitionError` naming the parameter when it is defined. An instrument can describe the note it plays (`note`: a pitch in hertz, a filter cutoff, each with a range), and `deviceTools` then gives an agent a third tool, `<id>_play`, whose call returns the note to play and how long: values out of range are brought in, wrong ones refused by name, and a part left out takes its default. `InstrumentBinding` is what a host implements to play it (`noteOn`, `noteOff` next to `update` and `dispose`), and `playNote(instrument, note, seconds)` starts a note and lets it go when the time is up.

## 0.5.0

### Minor Changes

- 90d6c74: New `@audio-ui/core/analysis` entry: the maths behind a plot, a meter and a waveform, with no framework in it. Spectrum on a log frequency axis with peak hold (`logSpectrum`, `holdPeaks`), waveform peaks and bands (`computePeaks`, `downsampleWaveform`, `spectrumBands`), levels (`dbToGain`, `gainToDb`, `rmsDb`), the response of a biquad and of an equalizer (`biquadResponse`, `eqResponse`), and the transfer curve of a compressor. The curves are checked against the browser's own nodes: a filter's equals `BiquadFilterNode.getFrequencyResponse` to within 0.05 dB once the Q is passed to the node with `toWebAudioQ` (a low-pass and a high-pass take their Q in decibels, which differed by up to 7.7 dB, and a shelf ignores Q, which differed by up to 11 dB), and `webAudioCompressorOutput` draws the curve of `DynamicsCompressorNode`, with its one-sided knee and the make-up gain it adds on its own, where `compressorOutput` stays the textbook curve. `downsampleWaveform` covers every sample (it dropped the last ones when the length did not divide) and stretches a short input instead of padding it with silence. Input that is not a number gives silence or `NaN`-free output instead of a throw.

## 0.4.0

### Minor Changes

- b7c1fec: New `@audio-ui/core/time` entry: musical time with no framework in it. Tempo and time signature (`secondsPerQuarter`, `secondsPerBeat`, `secondsPerBar`, `barsBeatsAt`, and BPM to and from the microseconds per quarter note a MIDI file stores), `ticksToSeconds` and `secondsToTicks` through the tempo changes of a song (the `tempos` that `parseMidiFile` returns), the grid a timeline draws and snaps to (`gridInterval`, `gridLabel`, the metronome's rhythms), and the look-ahead scheduler (`advance`, `positionAt`) that commits steps to the audio clock. A tempo or a signature that cannot be one reads as an infinitely long quarter note or as 4/4 instead of dividing by zero, and the scheduler, which would never leave its loop for a spacing of zero or less, emits nothing for it. A stall of more than half a second is skipped, in whole steps and in time, rather than played as a burst of every step missed.

## 0.3.0

### Minor Changes

- 85fd7b8: New `@audio-ui/core/midi` entry: MIDI with no framework in it. `parseMidiMessage` reads note on and off, control change and pitch bend with their channel and values from 0 to 1 (pitch bend from -1 to 1, both ends reached); `parseMidiFile` reads a Standard MIDI File into notes with their track, tempos and time signatures, and `encodeMidiFile` writes one; `createMidiInput` listens to the Web MIDI inputs of the page as one source. A file that is truncated, malformed or counts time in SMPTE frames raises a `MidiFileError` that says what is wrong. The folders of the package now tell the two kinds of module apart: `primitives/` holds the logic of the interface primitives and `audio/` the audio logic with no interface (`pitch`, `midi`).
- 43f455f: New `@audio-ui/core/pitch` entry: the maths of pitch with no framework or Web Audio in it. `noteToFrequency` and `frequencyToNote` convert between MIDI notes and hertz (equal temperament, A4 at 440 Hz or the reference you pass, fractional notes for cents), `nearestNote` names the note nearest a frequency with its offset in cents, and `detectPitch` finds the fundamental of an array of samples, such as an analyser's time-domain data, with the YIN algorithm. `pitchName`, `isBlackKey` and the new `pitchClassName` come with it. Input that is not a number a note or a frequency can be (zero, negative, `NaN`) gives `NaN` or `null`, never a wrong note.

## 0.2.0

### Minor Changes

- aa6d721: Pad: a new primitive for drum pads, `Pad.Root` and `Pad.Item` from `@audio-ui/react/pad`, with its framework-free controller in `@audio-ui/core/pad`. Each pad sounds while held, by pointer or with Enter or Space, and reports `onPadOn(value, eventDetails)` with a velocity taken from the pointer's pressure, or else from how high on the pad it lands. Pads sharing a `chokeGroup` stop each other, `activePads` lights pads from elsewhere, and the pads are one tab stop walked with the arrow keys.

## 0.1.2

### Patch Changes

- 51da2fa: No code change. This version is published through npm trusted publishing, so it carries a provenance attestation that links the package to the commit and the workflow that built it.

## 0.1.1

### Patch Changes

- 3ad7d58: Knob: `createKnobController` applies the `scale` it is created with at once. It started linear until the first `setOptions`, so a logarithmic knob built outside React rested at, and drew, a linear position until its options were set again.

## 0.1.0

### Minor Changes

- a26539d: A new package with the framework-agnostic logic of audio/ui's primitives: values on a grid (`clamp`, `roundToStep`), linear and logarithmic scales, range geometry, the change and commit event details every control reports, live sources a view follows outside its render cycle (`createSource`), stores, and the browser helpers the controls share (frame scheduling, pointer release, visibility). Each primitive's own logic has a subpath, `@audio-ui/core/timeline` (clip operations, snapping, zoom), `@audio-ui/core/waveform` (peaks, bar layout, levels), `@audio-ui/core/envelope`, `/knob`, `/fader`, `/meter`, `/piano`, `/piano-roll`, `/plot`, `/sequencer` and `/xypad`.
  
  Each primitive's behavior is a controller with no view attached: `createKnobController`, `createFaderController`, `createXYPadController`, `createEnvelopeController`, `createPianoController`, `createPianoRollController`, `createSequencerController`, `createPlotHandleController`, `createWaveformController` and `createWaveformRegionController`, and for the timeline `createTimelineController`, `createClipController`, `createRangeController`, `createNavigatorController`, `createTrackController` and `createWheelZoom`. A view forwards its DOM events to the controller, which runs the gesture, the keys and the value, and reads the result through `getSnapshot` and `subscribe`. `@audio-ui/react` is built on these controllers, and a view in another framework, or in the DOM alone, can be too.
