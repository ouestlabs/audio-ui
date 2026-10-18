# Taste: composing any direction

The skins in `styles/` are examples, not the limit. A direction is a short brief turned into decisions, then into tokens and a material per part. Use this to invent one for any reference the user names ("a vintage Japanese hi-fi", "a modular synth", "a zine", "an old rack unit"), and to keep it from drifting into the generic look of every generated interface.

## 1. Turn the brief into decisions

Answer these in one line each before writing CSS. Taking them from a real object or a real era is what gives the result taste.

| Axis | Decide |
| --- | --- |
| Reference | The object or era: a drum machine, a tube compressor, a tape deck, a rack unit, a printed manual |
| Surface | What the panel is made of, and its color: enamel, brushed aluminium, black anodised, paper, a screen |
| Light | Where it comes from (--hl-x, --hl-y), and how hard: a hard sun for metal, soft for plastic, none for flat |
| Materials | Four or five at most: metal, plastic, rubber, glass, paper, lamp. Each has its own highlight |
| Color | A neutral panel and ink, one accent, and a danger color only for clipping |
| Type | The print: condensed grotesque, mono, a rounded sans; case, tracking, size (0.6 to 0.7rem for labels) |
| Shape | Radius, border weight, how much a part is raised (--lift) |
| Motion | How a part moves: a pad sinks, a switch snaps, a cap does not glow. 60 to 120ms, linear |

## 2. A vocabulary of looks

Starting points, each a set of decisions. Mix none of them: pick one.

| Look | Surface and color | Parts |
| --- | --- | --- |
| 70s analog synth | Black panel, wood cheeks, white print, amber lamp | `styles/synth70.css` |
| 80s Japanese hi-fi | Silver or black brushed plate, thin print, a green fluorescent readout | `styles/hifi.css` |
| 90s rack unit | Grey steel, a blue backlit LCD, small black caps | Tight rows of small knobs, an LCD, a bar of LED segments |
| Tube compressor | Warm grey enamel, cream VU face, black caps with a white line | `styles/tube.css` |
| Console channel | Dark slate, caps colored by section | `styles/console.css`, or `styles/solidstate.css` for a large-format desk |
| Software plugin | Light metal, glossy white knobs, dark glass displays | `styles/plugin.css` |
| Black-face rack unit | Black brushed plate in a silver trim, silver caps, a big VU | `styles/blackface.css` |
| Drum machine | Cream or grey panel, a row of colored keys | Large pads, a row of small round knobs, a step row |
| Lo-fi tape | Cream plastic, orange print, a paper meter | `styles/tape.css` |
| Modular | Black panel, thin white print, patch jacks, one red cable | Small knobs, jacks as rings, dense and symmetric |
| Terminal | Green on near-black, mono, no radius | `styles/phosphor.css` |
| Editorial | Paper, ink, one red-orange, hairlines | `styles/minimal.css` |
| Pro dark tool | Graphite in three steps, one signal color, mono labels | `styles/modern.css` |
| Brutalist | White or one flat color, 2px black borders, a hard offset shadow, mono | `styles/brutalist.css` |
| Y2K plastic | Translucent colored plastic, a glossy top highlight, big radius | `styles/y2k.css` |
| Zine and paper | Off-white grain, ink print, slightly rotated labels | Hand-drawn marks, stamped values |

## 3. Compose it

Copy `styles/base.css` and `styles/materials.css`. A simple direction is one scope class and about thirty lines (a rich one, with its own caps, rack ears and bezel, runs to a few hundred):

```css
/* MODULAR: black panel, thin white print, one red patch. */
.skin-modular {
  --panel: #131313;
  --ink: #e9e9e4;
  --accent: #e5432c;
  --hi: #6b6b66;
  --lo: #1b1b1a;
  --lift: 2;
  color: var(--ink);
  font-family: "Arial Narrow", system-ui, sans-serif;
  background: var(--enamel);
  border: 1px solid #2a2a28;
  border-radius: 4px;
}
.skin-modular .knob-thumb { border-radius: 50%; background: var(--plastic); box-shadow: var(--shadow-raised); }
.skin-modular .knob-thumb::after { content: ""; position: absolute; left: 50%; top: 6%; width: 2px; height: 34%; translate: -50% 0; background: var(--ink); }
.skin-modular .knob-indicator { color: var(--accent); }
.skin-modular .meter-indicator { background: var(--zones); background-size: 100% var(--strip-h, 9.5rem); background-position: bottom; mask: var(--segments); }
```

To use another palette on one part (cream keys on a dark panel), redefine the material on that part, `.key { --plastic: <your gradient>; }`, not the tokens: the materials are computed on the panel, so setting the light and dark tokens on a child changes nothing. Add one part at a time and look at it. The materials give you --metal, --brushed, --plastic, --rubber, --enamel, --groove, --glass, --paper, --lens-off, --lens-on, --segments and --zones, and the shadows --shadow-raised, --shadow-flat and --shadow-sunk. They all read the same light, so a part drawn from them agrees with the rest of the panel.

## 4. What to vary per part

| Part | The choices that change its character |
| --- | --- |
| Knob | The cap (machined metal, plastic with a skirt, a flat disc, a ring only), the pointer (a line, a dot, a notch, a wedge), a printed scale or none, an arc or a lamp ring for the value |
| Fader | The cap (a tall dark block with a white line, a flat square, a pill), the slot (a deep groove, a hairline), ticks either side or none |
| Meter | Lamp segments, a smooth bar, a needle on a paper face, dots; zones or one color plus clip |
| Pad | Rubber that sinks, a flat tile that fills, an outlined square; how velocity lights it |
| XY pad | A glass scope, a paper plate, a dot grid, a plain frame |
| Keys | Ivory and ebony, flat outlines, a colored pressed state |
| Toggle | A rocker, a key that sinks, an outlined box that fills |

## 5. Slop signals

These read as generated whatever the direction. Remove them.

- A purple-to-cyan gradient, or a gradient on text.
- A glow on every element. Glow belongs to lamps.
- Frosted glass cards stacked over a gradient, on a tool that is not an overlay.
- The same large radius on everything, and a soft shadow under everything.
- Equal-size controls in a uniform grid, and labels in sentence case at 14px.
- Pure black on pure white, or a gray with no hue next to a saturated accent.
- Decoration with no function: texture, screws and wood on every surface.

## 6. Check it

Look at the page at its real size beside a photo or a memory of the reference: is the light consistent, is every label printed, does each state show on touch, is the accent used once. Then apply the checks of [design.md](./design.md): focus ring, hit areas, contrast, reduced motion.
