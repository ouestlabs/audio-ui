---
"@audio-ui/core": minor
"@audio-ui/react": minor
---

Timeline: `snapPoints` on the root pulls a dragged clip or range onto places such as the edges of other clips and the locators, from a few px away and ahead of the grid (Cmd/Ctrl lets go of them too); a moved clip or range lands either of its edges on one. A range's own input now moves it by its own length with Up and Down, and with Cmd/Ctrl, Left and Right shorten or lengthen it by a step while Up and Down double or halve it. Up and Down used to move it by a step, like Left and Right. Core adds `nearestSnapPoint`, `snapSpanMove`, `withSnapRadius`, `withoutSnapPoints` and `SNAP_RADIUS_PX` to the timeline module, and `adjacentDivision` and `divisionAt` to the time module, to step a fixed grid finer or coarser and to fix an adaptive grid where it is.
