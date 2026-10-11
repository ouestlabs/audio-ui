---
"@audio-ui/react": minor
---

Waveform: `Waveform.Control` selects a stretch when you drag with Shift held, reported as `[start, end]` through `onSelectionChange` / `onSelectionCommitted` (`reason: "drag"`), ready to feed a `Waveform.Region` as a loop or a selection. A plain press and drag still seek, and without the handler Shift changes nothing.
