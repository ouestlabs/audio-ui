---
"@audio-ui/core": minor
---

Device: a device can say how long it delays the sound, and a binding can be given the tempo. `defineDevice` takes an optional `latency(state, sampleRate)` in seconds, and the device returns it as `device.latency(state, sampleRate)` (0 when it declares none, never negative), so a host that compensates latency can be told. `DeviceBinding.update(state, context?)` takes an optional `DeviceContext` with the host's `tempo`, for a time parameter that follows it. `@audio-ui/core/time` gains `SYNCED_DIVISIONS`, the note values such a parameter can take (`1/16`, a triplet `1/8t`, a dotted `1/8d`, from 1/32 to a whole note), and `syncedSeconds(division, tempo)`, how long one lasts at a tempo.
