---
"@audio-ui/core": minor
---

`@audio-ui/core/pitch` no longer converts between notes and frequencies: `noteToFrequency`, `frequencyToNote`, `nearestNote`, `Note` and `CONCERT_PITCH_HZ` are removed, so use `midiToHz`, `hzToMidi` and `cents` from `@audio/note`. Scales now come from `@audio/note`, a new dependency, which renames three of them: `pentatonic-major`, `pentatonic-minor` and `whole` replace `major-pentatonic`, `minor-pentatonic` and `whole-tone`. `lydian`, `phrygian` and `locrian` are kept. `detectPitch`, `pitchName` and `isBlackKey` are unchanged.
