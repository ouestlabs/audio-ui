---
"@audio-ui/react": minor
---

Add the Waveform primitive: a seekable waveform drawn on a canvas. `value` is the playback position, from `0` to `duration` (default `1`, a plain fraction; pass a length in seconds to work in seconds).

- Parts: `Root`, `Control` (the seekable surface; holds a native `<input type="range">`), `Canvas`, `Playhead`, `Thumb` and `Hover` (shown at the hovered position). Every part takes a `render` prop and state-aware `className`/`style`, and exposes `data-disabled` / `data-dragging`.
- `Canvas` draws `peaks` (0-1 amplitudes at any resolution) as fixed-width bars: as many as fit its real width, the loudest amplitude kept per bar, sharp at any pixel density, in a `mirror` or `bars` layout (`barWidth`, `barGap`, `barRadius`). Colors come from CSS (`--waveform-color`, `--waveform-progress-color`, plus `--waveform-bar-radius`), and it repaints only when the position, size, peaks or theme change.
- **Seek**: a press jumps to the pointer and a drag scrubs; arrow keys step by `step`, Page Up/Down and Shift + arrows by `largeStep`, Home/End jump to the bounds. `onValueChange(value, eventDetails)` / `onValueCommitted(value, eventDetails)` carry `eventDetails.reason` (`"press"`, `"drag"`, `"keyboard"`, `"input-change"`) and `eventDetails.cancel()`.
- **Live position**: pass a `source` (`{ getSnapshot, subscribe }`) and the waveform follows it straight in the DOM — playhead, canvas and input — without re-rendering React. While the pointer scrubs, neither the source nor a late controlled `value` pulls the position back.
- The position is exposed as the `--waveform-position` CSS variable, and announced as the played share unless `getAriaValueText` returns something else (e.g. a time).
