---
"@audio-ui/react": patch
---

`Meter`'s parts are the package's own: `Meter.Channel` is the `role="meter"` with its `aria-valuenow`, `aria-valuetext` and `aria-labelledby`, `Meter.Label` names the channel it sits in, `Meter.Track`, `Meter.Indicator` and `Meter.Value` render as before. Their props and state types are now defined here. A `render` function on `Meter.Channel` and `Meter.Indicator` receives the channel's state (`clipping`, `warning`, `orientation`, `index`).
