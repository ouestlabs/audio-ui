---
"@audio-ui/react": minor
---

Sequencer: each step has a velocity, from 0 to 1. `Sequencer.Velocity` is a bar per step to put in a row under the cells: pressing it sets the velocity where the pointer is, dragging draws across the row, Alt + click or Delete returns the step to full, and a native range input inside takes the arrow keys, Page Up/Down and Home/End. `Root` takes `velocities` / `defaultVelocities` (a row per sound, like `value`; a step not listed plays at full) and reports `onVelocityChange` / `onVelocityCommitted` with `reason: "drag" | "keyboard" | "input-change" | "reset"`. The pattern itself is unchanged.
