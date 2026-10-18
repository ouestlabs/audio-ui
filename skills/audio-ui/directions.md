# Directions

Ten skins ready to copy, each verified in a browser on the same set of parts: knobs, faders, a stereo meter, an XY pad, drum pads and a keyboard. Copy `styles/base.css` and one skin into the project, then the markup below.

```tsx
import "./audio-ui/base.css";
import "./audio-ui/materials.css"; // for every skin except retro, minimal, modern and brutalist, and for a direction of your own
import "./audio-ui/retro.css"; // or any other skin of styles/
import { Panel } from "./audio-ui/panel";

<Panel skin="retro" title="Synth" />
```

## The markup

`panel.tsx`, the verified part tree of every skin (a test renders it in CI). Its class names are the contract with the CSS: keep them, and add your own parts the same way.

```tsx
import { Envelope } from "@audio-ui/react/envelope";
import { Fader } from "@audio-ui/react/fader";
import { Knob } from "@audio-ui/react/knob";
import { Meter } from "@audio-ui/react/meter";
import { Pad } from "@audio-ui/react/pad";
import { Piano } from "@audio-ui/react/piano";
import { XYPad } from "@audio-ui/react/xypad";
import { useState } from "react";

// The class names are the contract with styles/base.css and every skin.
// Keep them, change the skin: a part without its class has no size and draws nothing.

const MARKS = [0, 25, 50, 75, 100];
const PADS = ["Kick", "Snare", "Hat", "Clap"];
const ADSR = [
  { x: 0, y: 0 },
  { x: 0.15, y: 1 },
  { x: 0.4, y: 0.6 },
  { x: 0.75, y: 0.6 },
  { x: 1, y: 0 },
];

function KnobControl({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue: number;
}) {
  return (
    <Knob.Root
      aria-label={label}
      className="knob"
      defaultValue={defaultValue}
      dragMode="vertical"
      max={100}
      min={0}
    >
      <Knob.Control className="knob-control">
        <Knob.Track className="knob-track" />
        <Knob.Indicator className="knob-indicator" />
        <Knob.Thumb className="knob-thumb" />
        {/* Marks go inside the control: they are centred on the dial, not on the label and value below it */}
        {MARKS.map((value) => (
          <Knob.Mark className="knob-mark" key={value} value={value}>
            <span className="knob-tick" />
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="knob-label">{label}</Knob.Label>
      <Knob.Value className="knob-value" editable />
    </Knob.Root>
  );
}

function FaderControl({ label, defaultValue }: { label: string; defaultValue: number }) {
  return (
    <Fader.Root aria-label={label} className="fader" defaultValue={defaultValue} max={100} min={0} orientation="vertical">
      <Fader.Control className="fader-control">
        <Fader.Track className="fader-track">
          <Fader.Indicator className="fader-indicator" />
        </Fader.Track>
        <Fader.Thumb className="fader-thumb" />
      </Fader.Control>
      <Fader.Label className="knob-label">{label}</Fader.Label>
      <Fader.Value className="knob-value" editable />
    </Fader.Root>
  );
}

// An envelope editor: points are normalized to 0..1 on both axes. Points takes a render function.
function EnvelopeControl({ label }: { label: string }) {
  return (
    <Envelope.Root
      aria-label={label}
      className="envelope"
      defaultValue={ADSR}
      maxPoints={5}
      minPoints={5}
    >
      <Envelope.Graph className="envelope-graph">
        <Envelope.Fill className="envelope-fill" />
        <Envelope.Line className="envelope-line" />
      </Envelope.Graph>
      <Envelope.Points>
        {(_point, index) => (
          <Envelope.Point
            aria-label={`${label} point ${index + 1}`}
            className="envelope-point"
            index={index}
            key={index}
          />
        )}
      </Envelope.Points>
    </Envelope.Root>
  );
}

// A toggle (mute, solo, power) is a plain button: aria-pressed carries the state.
function ToggleControl({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  return (
    <button aria-pressed={on} className="toggle" onClick={() => setOn(!on)} type="button">
      {label}
    </button>
  );
}

// `skin` is one of the skins in styles/: the class on the panel selects it.
export function Panel({
  skin,
  title,
}: {
  skin: "retro" | "minimal" | "modern" | "tape" | "phosphor" | "hifi" | "brutalist" | "y2k" | "console" | "synth70";
  title: string;
}) {
  return (
    <section className={`panel skin-${skin}`}>
      <h2 className="panel-title">{title}</h2>
      <div className="panel-row">
        <KnobControl defaultValue={62} label="Drive" />
        <KnobControl defaultValue={30} label="Tone" />
        <FaderControl defaultValue={70} label="Level" />
        <FaderControl defaultValue={40} label="Pan" />
        <ToggleControl label="M" />
        {/* Meter.Channels takes a render function and renders no element itself */}
        <Meter.Root
          aria-label="Output"
          className="meter"
          max={6}
          min={-48}
          peak={[-6, -2]}
          value={[-14, -4]}
        >
          <Meter.Channels>
            {(index: number) => (
              <Meter.Channel
                className="meter-channel"
                index={index}
                key={index}
              >
                <Meter.Indicator className="meter-indicator" />
                <Meter.Peak className="meter-peak" />
              </Meter.Channel>
            )}
          </Meter.Channels>
        </Meter.Root>
        <XYPad.Root
          aria-label="Filter"
          defaultValue={{ x: 60, y: 35 }}
        >
          <XYPad.Control className="xypad-control">
            <XYPad.Thumb className="xypad-thumb" />
          </XYPad.Control>
        </XYPad.Root>
      </div>
      <div className="panel-row">
        <Pad.Root aria-label="Drum pads" className="pads" columns={4}>
          {PADS.map((name) => (
            <Pad.Item className="pad" key={name} value={name}>
              {name}
            </Pad.Item>
          ))}
        </Pad.Root>
        <Piano.Root
          aria-label="Keys"
          className="piano"
          maxPitch={71}
          minPitch={60}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="piano-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>
        <EnvelopeControl label="Amp" />
      </div>
    </section>
  );
}
```

