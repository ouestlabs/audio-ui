---
"@audio-ui/react": patch
---

Stabilize the `transform` callback passed to `useControlledValue` in `Fader`, `Knob`, `Transport`, and `XYPad` so it no longer gets a new reference every render — previously this silently invalidated the entire memoized callback chain (`setRawValue` → `updateValue`/`commitValue` → context value) on any incidental re-render, forcing every subcomponent to re-render even when nothing changed.

Split `Fader`, `Transport`, and `XYPad` context into a config context (rarely changes: `disabled`, `orientation`, refs, callbacks) and a value context (changes every drag frame: `value`, `percentage`), so purely structural consumers (`Track`, `Slider`, `ThumbInner`, `ThumbMark`) stop re-rendering on every pointermove.

Memoize `Knob`'s resolved drag config instead of rebuilding it on every render, and drop two `useMemo` calls in `usePointerDrag`/`useWheel` that were memoizing cheaper-than-the-memoization boolean checks.
