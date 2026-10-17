---
"@audio-ui/core": minor
---

Time: warp markers, which pin a time in a recording to a time on the clip it plays in. `warpedTime` and `unwarpedTime` map a time either way, the recording stretched evenly between two markers and keeping the speed of the stretch next to them past the ends; `warpRate` is how fast the recording plays at a time on the clip (by speed alone, also how far its pitch moves). `addWarpMarker`, `moveWarpMarker` (stretching both sides, short of its neighbours), `removeWarpMarker` (two stay) and `scaleWarp` edit a map, and `warpMarkers` keeps the markers that make one. Exports the `WarpMarker` type.
