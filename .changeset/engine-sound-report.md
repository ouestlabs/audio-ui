---
"@audio-ui/engine": minor
---

Analysis: `reportSound` reads a sound once into its loudness, likeliest key, tempo and ACX verdict, and `checkAcx` tells whether it meets ACX's audiobook requirements: RMS between -23 and -18 dBFS, peak at most -3 dBFS, noise floor at most -60 dBFS on its quietest pause.
