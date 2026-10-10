---
"@audio-ui/react": minor
---

Envelope: bend the segments, and drag with finer control.

- **Curved segments:** a point takes an optional `curve`, from -1 to 1, that bends the segment leaving it; 0 or unset keeps it straight. A positive curve holds the start of the segment and rushes its end, a negative one the opposite. `Envelope.Line` and `Envelope.Fill` draw the bend.
- **`Envelope.Segments` / `Envelope.Segment`:** a handle on each segment's midpoint. Dragging it up or down bends the segment so its midpoint follows the pointer; the arrow keys bend it, and a double click or Delete straightens it. It is a slider on the curve, and carries `data-flat` when the two points are at the same level and there is nothing to bend. A moved point keeps its segment's curve.
- **Events:** `onValueChange` and `onValueCommitted` report bends with `reason: "curve"`.
- **Fine drag:** holding Shift while dragging a point moves it a quarter of the pointer's distance, without a jump when Shift is pressed or released.
- **Types:** `Envelope.Breakpoint` is `{ x, y, curve? }`, the type of the value.
- **Grid:** `snap` takes the distance between grid lines in normalized units; the pointer snaps dragged and added points to it, and Cmd/Ctrl leaves the grid.
- **Adding on a curve:** a point added inside a bent segment sits on the curve, and both halves are bent to follow it, so the shape is kept.
- **Tab stops:** the segment handles are one tab stop; Left and Right move between them.
- **Alt gestures:** as in a DAW's automation lane, Alt + drag on a segment bends it (reason `"curve"`), Alt + double click straightens it, and Alt + click on a point removes it. They sit beside the segment handles, which stay for touch and keyboard.
- **Lost release:** a drag now ends when its button was released where the page could not see it, outside the window or over a menu.
