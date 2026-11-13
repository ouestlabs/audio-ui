---
"@audio-ui/engine": minor
---

Analysis: `splitBands` mixes a sound to one channel and splits it in lows, mids and highs by a Linkwitz-Riley crossover (`@audio/eq-crossover`) at 250 Hz and 2.5 kHz, bands that add back to the mix, to draw each as a waveform of its own and colour a sound by its frequencies.
