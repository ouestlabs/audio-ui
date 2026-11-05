---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Timeline: `Navigator` takes `minWindowWidth`, the least width its window is drawn at, so its handles stay apart and inside the bar at any zoom. A drag follows the window as drawn, and an edge stops with the zoom at `maxZoom` instead of sliding the window on.
