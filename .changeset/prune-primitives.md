---
"@audio-ui/react": minor
---

Prune the public API down to audio primitives. **Breaking (pre-1.0):**

- Remove the `ChannelStrip` primitive. It was layout only (`section`/`header`/`div`/`footer` with no behavior) and now lives in the styled registry layer as plain markup. Faders and meters no longer inherit `orientation` from an enclosing strip, pass `orientation` explicitly.
- Remove the `Transport` primitive. It duplicated `Fader`; build a seek bar with `Fader` (`orientation="horizontal"`, `min`/`max` in your time unit) rendering any buffered range as your own element inside `Fader.Track`.
- Stop exporting the generic hooks (`usePointerDrag`, `useWheel`, `useKeyboardNavigation`, `useFocus`, `useControlledValue`, `useValueAsRef`, `useCallbackRef`). They are internal implementation details, not audio primitives.
