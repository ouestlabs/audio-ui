---
"@audio-ui/react": minor
---

Meter: a scale and a warning zone. `Meter.Mark` places a graduation at a level along the meter's length (upward for a vertical meter, rightward for a horizontal one), to hold a tick and a label such as -18. `warnThreshold` marks the channels between that level and the clip threshold with `data-warning`, for the amber of a level that is getting hot. A live clip now stays lit as `data-clipped` until a click on the meter clears it.

`scale` spreads the levels along the length: `"linear"` (the default) or `"iec"`, the deflection of a digital peak meter, with more room at the top, where the registry element starts. A function gives your own curve. Marks and the indicator follow the same curve.
