# @audio-ui/core

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
