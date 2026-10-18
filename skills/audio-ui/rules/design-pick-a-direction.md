---
title: Pick a visual direction first
impact: HIGH
impactDescription: one coherent look instead of a mix of styles
tags: design, direction, skin, headless
---

## Pick a visual direction first

The primitives of `@audio-ui/react` draw nothing, so the look is yours to decide, and an agent that starts writing CSS without deciding produces a little of everything: a gradient here, a glass card there, a neon accent. Choose one direction, say it in a sentence, then style every part from it.

Fourteen are ready to use (copy `styles/base.css` and one skin; the table of `design.md` maps a request to each): retro, tape, synth70, tube, blackface, solidstate and console for hardware, plugin for a glossy software window, minimal, modern and phosphor for flat tools, brutalist, y2k and hifi for a strong character. Take the one the user names. When they name none, pick from the product: a synth, drum machine or compressor is hardware, a tool or a player is minimal, a dense workstation is modern.

**Incorrect (no direction, a bit of every trend):**

```css
.knob-thumb {
  background: linear-gradient(135deg, #8b5cf6, #06b6d4);
  box-shadow: 0 0 24px #8b5cf6;
  backdrop-filter: blur(12px);
  border-radius: 50%;
}
```

**Correct (one direction, one set of materials and one accent):**

```tsx
// Direction: retro hardware. Matte enamel panel, machined metal caps, amber lamp.
<section className="panel skin-retro">
  <Knob.Root aria-label="Drive" className="knob" defaultValue={62}>
    ...
  </Knob.Root>
</section>
```
