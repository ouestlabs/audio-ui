# Designing the interface

`@audio-ui/react` is headless: it draws nothing. Whatever the project uses (Tailwind, CSS modules, plain CSS, no shadcn at all), the look is written by you. This is the process that keeps it from drifting into a generic one.

## 1. Choose a direction and say it

Before writing CSS, state one sentence: *"Direction: retro hardware, enamel panel, machined metal caps, one amber lamp."* Then every decision follows from it.

| User asks for | Direction | Kit |
| --- | --- | --- |
| Retro, vintage, analog, skeuomorphic, hardware, synth, drum machine, tube, console | Retro | `styles/retro.css`, taste in [hardware.md](./hardware.md) |
| Minimal, clean, editorial, quiet, light, Swiss | Minimal | `styles/minimal.css` |
| Modern, dark, pro, DAW, dense, flat | Modern | `styles/modern.css` |
| Another look: a named era, an instrument, a material (modular, hi-fi, brutalist, Y2K, paper) | Compose it: [taste.md](./taste.md) and `styles/materials.css` |
| Nothing | Pick from the product: instrument or effect, retro; tool or player, minimal; workstation, modern | |
| Their own design system | Keep it. Use only `styles/base.css` for structure and style the parts with their tokens | |

Two directions in one panel is the most common failure. A hybrid needs a reason ("a flat workstation with one retro compressor panel"), and each panel stays pure.

## 2. Start from the kit, never from memory

1. Copy `styles/base.css` (the structure of every part) and one skin into the project (`styles/materials.css` too for every skin but `retro`, `minimal`, `modern` and `brutalist`, and for a direction of your own).
2. Copy the markup of `Panel` from [directions.md](./directions.md). Its class names are the contract with the CSS, and its part tree is the verified one.
3. Change the skin's tokens (colors, sizes) before changing its rules.

A display-only app (a tuner, a readout, a scope) uses none of the knob, fader or meter markup: take the tokens and the type of a skin and draw the display yourself, keeping its contrast, focus and motion rules. The kit names only real parts, props, `data-*` attributes and CSS variables, and a test renders it in CI. When a part, prop or attribute is not in the kit or the component's docs page, do not invent it.

## 3. What every direction shares

- **One accent.** One signal color for value, selection and the active state. A second hue only for danger (clipping).
- **Type is a tool.** Labels small, uppercase, tracked; values in tabular numbers (`font-variant-numeric: tabular-nums`) so they do not jitter while dragging.
- **State is drawn.** `data-dragging`, `data-active`, `data-clipping`, `data-disabled`, `:focus-visible` (rule `design-feedback-by-state`).
- **Hit areas.** A thumb drawn at 12px is still grabbed at 24px or more: widen with a pseudo-element, not with the drawing.
- **Contrast.** Value text and focus rings at 4.5:1 and 3:1 against what they sit on. Dim ink is for secondary labels only. Skeuomorphic depth never carries meaning alone: pair it with color or a mark.
- **Motion.** 60 to 120ms on a hit, on the properties that change, no bounce. Honor `prefers-reduced-motion`.
- **Scale.** Size with `rem` (--knob-size), so the panel scales with the user's text size, and never below 40px for a touch target.

## 4. The part gotchas

- Parts set inline `position`, `bottom`, `left`, `translate` and `rotate`. Do not fight them with classes; style around them (rule `design-structure-before-skin`).
- `Knob.Mark` goes inside `Knob.Control`: `.knob-mark` fills its nearest positioned ancestor, and the Root also holds the label and the value, so marks placed there land off the dial.
- `Knob.Thumb` rotates itself: a pointer drawn as its `::after` rotates with the value.
- `Meter.Indicator` is a full-height bar scaled to the level: anything painted on it squeezes with it. Put the zones on `Meter.Channel` (rule `design-meter-zones`).
- `Meter.Channels` takes a render function and renders no element; the sized flex container is `Meter.Root`.
- A decorative element (screw, lamp, legend line) gets `aria-hidden="true"` and `pointer-events: none`.
- Registry components (`@audio-ui/knob`...) take `size`, `marks` and `orientation` before classes; the kit is for the headless parts.

## 5. Look before you finish

Open the page. Drag each control, tab to each one, check the focus ring, strike a pad, push a meter into clipping, and view it at a narrow width. A direction that only looks right in a screenshot is not done.
