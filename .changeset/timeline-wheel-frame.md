---
"@audio-ui/react": patch
---

`Timeline.Viewport` adds up the wheel events that arrive within one frame and zooms once, so a trackpad sending several per frame no longer lays the timeline out several times; `Timeline.Lane` is laid out and styled apart from the rest of the page (`contain`), which makes each zoom step cheaper.