`materials.css` is needed by tape, phosphor, hifi, y2k, console and synth70; retro, minimal, modern and brutalist are self-contained. The skin is the class on the panel (`skin-retro`, `skin-minimal`, `skin-modern`), so every selector is scoped and two skins can sit on one page. The tokens are the custom properties at the top of each skin: change those first.

## Retro: a hardware faceplate

`styles/retro.css`. A warm enamel panel with a fine grain, machined metal caps with a knurled edge and a pointer line, a console fader with a dark cap and a white line, an amber ring of light for the value, lamp-style meter segments in green, amber and red, a CRT-green XY pad, rubber pads that sink when struck, ivory and ebony keys. Decorative pieces (`.screw`, `.lamp`, `.section` with a `.legend`, `.rocker`) are in the same file.

Read [hardware.md](./hardware.md) before composing a retro panel: it explains what makes it look like a real instrument and what makes it look like a 2010 gloss.

## Minimal: hairlines and one accent

`styles/minimal.css`. Paper background, near-black ink, one red-orange accent. A knob is a hairline ring, the value an arc, the pointer a dot. A fader is a hairline and a small square, a meter two thin bars, a pad an outlined square that fills when struck. No shadows, no gradients, no radius beyond 2px. All the work is in spacing, type and the one accent. Needs room: generous gaps (2.5rem) and large margins.

## Modern: flat graphite and a signal color

`styles/modern.css`. Near-black surfaces in three steps, 1px borders, one acid-lime signal. Flat discs and flat caps, hard-edged meter segments, a dot-grid XY pad, a mono uppercase label. No glow, no glass, no gradients, no purple: when a panel starts to look like a landing page, remove effects until the controls read as tools.

## Tape: a lo-fi cassette deck

`styles/tape.css`. Cream plastic caps, a brushed fader plate, orange print, a paper face for the meter and the XY pad. Built only from `materials.css`: it is the proof that a direction is tokens plus a choice of material per part.

## Phosphor: a monochrome terminal

`styles/phosphor.css`. One green on near-black with scanline grain, mono type, bracketed values, square handles, segmented meters. Also built only from `materials.css`.

## More skins

- **hifi** (`styles/hifi.css`): an 80s Japanese hi-fi component. A black brushed plate, small silver caps, thin print, a green fluorescent readout and an LED ladder.
- **brutalist** (`styles/brutalist.css`): flat colors, 2px black borders, a hard offset shadow, mono type. A pad sinks into its shadow when struck.
- **y2k** (`styles/y2k.css`): translucent candy plastic. A pale blue shell, teal caps with a gloss band, one orange accent, large radii.
- **console** (`styles/console.css`): a mixing console channel. A slate panel, caps colored by section (the second and third knob change color), a long fader with ticks and a lamp ladder.
- **synth70** (`styles/synth70.css`): a 70s monophonic synth. A black panel between wood cheeks, white print, an amber lamp, rocker toggles.

Every one is built from `styles/materials.css` and the shared tokens, so each is about sixty lines: read the closest one before writing your own.

With shadcn and a distinct look, take the headless parts from `@audio-ui/react` for the kit's skins, and the registry only for the engine items (`web-audio`, `drum-synthesis`): the registry components take `size` and `marks`, not these class names.

Minimal, modern and brutalist hide the knob ticks (`.knob-tick { display: none }`). Delete that rule to print a scale: an EQ's bipolar knob wants its marks. Each skin styles the panel, not the page: set the page background and `color-scheme` yourself. The kit covers knob, fader, meter, XY pad, pad, piano and a toggle; read the component page of Envelope, Plot, Waveform, Timeline and the rest (an ADSR can also be four faders), and style them with the same tokens and the part's own `className`.

