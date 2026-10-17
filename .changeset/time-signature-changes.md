---
"@audio-ui/core": minor
---

Time: signature changes along a song. `barsOf(tempo, changes, until)` lays out the bars from 0 through the changes, each with its number, start, length and signature, and marks a bar a change cuts short as `partial`; `barsBeatsWith(seconds, tempo, changes)` counts bars, beats and sixteenths through them; `isSignature` says whether a signature is one a bar can have (1 to 99 beats of a whole, half, quarter, eighth or sixteenth note). Exports the `Bar` and `SignatureChange` types.
