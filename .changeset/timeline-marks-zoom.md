---
"@audio-ui/react": patch
---

Timeline: a mark that does not move is not drawn again at each step of a zoom, which moves it by itself through the lane's unit. A long timeline zoomed in with thousands of marks stays smooth.
