---
"@audio-ui/react": patch
---

Timeline and Waveform: a resize is handled on the next frame, not inside the ResizeObserver callback. `Timeline.Viewport` reports its new width, and `Waveform.Canvas` resizes and repaints its bitmap, before the frame is shown, so the browser no longer logs "ResizeObserver loop completed with undelivered notifications".
