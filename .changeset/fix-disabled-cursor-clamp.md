---
"@audio-ui/react": patch
---

Fix `disabled` cursor feedback on Fader, Knob, and XYPad: `Root` now exposes `data-disabled` so the styled registry layer can put `cursor-not-allowed` on a wrapper that stays hoverable, instead of on the same `pointer-events-none` surface where it could never actually resolve.
