---
"@audio-ui/core": patch
---

Knob: `createKnobController` applies the `scale` it is created with at once. It started linear until the first `setOptions`, so a logarithmic knob built outside React rested at, and drew, a linear position until its options were set again.
