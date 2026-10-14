---
"@audio-ui/react": patch
---

Timeline: the viewport measures in layout px inside a scaled ancestor, such as a dialog that zooms in. The fitted zoom and the lanes' origin were taken from the drawn size, so the navigator's window showed a stretch that did not match the view until the next resize.
