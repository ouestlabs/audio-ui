---
title: Give every part its structure before its skin
impact: HIGH
impactDescription: parts that render at the right size and position
tags: design, css, parts, inline-styles
---

## Give every part its structure before its skin

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
