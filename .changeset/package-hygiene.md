---
"@audio-ui/react": patch
---

- Ship with zero runtime dependencies: the few helpers previously pulled from `@audio-ui/utils` (declared as `"latest"`, so installs were not reproducible) are now bundled.
- Fix `Knob` ignoring its documented default: without `defaultValue`, it now starts at, and double-tap resets to, the midpoint of `min…max` instead of `0`.
- Set `touch-action: none` on the drag surfaces of `Knob`, `Fader`, `XYPad`, `Sequencer` and `Envelope` points, so touch drags no longer scroll the page when the primitives are used without the registry styles.
