---
"@audio-ui/core": minor
---

New `@audio-ui/core/pitch` entry: the maths of pitch with no framework or Web Audio in it. `noteToFrequency` and `frequencyToNote` convert between MIDI notes and hertz (equal temperament, A4 at 440 Hz or the reference you pass, fractional notes for cents), `nearestNote` names the note nearest a frequency with its offset in cents, and `detectPitch` finds the fundamental of an array of samples, such as an analyser's time-domain data, with the YIN algorithm. `pitchName`, `isBlackKey` and the new `pitchClassName` come with it. Input that is not a number a note or a frequency can be (zero, negative, `NaN`) gives `NaN` or `null`, never a wrong note.
