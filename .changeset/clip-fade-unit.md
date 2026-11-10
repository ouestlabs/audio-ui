---
"@audio-ui/react": patch
---

Timeline: `ClipFade` and `ClipFadeHandle` are positioned correctly when the timeline fits its width. They were sized from `--timeline-unit`, which is a percentage of the lane when no zoom is set and resolved against the clip inside it; the clip now sets `--clip-unit`, the width of one unit for its own parts.
