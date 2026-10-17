---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Timeline: a seekable `Timeline.Lane` takes `onSelectionChange` and `onSelectionCommitted`, so a drag from its bare area selects a stretch of time instead of scrubbing, with the position left where the press put it. Core adds the time commands on a list of clips, re-exported by the React package: `copyRange` (what a stretch holds, from 0), `removeTime` (takes a stretch out and closes the gap) and `insertTime` (opens a gap, cutting the clip across it), and exports the `TimelineSelectionHandlers` type.
