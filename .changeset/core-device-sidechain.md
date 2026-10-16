---
"@audio-ui/core": minor
---

Device: a device can say it takes a key signal besides the one it processes (a compressor ducked by a kick, a gate opened by a snare). `defineDevice({ sidechain: true })` sets `device.sidechain` and puts `sidechain: true` in `describe()`, so a host knows to route a signal to its engine and an agent can be told. The key is a signal, not a parameter: it is not in the state and the tools do not carry it. `SidechainBinding<State, Input>` is the shape of such an engine, a `DeviceBinding` with a `sidechain` input to connect the key to.
