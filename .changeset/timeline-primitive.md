---
"@audio-ui/react": minor
---

Add the Timeline primitive: the ground an arrangement, a clip editor or a piano roll is drawn on. Units are the consumer's (seconds, beats, pulses, steps); the primitive has no notion of tempo.

- **Root** owns the length (`duration`), the zoom (`zoom` / `defaultZoom` in px per unit, clamped to `minZoom`…`maxZoom`, `onZoomChange`), the grid (`snapStep`, `snapOffset`) and the playback position (`position` / `defaultPosition`, or a live `source` followed outside React; `onPositionChange` / `onPositionCommitted`). Without a zoom it fits the width it is given.
- **Viewport** is the scrolling window. Cmd/Ctrl + wheel (and trackpad pinch) zooms around the pointer, and whatever changes the zoom, the anchored point stays where it was, or the middle of the view.
- **Lane** is a strip parts are placed on, as long as the timeline when zoomed. It sets `--timeline-unit`, the width of one unit, so anything placed with it follows the zoom.
- **Ruler** seeks: a press jumps to the pointer and a drag scrubs, on the grid unless Cmd/Ctrl is held, four times finer with Shift. It holds a native `<input type="range">` for focus, the keyboard and the accessible name, announced through `getAriaValueText`.
- **Range** is a stretch of the timeline (`[start, end]`): a loop, a selection, a clip. Dragging its body moves it and a **RangeHandle** per edge resizes it, both on the grid unless Cmd/Ctrl is held and never shorter than `minLength`; with `drawable`, dragging across empty lane draws a new one. The range and each handle hold a native `<input type="range">`, so all of it works from the keyboard. Events carry `eventDetails.edge` and `reason` (`"drag"`, `"draw"`, `"keyboard"`, `"input-change"`).
- **Mark** places something at a value; **Playhead** follows the position through its own `--timeline-offset` variable, without re-rendering React.

Also exported from `@audio-ui/react/timeline`.
