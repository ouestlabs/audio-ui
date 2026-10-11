---
"@audio-ui/react": minor
---

Add the clip to Timeline: a stretch of a source (a recording, a pattern) laid on a lane, with the model an arrangement needs.

- **Clip** takes a `value` of `{ start, length, offset, fadeIn, fadeOut }` in the timeline's units, and `sourceLength`. Dragging its **ClipHeader**, the title bar, moves it, on the grid unless Cmd/Ctrl is held; a press on the body selects it and puts the cursor there instead, and a drag scrubs. The change says which lane is under the pointer (`eventDetails.lane`, any element marked by `Timeline.Lane`), and a drop on another lane commits even when the position did not change. It follows the pointer vertically through `--clip-drag-y`, and sets `--clip-offset`, `--clip-source-length`, `--clip-fade-in` and `--clip-fade-out` so its content can show the stretch that is played. `selected` / `defaultSelected` / `onSelectedChange` hold the selection, and Delete or Backspace call `onRemove`. Its native `<input type="range">` moves it from the keyboard and carries the accessible name.
- **ClipHandle** trims one edge: trimming the start moves where in the source the clip begins and leaves its content where it is, trimming the end stops where the source or the timeline does.
- **ClipFadeHandle** sets how long a fade lasts.
- **ClipFade** draws a fade as the DAWs do (the ramp as a line, what it attenuates lightly shaded). `fadeInShape` / `fadeOutShape` (`"linear"`, `"fast"`, `"slow"`, `"smooth"`) set its curve; a fade handle steps through them on a double-click or Enter, and `fadeGain`, `nextFadeShape`, `setClipFadeShape` and `FADE_SHAPES` are exported.
- A move whose drag began with Alt held has `eventDetails.copy`, for the app to add the dragged clip as a copy.
- **Lane** takes `seekable`: a press on its bare area moves the position and a drag scrubs it, on the grid unless Cmd/Ctrl is held, so the cursor can be put anywhere along a track. Presses on the parts in the lane go to those parts.
- `coverClips` lays a clip on a lane the way a DAW does: it covers what was under it, so a clip it lies over goes, one it overlaps by an edge is trimmed (its content staying in place), and one it lies inside is cut in two around it.
- `adjacentPoint(points, from, direction)` finds the next or previous point (a locator, a cue) from a position, for jumping between them.
- Events carry `eventDetails.target` (`"move"`, `"trim-start"`, `"trim-end"`, `"fade-in"`, `"fade-out"`) and `reason` (`"drag"`, `"keyboard"`, `"input-change"`).
- The edits are plain functions too, for the model behind the clips: `moveClip`, `trimClipStart`, `trimClipEnd`, `setClipFadeIn`, `setClipFadeOut`, `splitClip`, `duplicateClip` and `clipEnd`, exported from `@audio-ui/react` and `@audio-ui/react/timeline`.