## Props you will need

| Part | Props and signals |
| --- | --- |
| `Knob.Root` | `dragMode` (`"vertical"` drags up and down like a fader; the default `"circular"` needs a gesture around the dial), `min`, `max`, `step`, `largeStep`, `defaultValue` or `value` with `onValueChange(value, details)`, `onValueCommitted`, `scale="log"`, `anchor`, `format`, `locale` |
| `Fader.Root` | `orientation`, `min`, `max`, `step`, `largeStep`, `defaultValue` or `value` with `onValueChange(value, details)`, `onValueCommitted`, `anchor`, `format`. No `scale`: for a log law, map a linear fader yourself |
| `Fader.Label`, `Fader.Value`, `Knob.Label`, `Knob.Value` | The name and the formatted value, announced and drawn from the same state. `editable` on a value lets people type an exact number (double-click, or Enter while it has focus; Enter commits, Escape drops, a unit or a decimal comma is fine and the result is clamped), as in the kit. `Intl` has no Hz, ms or dB unit: pass a render function, `<Knob.Value>{(formatted, value) => `${Math.round(value)} Hz`}</Knob.Value>`, and put the unit in `getAriaValueText` on the thumb. `format` and `locale` on the Root set the number format, so set `locale` to keep one decimal mark |
| `Meter.Root` | `value` and `peak` (one level per channel, in dB) or a live `source` (`createSource` of `{ levels, peaks }`, where `peaks` is optional), `min`, `max`, `clipThreshold`, `warnThreshold`; `data-clipping` and `data-warning` on a channel |
| `Pad.Root`, `Pad.Item` | `columns`, `value`, `onPadOn(value, { velocity })` and `onPadOff(value)` for the strike; `data-active` and `--pad-velocity` while struck |
| `XYPad.Root` | `defaultValue={{ x, y }}` or `value`, `onValueChange`; `--xy-pad-x` and `--xy-pad-y` |

Signatures: `Knob.Value` and `Fader.Value` take a render function `(formatted, value) => ReactNode` (the Fader's receives arrays, one entry per thumb: `<Fader.Value>{(_formatted, [value]) => `${value.toFixed(1)} dB`}</Fader.Value>`), and `getAriaValueText(formatted, value) => string` goes on `Knob.Thumb`. To keep the readout and the announced text equal, write one `format(value)` and use it in both, and set `locale` on the Root (a French browser would announce "3,6" beside a readout of "3.6"). `Meter.Root` sets `data-clipping` from the level, not from the peak: style `.meter-channel[data-clipping] .meter-indicator`. The slider takes its name from `Knob.Label` or `Fader.Label` (the kit has one), or from `aria-label` on `Knob.Thumb` or `Fader.Thumb`. An `aria-label` on the Root alone names a group, not the slider, so a test that looks for `getByRole("slider", { name })` finds nothing. Tests read the value with `inputValue()`.

Focus lands on the input nested in each thumb, so draw the ring on the thumb with `:has(:focus-visible)` (the kit does). The ring takes --focus, then the accent: when the accent is also the value color, set --focus to the ink so the ring does not disappear into the arc. A fader's `.fader-indicator` is the filled part of the slot: show it for a level, hide it (`display: none`) for a hairline or a hardware slot. Every fader and meter takes its length from one variable, --strip-h, set on the panel or on a strip.

## Printed scales

A fader or meter on a real panel has numbers beside it. Draw them as an `ol.scale` (give it a width, and put it in the same flex row as the control, next to the `Fader.Root`) next to the control, one `li` per mark, at `style={{ bottom: "<percent>%" }}` of the strip (the percent of the range, 0 at the bottom), with `aria-hidden="true"` because the control already announces its value.

## A mixer strip

Calibrate the meter to the signal: with a voice gain of 0.2 a normal level sits near -36 dB, so use a floor of -60 dB and a 0 dB reference, and say so on the scale. Give the fader and the meter of a strip the same range (-60 to +6 dB, say) and the same height (--strip-h), and put the printed `ol.scale` in the same row, at the same height as `.fader-control`: a label at `bottom: <percent>%` then sits on the thumb's center at that value. Override a skin from outside with a more specific selector (`.mixer .toggle[aria-pressed="true"]`), since the skin's own rule has the same weight as a bare class.

## Making a new direction

Do not start from a blank file: read [taste.md](./taste.md), then compose from `styles/materials.css`.

Copy a skin, rename its scope class, and change in this order: surface colors, the accent, type, then the parts' shapes. Keep one idea per direction ("brushed aluminium and orange", "paper and ink") and apply the rules of the `design-` section. Do not mix the kits' rules: a retro cap on a minimal panel looks like a mistake.
