---
"@audio-ui/core": minor
---

Device: `DeviceBinding` takes an optional `readings()`, which says what a device is taking off the signal right now, in dB, 0 or negative: `gainReductionDb` for a device with one gain, and `bandGainReductionDb` for a device with one per band. It is additive: a binding without `readings()` is unchanged, so a host can draw one meter for every device that reports.
