---
"@audio-ui/react": minor
---

Timeline: `Timeline.Ruler` selects a stretch when you drag with Shift held, reported as `[start, end]` through `onSelectionChange` / `onSelectionCommitted` (`reason: "drag"`), on the grid unless Cmd/Ctrl is held. Feed it to a `Timeline.Range` as a loop. A plain press and drag still move the position, and without the handler Shift changes nothing.
