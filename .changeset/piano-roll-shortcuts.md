---
"@audio-ui/react": minor
---

PianoRoll: editing commands from the keyboard, on the grid or on a note. Cmd/Ctrl+D repeats the selection right after itself and selects the copies; Cmd/Ctrl+C, X and V copy, cut and paste at the playback position; Q snaps the starts of the selection to the grid (every note when nothing is selected). They report `edit: "duplicate" | "paste" | "quantize" | "remove"` with `reason: "keyboard"`.
