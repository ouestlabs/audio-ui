---
"@audio-ui/core": minor
---

New `@audio-ui/core/time` entry: musical time with no framework in it. Tempo and time signature (`secondsPerQuarter`, `secondsPerBeat`, `secondsPerBar`, `barsBeatsAt`, and BPM to and from the microseconds per quarter note a MIDI file stores), `ticksToSeconds` and `secondsToTicks` through the tempo changes of a song (the `tempos` that `parseMidiFile` returns), the grid a timeline draws and snaps to (`gridInterval`, `gridLabel`, the metronome's rhythms), and the look-ahead scheduler (`advance`, `positionAt`) that commits steps to the audio clock. A tempo or a signature that cannot be one reads as an infinitely long quarter note or as 4/4 instead of dividing by zero, and the scheduler, which would never leave its loop for a spacing of zero or less, emits nothing for it. A stall of more than half a second is skipped, in whole steps and in time, rather than played as a burst of every step missed.
