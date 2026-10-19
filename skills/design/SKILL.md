---
name: design
description: "Designs how an audio interface looks with audio/ui: picks a visual direction (retro hardware, skeuomorphic, minimalist, modern, and skins such as tape, phosphor, hifi, brutalist, y2k, console, synth70), ships ready CSS skins and the verified Panel markup for the headless @audio-ui/react primitives, and composes a look from a brief or a reference with materials, palettes, lighting and typography. Use when the user wants a synth, mixer, plugin, drum machine or DAW panel to look like hardware or like a named style, asks for retro, analog, skeuomorphic, minimal or modern audio UI, has no shadcn or Tailwind and needs the primitives styled, or when a panel looks flat, generic or AI-made and needs to read as an instrument."
license: MIT
metadata:
  author: audio/ui
  version: "1.2.0"
---

# Designing audio interfaces with audio/ui

`@audio-ui/react` primitives are headless: they bring behavior, input and ARIA, and no look. This skill gives them one. Choose a direction first and say it in a sentence, then style every part from it; mixing three looks is what makes a panel read as a template.

## When to Apply

- A synth, mixer, plugin, sampler or drum machine panel that should look like hardware, or like a named style
- Retro, skeuomorphic, minimalist or modern directions, with or without shadcn/ui or Tailwind
- Styling `@audio-ui/react` primitives from scratch with a ready skin
- A look the skins do not cover, or a reference the user names
- Reviewing a panel that looks flat, generic or uneven

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Design | HIGH | `design-` |

## Quick Reference

### 1. Design (HIGH)

- `design-pick-a-direction` - Choose retro, minimal or modern first, say it, and style every part from it
- `design-structure-before-skin` - Start from `styles/base.css`: every part needs a size, and the inline position is the part's
- `design-one-light-source` - One light, four or five materials, glow only on lamps
- `design-print-the-labels` - Uppercase tracked labels, tabular values, printed ticks
- `design-size-by-importance` - Group by signal flow in labelled sections, three sizes at most
- `design-feedback-by-state` - Draw `data-dragging`, `data-active`, `data-clipping` and focus, not only hover
- `design-meter-zones` - Zones on the channel, dimmed, lit by the indicator: a gradient on the indicator squeezes with the level

## Workflow

1. **Choose a visual direction** and say it in one sentence: retro hardware, minimal or modern ([design.md](./design.md)).
2. **Copy `styles/base.css`**, one skin and the `Panel` markup from [directions.md](./directions.md). Every part needs a size, and the inline position is the part's.
3. **For a look the skins do not cover**, or any reference the user names, compose it from `styles/materials.css` with [taste.md](./taste.md). For retro, read [hardware.md](./hardware.md): what gives a panel taste, palettes by instrument.
4. **Group by signal flow** in labelled sections, with three sizes at most, and draw state (`data-dragging`, `data-active`, focus), not only hover.
5. **Verify.** Render the page and look at a screenshot; check the panel at the size it ships.

Outside React the same skins apply, with `styles/dom.css` and the plain DOM kit of the `core` skill. Choosing, installing and wiring the components: the `audio-ui` skill.

## How to Use

Read the rule files for the explanation and the incorrect and correct code:

```
rules/design-pick-a-direction.md
rules/design-one-light-source.md
```

- [design.md](./design.md): choosing a direction, what every direction shares, the part gotchas
- [directions.md](./directions.md): retro, minimal and modern skins to copy (`styles/`), with the verified markup
- [taste.md](./taste.md): composing any direction from a brief, with a vocabulary of looks and the slop signals to avoid
- [hardware.md](./hardware.md): what gives a retro panel taste, palettes by instrument
- Full docs: https://www.audio-ui.dev/llms.txt

## Full Compiled Document

Every rule of this skill expanded in one file: [AGENTS.md](./AGENTS.md)
