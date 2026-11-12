---
"@audio-ui/engine": minor
---

Format: a new `@audio-ui/engine/format` module writes audio quantities as text the way the standards and the tools do: levels (dBFS, dBTP, LUFS, gain), frequencies and sample rates, times, notes, pans, ratios, tempos and channel layouts. Every function takes the same options (decimals, locale, true minus, spacing, sign, unit), and `createFormatter` binds a set of defaults once.
