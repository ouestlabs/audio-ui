# audio/ui design

**Version 1.2.0**  
audio/ui  
October 2026

> **Note:**  
> This document is for agents and LLMs building audio interfaces with audio/ui. It is generated from `rules/` by `bun run skill:build` in `apps/www`: edit the rules, not this file.

---

## Abstract

How to give the headless audio/ui primitives a look, for AI agents and LLMs: one visual direction (retro hardware, minimal, modern), the structure each part needs, and the habits that make a panel read as an instrument. Each rule shows the incorrect markup an agent tends to write and the correct markup with the real audio/ui API.

---

## Table of Contents

1. [Design](#1-design): **HIGH**
   - 1.1 [Draw meter zones on the channel](#11-draw-meter-zones-on-the-channel)
   - 1.2 [Give every part its structure before its skin](#12-give-every-part-its-structure-before-its-skin)
   - 1.3 [One light source, a few materials](#13-one-light-source-a-few-materials)
   - 1.4 [Pick a visual direction first](#14-pick-a-visual-direction-first)
   - 1.5 [Print labels and scales on the panel](#15-print-labels-and-scales-on-the-panel)
   - 1.6 [Show state with the parts' attributes, not only on hover](#16-show-state-with-the-parts-attributes-not-only-on-hover)
   - 1.7 [Size and group controls by importance](#17-size-and-group-controls-by-importance)

---

## 1. Design

**Impact: HIGH**

Making the headless primitives look like something: one visual direction (retro hardware, minimal, modern), the structure each part needs, and the habits that make a panel read as an instrument.

### 1.1 Draw meter zones on the channel

**Impact: HIGH (green, amber and red stay where the levels are)**

`Meter.Indicator` is a full-height bar scaled to the level. A gradient painted on it is squeezed with it, so the red zone slides down the bar as the level falls and shows at a third of the range. Paint the zones on the channel, dimmed, and let the indicator light them back up where it reaches (`mix-blend-mode: color-dodge`). A mask on the channel cuts the bar into lamps, and it must be on the channel too, since a mask on the indicator would squeeze as well. A flat direction (minimal, modern) needs no zones: one bar color, and a second only on `data-clipping`.

**Incorrect (the gradient shrinks with the bar):**

```css
.meter-indicator {
  background: linear-gradient(0deg, green 0 60%, orange 60% 85%, red 85%);
  background-size: 100% 9.5rem;
}
```

**Correct (zones on the channel, the indicator lights them):**

```css
.meter-channel {
  isolation: isolate;
  background: linear-gradient(rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.72)),
    linear-gradient(0deg, green 0 60%, orange 60% 85%, red 85%);
  mask: repeating-linear-gradient(0deg, #000 0 4px, transparent 4px 6px);
}
.meter-indicator {
  background: rgb(184 184 184);
  mix-blend-mode: color-dodge;
}
```

### 1.2 Give every part its structure before its skin

**Impact: HIGH (parts that render at the right size and position)**

A headless part has no size. A `Knob.Control` without a width collapses to nothing, a `Fader.Track` without a height is invisible, and a `Meter.Channels` renders no element at all. Start from `styles/base.css` (the structure of every part), then add a skin on top. The parts also set inline styles you cannot override from a class: never set `position`, `bottom`, `left`, `translate` or `rotate` on `Fader.Thumb`, `Knob.Thumb`, `XYPad.Thumb` or a `Meter.Indicator`.

**Incorrect (a track with no height, a thumb placed by hand):**

```css
.fader-track { width: 6px; background: #222; }
.fader-thumb { position: absolute; bottom: 40%; }
```

**Correct (structure sized by you, position left to the part):**

```css
.fader-control { position: relative; width: 2.75rem; height: 9.5rem; }
.fader-track { width: 6px; height: 100%; margin-inline: auto; overflow: hidden; }
.fader-indicator { position: absolute; }
.fader-thumb { position: absolute; width: 2rem; height: 1rem; }
```

Meter channels need a flex `Meter.Root` with a height, and `Meter.Channels` takes a render function: `{(index) => <Meter.Channel index={index}>...</Meter.Channel>}`.

### 1.3 One light source, a few materials

**Impact: HIGH (depth that reads as real instead of as decoration)**

A skeuomorphic panel is believable when every highlight and shadow agrees on one light, usually above and to the left. Highlights sit on the top edge, shadows fall down, an inset control is lit from the bottom. Limit the panel to four or five materials (enamel, metal, plastic, rubber, glass), each with its own highlight: metal has sharp streaks, plastic one broad soft spot, rubber almost none, glass a small bright reflection.

**Incorrect (shadows in every direction, glow on everything):**

```css
.knob-thumb {
  background: radial-gradient(circle at 70% 70%, #fff, #888);
  box-shadow: 0 0 20px #0ff, -6px -6px 12px #fff, 6px 6px 12px #000;
}
```

**Correct (light from the top left, a short hard shadow, glow only on lamps):**

```css
.knob-thumb {
  background: radial-gradient(circle at 32% 26%, #f4f1ea, #9c978c 55%, #55524b);
  box-shadow:
    0 6px 8px rgb(0 0 0 / 0.55),
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    inset 0 -2px 3px rgb(0 0 0 / 0.35);
}
```

### 1.4 Pick a visual direction first

**Impact: HIGH (one coherent look instead of a mix of styles)**

The primitives of `@audio-ui/react` draw nothing, so the look is yours to decide, and an agent that starts writing CSS without deciding produces a little of everything: a gradient here, a glass card there, a neon accent. Choose one direction, say it in a sentence, then style every part from it.

More than a dozen are ready to use (copy `styles/base.css` and one skin; the table of `design.md` maps a request to each): retro, tape, synth70, tube, blackface, gunmetal, opto, blacky, bluey, solidstate and console for hardware, plugin for a glossy software window, minimal, modern and phosphor for flat tools, brutalist, y2k and hifi for a strong character. Take the one the user names. When they name none, pick from the product: a synth, drum machine or compressor is hardware, a tool or a player is minimal, a dense workstation is modern.

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

### 1.5 Print labels and scales on the panel

**Impact: HIGH (a panel that reads as an instrument, and is legible)**

On real hardware every control is named and graduated by ink printed on the panel, not by a tooltip. Use small uppercase labels with wide tracking in one ink color, tabular numbers for values, ticks at the marks (`Knob.Mark` with a `.knob-tick`) and a section title that sits on a line around a group. Keep contrast legible: dim ink is for secondary text, never for the value you are reading.

**Incorrect (a mixed-case label in a default font, no scale):**

```css
.knob-label { font-size: 14px; font-weight: 400; }
```

**Correct (silkscreen type, tabular value, printed marks):**

```css
.knob-label {
  font: 700 0.6rem/1 "Arial Narrow", Arial, sans-serif;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.knob-value { font-variant-numeric: tabular-nums; }
.knob-tick { background: currentColor; height: 5px; }
```

### 1.6 Show state with the parts' attributes, not only on hover

**Impact: HIGH (controls that answer touch, keyboard and sound)**

A control must answer the hand: a grabbed knob, a struck pad, a clipping meter. The parts expose it as `data-dragging`, `data-active`, `data-clipping`, `data-warning` and `data-disabled`, plus `--pad-velocity` on a pad. Draw those, and a visible `:focus-visible` ring. Hover does not exist on touch, and motion alone is not feedback: pair it with a color or a position change. Keep transitions under 120ms on a hit, and animate only the properties that change.

**Incorrect (hover only, a transition on everything):**

```css
.pad { transition: all 0.4s ease; }
.pad:hover { background: orange; }
```

**Correct (the struck state, scaled by velocity, with a short transition):**

```css
.pad { transition: background 60ms linear, transform 60ms linear; }
.pad[data-active] {
  transform: translateY(2px);
  background: color-mix(in oklab, var(--accent) calc(40% + var(--pad-velocity, 0.6) * 60%), var(--surface));
}
.pad:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

### 1.7 Size and group controls by importance

**Impact: HIGH (a panel you can scan, not a grid of identical knobs)**

A grid of twelve identical knobs reads as a spreadsheet. On a real panel the controls that matter are larger, related ones sit together in a labelled section, and the sections follow the signal: input, source, filter, amplifier, output. Use at most three knob sizes (the --knob-size variable of the kit, set on the control), one section per job, and keep a destructive or master control apart from the rest. In a mixer the same holds for strips: the master is wider and set apart by a hairline, the channels are equal.

**Incorrect (twelve equal knobs in one grid):**

```tsx
<div className="grid grid-cols-6 gap-4">
  {PARAMS.map((p) => <KnobControl key={p.id} {...p} />)}
</div>
```

**Correct (sections in signal order, the master larger):**

```tsx
<div className="panel-row">
  <div className="section"><span className="legend">Filter</span>
    <KnobControl label="Cutoff" />
    <KnobControl label="Resonance" />
  </div>
  <div className="section"><span className="legend">Output</span>
    <KnobControl label="Level" style={{ "--knob-size": "6rem" }} />
  </div>
</div>
```

---

## References

1. https://www.audio-ui.dev/docs
2. https://www.audio-ui.dev/llms.txt
