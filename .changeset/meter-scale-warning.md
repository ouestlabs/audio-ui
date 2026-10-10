---
"@audio-ui/react": minor
---

Meter: a scale and a warning zone. `Meter.Mark` places a graduation at a level along the meter's length (upward for a vertical meter, rightward for a horizontal one), to hold a tick and a label such as -18. `warnThreshold` marks the channels between that level and the clip threshold with `data-warning`, for the amber of a level that is getting hot. A live clip now stays lit as `data-clipped` until a click on the meter clears it.
