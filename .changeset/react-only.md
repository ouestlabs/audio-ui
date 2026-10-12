---
"@audio-ui/react": minor
---

The package depends on React alone: `@base-ui/react` is no longer a peer dependency, and an app that installed it only for audio/ui can remove it.

`Fader`'s parts are now the package's own. They behave as before (a press on the track jumps to the value under it, a press on the thumb drags it from where it was taken, the arrow, Page, Home and End keys and Shift move it through a native `<input type="range">`, the wheel steps it, a double click, Alt + click or Delete returns to the default) and keep their data attributes (`data-orientation`, `data-disabled`, `data-dragging`). What changes is in the types: `Fader.Root.Props`, `Fader.Root.State` and the event details are defined here, with `format`, `locale`, `largeStep` and `name` on `Fader.Root`, and `getAriaValueText` and `inputRef` on `Fader.Thumb`. `Fader.Root.State` is `{ disabled, dragging, orientation, value }`. A `Fader` costs about 5 KB gzipped where it cost about 19 KB with the slider it used to build on.
