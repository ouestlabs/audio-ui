---
"@audio-ui/core": patch
"@audio-ui/react": patch
---

Plot and Envelope: a curve is now drawn with extra vertices where it bends tighter than its sampling grid shows, so a corner, a knee or a steep elbow follows the function instead of showing as a facet, and a straight stretch keeps none it does not need. `Plot.Curve`'s `samples` is the grid it starts from, and a bent Envelope segment starts from its usual 24 samples. The path stays within about a tenth of a pixel of the function and is capped at a few thousand vertices.
