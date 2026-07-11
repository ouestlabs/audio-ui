---
"@audio-ui/react": minor
---

Add the Meter primitive: a display-only stereo/multi-channel decibel meter. `value: number[]` (one dB reading per channel) drives the fill; an optional `peak: number[]` positions a peak-hold mark. Compound parts (`Root`, `Channels`, `Channel`, `Fill`, `Peak`, `ValueDisplay`) follow the WAI-ARIA `meter` pattern — no pointer, keyboard, or focus handling, since there is nothing to control. The primitive has no internal clock or Web Audio dependency; sampling and peak-hold decay are the consumer's choice (a registry hook, or any other source).
