# Retro hardware: what gives it taste

Notes from how real panels are made, and from what works and fails in plugin interfaces. Use with `styles/retro.css`.

## What real panels do

- **The panel is a plan of the signal.** Controls follow the path of the sound (input, source, filter, amplifier, output) and are grouped in labelled sections: a thin printed line around a group with its title cut into it. Not cards, not shadows.
- **Importance is size.** The master and the main tone control are the largest; trims are small. Never a grid of equal knobs. Three sizes at most.
- **Everything is printed.** Uppercase condensed labels in one ink, scales and ticks around knobs, arrows and waveform glyphs as symbols. The ink is cream, white or black, never a bright color.
- **Few materials, each with its own light.** Painted or anodised metal (flat, finely grained), plastic (broad soft highlight), machined aluminium (sharp streaks, knurled edge), rubber (almost no highlight), glass over lamps and meters (a small bright reflection). One light, top left.
- **Light is information.** Lamps and LEDs are the only things that glow: a dim lens when off, a bright core with a small halo (4 to 8px) when on. Never a glowing panel or knob.
- **Color is function.** A mostly neutral panel with color placed on purpose: a row of colored caps for sections, an amber lamp for power, red only for clip and record.
- **Parts move physically.** A pad sinks (`translateY(2px)`, its shadow shortens), a switch snaps, a fader cap keeps its line. Short linear transitions, no bounce.

## Palettes by kind of instrument

| Kind | Panel | Ink | Accents |
| --- | --- | --- | --- |
| Analog drum machine | cream `#d9d2c0` | `#2b2926` | orange `#e8742c`, yellow `#f0c23a`, red `#d6392b` |
| Tube compressor | warm grey `#6f7673` | cream `#efe6c8` | black caps `#151515` with a white line, a red zone on the VU |
| Console channel | slate `#2b2f33` | `#e8e4da` | caps by section: red `#c8372d`, blue `#2f6fb2`, green `#3d9a58`, yellow `#d9b03a` |
| 70s synth | black `#151311`, wood cheeks `#6b4226` | white | amber lamp `#ffb028`, white rocker switches |
| Tape machine | brushed silver `#bfc2c4` | black | red record lamp, a VU on cream paper |
| Boutique flat (leans minimal) | `#e9e8e3` | black | one orange `#ff5a1f`, mono type |

Type: a condensed grotesque for print (`"Arial Narrow", "Helvetica Neue", system-ui` with uppercase and `letter-spacing` 0.12 to 0.2em), tabular mono for readouts. Small: 0.6 to 0.7rem.

## Lessons from plugin interfaces

- **Faithful is not always friendly.** Drop what only hardware needed: dual-concentric knobs, backwards controls. Keep the look, not the limitation.
- **Legibility first.** An unlit button must read as a button, an off lamp as a lamp. Check the state at a glance, not only the value.
- **Restraint.** An over-decorated panel steals attention from the controls. Screws and wood are one or two accents, not texture on everything.
- **Scale.** Size in `rem`, and let the panel shrink to a compact layout so several fit on a screen.
- **Meters have behavior.** A VU wants about 300ms to rise and fall; a peak ladder holds its top lamp. Calibration (0 dB reference) is a choice, so label it.
- **A mouse is not a hand.** A knob on the web is dragged vertically or turned with the wheel and arrow keys: keep the pointer line big and the hit area generous.

## A VU needle, a compressor face

`Vu` in the `Panel` markup of [directions.md](./directions.md) is the needle: a paper face, a red zone, one CSS variable from a source. Feed it a 0 to 1 gain reduction (or level) and the CSS transition gives it about 300 ms of ballistics. For a tube compressor: take `tape.css` for the warm grey enamel, make the three main knobs large (5 to 6rem) and the two timing knobs small, give the caps a dark collar with a white line (copy the conic knurl of `retro.css` and darken it), and put the VU in the middle. Printed numerals around a knob collide with the next knob when the gap is under about 2.4rem. A fixed hardware face may keep its width: let the page scroll or scale the whole panel with `zoom` at narrow widths, rather than reflowing the controls.

## Avoid

Pure black and pure white, rainbow gradients, glass on a hardware panel, one drop shadow on everything, a glow on knobs, thick bevels everywhere, faux scratches and dirt, text on a curve, and equal-size controls.

`styles/retro.css` is the dark brown faceplate. For a cream or silver panel (the drum machine or tape rows above), start from `styles/tape.css`, or retune the retro tokens and then check every part that assumes a dark panel: section borders, legend ink, value text, rubber pads, the lamp.

## Recipes (all in `styles/retro.css`)

- **Screw**: a radial metal gradient with a slot from a diagonal linear gradient; `aria-hidden`, `pointer-events: none`. Place it with `screw-tl`, `screw-tr`, `screw-bl` or `screw-br`, each at its own angle.
- **Lamp**: dim lens by default, `data-on` adds the bright core and an 8px halo.
- **Section**: a 1px border at 35% ink with a `.legend` positioned on the top edge over the panel color.
- **Rocker**: a two-tone cap, pale above and metal below, in a dark bezel.
