---
"@audio-ui/react": minor
---

Add the Piano primitive: a keyboard to play, from `minPitch` to `maxPitch` (MIDI pitches, C3 to C5 by default) or exactly the `pitches` given. Parts: `Root`, `Keys` (renders its children once per key), `Key` and `KeyLabel`.

- **Events:** `onNoteOn(pitch, eventDetails)` and `onNoteOff(pitch, eventDetails)`, with `reason` `"press"`, `"glide"` or `"keyboard"`. `eventDetails.cancel()` in `onNoteOn` keeps the key silent.
- **Pointer:** a key sounds while pressed; dragging across the keys glides from one to the next, and each pointer holds its own key, so chords can be played on a touch screen. `activeNotes` lights keys from elsewhere, such as a MIDI input.
- **Keyboard:** each key is a `<button>` named after its pitch ("C4"), behind one roving tab stop. The arrow keys walk the keys, an octave at a time with Shift or Page Up/Down, and Enter or Space holds the focused key until released.
- **Layout:** `layout="keyboard"` places the keys like a piano, black keys between the white ones; `layout="even"` gives each key the same share, the way a piano roll's rows are. `orientation="vertical"` puts the low end at the bottom. Keys expose `data-color`, `data-active` and `data-orientation`.

Also exported from `@audio-ui/react/piano`.
