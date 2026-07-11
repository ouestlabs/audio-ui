---
"@audio-ui/react": patch
---

Extract a value-shape-generic `useParameterCore` behind the internal `useParameter` hook and migrate XYPad onto it — all four primitives (Fader, Transport, Knob, XYPad) now share one parameter lifecycle. No public API changes. Fixes inherited by XYPad: zero-sized rect guards on drag geometry (previously division by zero) and clamped/guarded position percentages.
