---
"@audio-ui/react": minor
---

Add the Waveform primitive: a seekable waveform track, inspired by [waveform-path](https://github.com/jerosoler/waveform-path) and [wave-audio-path-player](https://github.com/jerosoler/wave-audio-path-player). `value` is a plain bounded number (defaults to a 0-1 fraction, or pass e.g. a track's duration in seconds) — the same left-to-right drag model as `Fader` in its horizontal orientation.

Compound parts: `Root`, `Track`, `Svg`, `Path`, `Progress`, `Thumb`.

- **Seek**: click or drag anywhere on `Track` to jump to that position; drag `Thumb` directly to the same effect. Home/End jump to the bounds, arrow keys nudge by `step`, Page Up/Down jump by `step * 10`.
- **Shape-agnostic**: the primitive has no opinion on how the waveform's `d` path string was generated (real audio samples, a placeholder curve, anything) — pass it to `Path` (the full shape) and `Progress` (the same shape, clipped to reveal only the portion up to the current value, the two-path technique `wave-audio-path-player` uses for its progress fill).
- `Svg` is purely a rendering surface; interaction lives on the enclosing `Track` since SVG elements sit outside the `HTMLElement` hierarchy the shared pointer-drag hook targets.
