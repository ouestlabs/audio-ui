---
"@audio-ui/core": patch
"@audio-ui/react": patch
---

Envelope: a negative `curve` is now the mirror image of the positive one, `1 - (1 - t) ** power`, instead of the inverse power `t ** (1 / power)`. A curve of -1 used to turn vertical at the start of its segment and show as a wall with a sharp elbow; it now rushes the start with a finite slope, like +1 does at the end. A positive curve, a straight line and the drag on a segment's handle are unchanged, and the handle still lands the midpoint where it is dragged.
