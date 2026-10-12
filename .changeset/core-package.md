---
"@audio-ui/core": minor
---

A new package with the logic of audio/ui's primitives and no UI framework in it: values on a grid (`clamp`, `roundToStep`), linear and logarithmic scales, range geometry, the change and commit event details every control reports, live sources a view follows outside its render cycle (`createSource`), stores, and the browser helpers the controls share (frame scheduling, pointer release, visibility). Each primitive's own logic has a subpath, `@audio-ui/core/timeline` (clip operations, snapping, zoom), `@audio-ui/core/waveform` (peaks, bar layout, levels), `@audio-ui/core/envelope`, `/knob`, `/fader`, `/meter`, `/piano`, `/piano-roll`, `/plot`, `/sequencer` and `/xypad`. `@audio-ui/react` is built on it, and an adapter for another framework can be too.
