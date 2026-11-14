---
"@audio-ui/engine": minor
---

Device: a device declares what its engine lets a host watch beyond its input and its output, in `signals` (`gainReduction`, `bandGainReduction`, `modulator`, `wet`), and `describe()` lists them. An engine names the points of its graph it exposes in `taps` (`DeviceTaps`), such as its LFO's signal or its wet sound, for a host to listen to with a meter or a trace.

Analysis: `stereoCorrelation(left, right)` reads how alike two channels are, from -1 to 1, as a correlation meter does.
