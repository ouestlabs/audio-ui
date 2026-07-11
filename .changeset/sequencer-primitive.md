---
"@audio-ui/react": minor
---

Add the Sequencer primitive: a boolean matrix (`boolean[][]`) grid of buttons painted with a single drag (the first touched cell's inverse state is painted across every cell the drag crosses, matching hardware step sequencers). Compound parts (`Root`, `Track`, `Cells`, `Cell`) follow the WAI-ARIA grid pattern with 2D roving-tabindex keyboard navigation (arrow keys move focus, Space/Enter toggles). The primitive is display/interaction only — an optional controlled `activeStep` prop highlights the playing column, with timing left to the consumer (a registry hook, Tone.js, or any other clock).
