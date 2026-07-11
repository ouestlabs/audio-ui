---
"@audio-ui/react": minor
---

Add the Piano primitive: a MIDI-range virtual keyboard (`startNote`/`endNote`) with `onNoteOn`/`onNoteOff` events and an optional controlled `activeNotes` overlay for lighting up notes from an external source (MIDI input, a sequencer) without a pointer press. Compound parts (`Root`, `Track`, `Keys`, `Key`, `KeyLabel`) compute classic piano key layout (white/black positioning, chromatic coloring from any starting note) internally. Pointer interaction supports glissando (dragging across keys retriggers each one) and true multi-touch polyphony (multiple simultaneous pointers each independently track their own held key). Keyboard support follows the same roving-tabindex pattern as the other grid-like primitives, with Enter/Space triggering a momentary tap.
