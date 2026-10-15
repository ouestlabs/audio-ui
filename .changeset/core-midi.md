---
"@audio-ui/core": minor
---

New `@audio-ui/core/midi` entry: MIDI with no framework in it. `parseMidiMessage` reads note on and off, control change and pitch bend with their channel and values from 0 to 1 (pitch bend from -1 to 1, both ends reached); `parseMidiFile` reads a Standard MIDI File into notes with their track, tempos and time signatures, and `encodeMidiFile` writes one; `createMidiInput` listens to the Web MIDI inputs of the page as one source. A file that is truncated, malformed or counts time in SMPTE frames raises a `MidiFileError` that says what is wrong. The folders of the package now tell the two kinds of module apart: `primitives/` holds the logic of the interface primitives and `audio/` the audio logic with no interface (`pitch`, `midi`).
