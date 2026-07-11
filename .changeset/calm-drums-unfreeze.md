---
"@audio-ui/react": patch
---

Fix the seek bar freezing after a click in the track (or a drag released at the edge): `usePointerDrag` captured the pointer on `elementRef` — for Transport/Fader's Track that is the parent Slider node, so the browser retargeted the following pointermove/pointerup events away from the Track's handlers and the drag never ended, leaving `freezeValuesWhileDragging`'s optimistic value latched. Pointer capture now always targets the element carrying the handlers. Track drags also update live mid-gesture now, and the outside-click commit performs a full drag teardown so a frozen display can't stick through that path either.
