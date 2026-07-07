---
"@audio-ui/react": patch
---

Memoize Fader/Transport/XYPad context values to avoid re-rendering all subcomponents on every drag frame, stop Knob's `indicatorSpan` from rebuilding a new array on every render, switch internal hook imports to direct paths instead of barrel files, and fix a possibly-undefined ref access in `Knob.Slider`.
