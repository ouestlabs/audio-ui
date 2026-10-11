---
"@audio-ui/react": minor
---

Add the clip to Timeline: a stretch of a source (a recording, a pattern) laid on a lane, with the model an arrangement needs.

- **Clip** takes a `value` of `{ start, length, offset, fadeIn, fadeOut }` in the timeline's units, and `sourceLength`. Dragging its body moves it, on the grid unless Cmd/Ctrl is held; the change says which lane is under the pointer (`eventDetails.lane`, any element marked by `Timeline.Lane`), and a drop on another lane commits even when the position did not change. It follows the pointer vertically through `--clip-drag-y`, and sets `--clip-offset`, `--clip-source-length`, `--clip-fade-in` and `--clip-fade-out` so its content can show the stretch that is played. `selected` / `defaultSelected` / `onSelectedChange` hold the selection, and Delete or Backspace call `onRemove`. Its native `<input type="range">` moves it from the keyboard and carries the accessible name.
- **ClipHandle** trims one edge: trimming the start moves where in the source the clip begins and leaves its content where it is, trimming the end stops where the source or the timeline does.
- **ClipFadeHandle** sets how long a fade lasts, and **ClipFade** shades what it attenuates.
- Events carry `eventDetails.target` (`"move"`, `"trim-start"`, `"trim-end"`, `"fade-in"`, `"fade-out"`) and `reason` (`"drag"`, `"keyboard"`, `"input-change"`).
- The edits are plain functions too, for the model behind the clips: `moveClip`, `trimClipStart`, `trimClipEnd`, `setClipFadeIn`, `setClipFadeOut`, `splitClip`, `duplicateClip` and `clipEnd`, exported from `@audio-ui/react` and `@audio-ui/react/timeline`.
