---
"@audio-ui/react": minor
---

Remove the `Waveform.Path` and `Waveform.Progress` parts (and their `PathProps`/`ProgressProps` types). **Breaking (pre-1.0):** the Waveform primitive now renders only as bars, via `Waveform.Bars`/`Waveform.BarsProgress`. The SVG line-render parts had no consumers, were undocumented, and their path generator was already dropped in the bar-chart rework — so the interface now matches what the library actually ships. Consumers who still want a continuous line can compose a raw `<path>` inside `Waveform.Svg`.
