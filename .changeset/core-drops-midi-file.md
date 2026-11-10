---
"@audio-ui/core": minor
---

Removes `parseMidiFile`, `encodeMidiFile`, `MidiFileError` and their types from `@audio-ui/core/midi`, and `ticksToSeconds`, `secondsToTicks` and `TempoChange` from `@audio-ui/core/time`. Reading and writing Standard MIDI Files is the job of `@audio/midi-parse` and `@audio/midi-write`; the `midi-file` registry item now wraps them for the grid of steps. `parseMidiMessage` and `createMidiInput` are unchanged.
