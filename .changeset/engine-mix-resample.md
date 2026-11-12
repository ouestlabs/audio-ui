---
"@audio-ui/engine": minor
---

Files: `mixChannels(channels, layout)` mixes a sound to mono, stereo, 5.1 or 7.1, folding the centre and the surrounds into the sides at -3 dB on the way down and spreading the sides to the surrounds on the way up, and `resampleChannels(channels, from, to)` converts every channel to another sample rate. `CHANNEL_LAYOUTS` and `LAYOUT_CHANNELS` name the layouts and their channel counts.
