---
"@audio-ui/react": patch
---

Extract the internal `useParameter` hook: Fader, Transport, and Knob now share one implementation of value clamping/stepping, commit semantics, keyboard navigation, wheel handling, and the drag lifecycle. No public API changes. Fixes inherited by the unification: Fader now guards against zero-sized track rects (previously a division by zero), Fader's thumb position is guarded when `max === min`, and Transport gains the outside-click commit that previously existed only in Fader.
