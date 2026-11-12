---
"@audio-ui/elements": patch
---

Timeline: a `<audio-ui-timeline-navigator-handle>` keeps its `edge` attribute, so a handle set up by a framework after the element exists, as React and Vue do, is the end handle and not the start one. Only the accessible names move to the handle's input.
