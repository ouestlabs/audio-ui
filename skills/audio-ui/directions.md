# Directions

Fourteen skins ready to copy, each verified in a browser on the same set of parts: knobs, faders, a stereo meter, an XY pad, drum pads and a keyboard. Copy `styles/base.css` and one skin into the project, then the markup below.

```tsx
import "./audio-ui/base.css";
import "./audio-ui/materials.css"; // for every skin except retro, minimal, modern and brutalist, and for a direction of your own
import "./audio-ui/retro.css"; // or any other skin of styles/
import { Panel } from "./audio-ui/panel";

<Panel skin="retro" title="Synth" />
```

## The markup

This is the verified part tree of every skin (a test renders it in CI). It is one code block: copy the pieces you need into your own files. Its class names are the contract with the CSS: keep them, and add your own parts the same way.

```tsx
import { Envelope } from "@audio-ui/react/envelope";
import { Fader } from "@audio-ui/react/fader";
import { Knob } from "@audio-ui/react/knob";
import { Meter } from "@audio-ui/react/meter";
import { Pad } from "@audio-ui/react/pad";
import { Piano } from "@audio-ui/react/piano";
import { Plot } from "@audio-ui/react/plot";
import { Sequencer } from "@audio-ui/react/sequencer";
import { Waveform } from "@audio-ui/react/waveform";
import { XYPad } from "@audio-ui/react/xypad";
import { createSource, type Source } from "@audio-ui/react";
import { useEffect, useRef, useState } from "react";

// The class names are the contract with styles/base.css and every skin.
// Keep them, change the skin: a part without its class has no size and draws nothing.

const MARKS = [0, 25, 50, 75, 100];
const PADS = ["Kick", "Snare", "Hat", "Clap"];
const STEPS = Array.from({ length: 16 }, (_, step) => step % 4 === 0);
const PATTERN = [STEPS, STEPS.map((on) => !on)];
const WAVES = ["Sine", "Saw", "Square"];
const PEAKS = Array.from({ length: 160 }, (_, i) => 0.2 + 0.7 * Math.abs(Math.sin(i / 9) * Math.cos(i / 23)));
const DB_LINES = [-24, -48, -72];
const HZ_LINES = [100, 1000, 10_000];
const spectrum = createSource(Float32Array.from({ length: 64 }, (_, i) => -20 - i * 1.1));
const reduction = createSource(0.35);
const playing = createSource(4);
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
    <Fader.Root className="fader" defaultValue={defaultValue} max={100} min={0} orientation="vertical">
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

// A seekable waveform: `peaks` are amplitudes 0 to 1 (computed once), the canvas draws them,
// `value` is the position (a fraction by default). Colors come from --waveform-color and --waveform-progress-color.
function WaveformControl({ label }: { label: string }) {
  return (
    <Waveform.Root defaultValue={0.4} peaks={PEAKS}>
      <Waveform.Control aria-label={label} className="waveform-control">
        <Waveform.Canvas className="waveform-canvas" />
        <Waveform.Playhead className="waveform-playhead" />
        <Waveform.Thumb className="waveform-thumb" />
      </Waveform.Control>
    </Waveform.Root>
  );
}

// A spectrum: Plot.Root must be given a height (it is a positioned div), Plot.Graph is the svg.
// Trace takes a source of one value per point (here dB, log frequency on x).
function SpectrumControl() {
  return (
    <Plot.Root className="plot" maxX={20_000} maxY={0} minX={20} minY={-96} scaleX="log">
      <Plot.Graph className="plot-graph">
        {DB_LINES.map((db) => (
          <Plot.Line axis="y" className="plot-grid" key={db} value={db} />
        ))}
        {HZ_LINES.map((hz) => (
          <Plot.Line axis="x" className="plot-grid" key={hz} value={hz} />
        ))}
        <Plot.Trace className="plot-area" fillTo={-96} source={spectrum} />
      </Plot.Graph>
    </Plot.Root>
  );
}

// A segmented choice (a waveform, a mode) is a group of toggles: aria-pressed carries the state.
function ChoiceControl({ label }: { label: string }) {
  const [wave, setWave] = useState(WAVES[0]);
  return (
    <div aria-label={label} className="choice" role="group">
      {WAVES.map((name) => (
        <button
          aria-pressed={wave === name}
          className="toggle"
          key={name}
          onClick={() => setWave(name)}
          type="button"
        >
          {name}
        </button>
      ))}
    </div>
  );
}

// A step sequencer: Rows and Cells take render functions; `source` carries the playing step (-1 hides it).
function SequencerControl({ step }: { step: Source<number> }) {
  return (
    <Sequencer.Root className="sequencer" defaultValue={PATTERN} source={step}>
      <Sequencer.Rows>
        {(row: number) => (
          <Sequencer.Row aria-label={`Row ${row + 1}`} className="sequencer-row" index={row}>
            <Sequencer.Cells>
              {(cell: number) => (
                <Sequencer.Cell
                  aria-label={`Row ${row + 1}, step ${cell + 1}`}
                  className="step"
                  step={cell}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
}

// A VU needle: a leaf that writes one CSS variable from a source, so React never renders per frame.
// The 0..1 reading sweeps -40 to +40 degrees about a pivot below the face (50, 72), the arc's center;
// the CSS transition is the needle's ballistics. Draw ticks and numerals from the same center.
function Vu({ label, source }: { label: string; source: Source<number> }) {
  const needle = useRef<SVGGElement>(null);
  useEffect(() => {
    const draw = () => needle.current?.style.setProperty("--vu", String(source.getSnapshot()));
    draw();
    return source.subscribe(draw);
  }, [source]);
  return (
    <figure aria-label={label} className="vu" role="img">
      <svg aria-hidden="true" className="vu-face" viewBox="0 0 100 60">
        <path className="vu-zone" d="M 66.0 16.2 A 58 58 0 0 1 87.3 27.6" />
        <path className="vu-arc" d="M 12.7 27.6 A 58 58 0 0 1 87.3 27.6" />
        <g className="vu-needle" ref={needle}>
          <line x1="50" x2="50" y1="72" y2="22" />
        </g>
        <circle className="vu-hub" cx="50" cy="72" r="5" />
      </svg>
      <figcaption className="knob-label">{label}</figcaption>
    </figure>
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
  skin: "retro" | "minimal" | "modern" | "tape" | "phosphor" | "hifi" | "brutalist" | "y2k" | "console" | "synth70" | "tube" | "solidstate" | "plugin" | "blackface";
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
        <Vu label="GR" source={reduction} />
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
            <XYPad.Thumb aria-label="Filter" className="xypad-thumb" />
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
        <ChoiceControl label="Wave" />
      </div>
      <div className="panel-row">
        <SequencerControl step={playing} />
        <WaveformControl label="Position" />
        <SpectrumControl />
      </div>
    </section>
  );
}
```

`materials.css` is needed by tape, phosphor, hifi, y2k, console, synth70, tube, solidstate, plugin and blackface; retro, minimal, modern and brutalist are self-contained. The skin is the class on the panel (`skin-retro`, `skin-minimal`, `skin-modern`), so every selector is scoped and two skins can sit on one page. The tokens are the custom properties at the top of each skin: change those first.

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
- **tube** (`styles/tube.css`): a vintage tube compressor. Warm grey enamel, cream print at 5.2:1, black knurled caps with a white line, an amber lamp; pair it with the `Vu` needle.
- **solidstate** (`styles/solidstate.css`): a large-format console channel. Pale grey enamel, dark print, caps colored by section (red, blue, green), tall dark fader caps with a colored line, an LED ladder.
- **plugin** (`styles/plugin.css`): a glossy software plugin window. Light blue-grey metal, chunky white knobs with a blue value ring, dark glass displays, rounded white keys.
- **blackface** (`styles/blackface.css`): a black-face rack unit. A brushed black faceplate in a silver trim, silver knurled caps, a big VU (the VU width variable), engraved white print, a red lamp.
- **synth70** (`styles/synth70.css`): a 70s monophonic synth. A black panel between wood cheeks, white print, an amber lamp, rocker toggles.

Most are built from `styles/materials.css` and the shared tokens (tape, phosphor, console and hifi lean on them most; y2k and synth70 set only the light and dark tokens and draw the rest by hand, since candy gloss and wood are not in the materials), so each is about sixty lines: read the closest one before writing your own. `.lamp` and `.screw` (with `screw-tl`, `screw-tr`, `screw-bl`, `screw-br`) come from `materials.css`; the rocker and the lamp rim are retro's.

With shadcn and a distinct look, take the headless parts from `@audio-ui/react` for the kit's skins, and the registry only for the engine items (`web-audio`, `drum-synthesis`): the registry components take `size` and `marks`, not these class names.

Minimal, modern and brutalist hide the knob ticks (`.knob-tick { display: none }`). Delete that rule to print a scale: an EQ's bipolar knob wants its marks. Each skin styles the panel, not the page: set the page background and `color-scheme` yourself. The kit covers knob, fader, meter, XY pad, pad, piano and a toggle; read the component page of Envelope, Plot, Waveform, Timeline and the rest (an ADSR can also be four faders), and style them with the same tokens and the part's own `className`.

## Header bars and displays

A plugin window or a rack unit has a header with a name display and prev/next buttons: use `.toggle` for the buttons and `.display` for the name window (a dark readout, the same look as a knob's value). Both are yours to place; the skins style `.display` where it matters.

## Props you will need

| Part | Props and signals |
| --- | --- |
| `Knob.Root` | `dragMode` (`"vertical"` drags up and down like a fader; the default `"circular"` needs a gesture around the dial), `min`, `max`, `step`, `largeStep`, `defaultValue` or `value` with `onValueChange(value, details)`, `onValueCommitted`, `scale="log"`, `anchor`, `format`, `locale` |
| `Fader.Root` | `orientation`, `min`, `max`, `step`, `largeStep`, `defaultValue` or `value` with `onValueChange(value, details)`, `onValueCommitted`, `anchor`, `format`. No `scale`: for a log law, map a linear fader yourself |
| `Fader.Label`, `Fader.Value`, `Knob.Label`, `Knob.Value` | The name and the formatted value, announced and drawn from the same state. `editable` on a value lets people type an exact number (double-click, or Enter while it has focus; Enter commits, Escape drops, a unit or a decimal comma is fine and the result is clamped; your own render function's unit is ignored when parsing: typing `5.5 s` or `70%` works), as in the kit. `Intl` has no Hz, ms or dB unit: pass a render function, `<Knob.Value>{(formatted, value) => `${Math.round(value)} Hz`}</Knob.Value>`, and put the unit in `getAriaValueText` on the thumb. `format` and `locale` on the Root set the number format, so set `locale` to keep one decimal mark |
| `Meter.Root` | `value` and `peak` (one level per channel, in dB) or a live `source` (`createSource` of `{ levels, peaks }`, where `peaks` is optional), `min`, `max`, `clipThreshold` (default 0 dB: `data-clipping` never fires if the range stops below it), `warnThreshold`; `data-clipping` and `data-warning` on a channel |
| `Pad.Root`, `Pad.Item` | `columns`, `value`, `onPadOn(value, { velocity })` and `onPadOff(value)` for the strike; `data-active` and `--pad-velocity` while struck |
| `XYPad.Root` | `defaultValue={{ x, y }}` or `value`, `onValueChange`; `--xy-pad-x` and `--xy-pad-y` |

Signatures: `Knob.Value` and `Fader.Value` take a render function `(formatted, value) => ReactNode` (the Fader's receives arrays, one entry per thumb: `<Fader.Value>{(_formatted, [value]) => `${value.toFixed(1)} dB`}</Fader.Value>`), and `getAriaValueText(formatted, value) => string` goes on `Knob.Thumb`. To keep the readout and the announced text equal, write one `format(value)` and use it in both, and set `locale` on the Root (a French browser would announce "3,6" beside a readout of "3.6"). `Meter.Root` sets `data-clipping` from the level, not from the peak: style `.meter-channel[data-clipping] .meter-indicator`. The slider takes its name from `Knob.Label` or `Fader.Label` (the kit has one, so its Roots carry no `aria-label`), or from `aria-label` on `Knob.Thumb` or `Fader.Thumb`. An `aria-label` on the Root alone names a group, not the slider, so a test that looks for `getByRole("slider", { name })` finds nothing. Tests read the value with `inputValue()`.

Focus lands on the input nested in each thumb, so draw the ring on the thumb with `:has(:focus-visible)` (the kit does). The ring takes --focus, then the accent: when the accent is also the value color, set --focus to the ink so the ring does not disappear into the arc. A fader's `.fader-indicator` is the filled part of the slot: show it for a level, hide it (`display: none`) for a hairline or a hardware slot. Every fader and meter takes its length from one variable, --strip-h, set on the panel or on a strip.

## Controls beyond the kit's parts

- **Plot.Trace:** `source` holds one value per point, spread evenly across `minX` to `maxX`; without `fillTo` it is a line, with it an area. A linear axis works for any curve (a decay, an envelope), the log axis for a spectrum.
- **Waveform.Root:** `peaks` (amplitudes 0 to 1, or `{ min, max }` pairs), `value` (a fraction, or seconds with `duration`), `onValueChange(position, details)` to seek your audio, `onValueCommitted`, `range`, `source` for a live signal. The canvas reads `--waveform-color` and `--waveform-progress-color` as plain colors (a `color-mix()` or a gradient does not work there). Parts: `Control > Canvas`, `Playhead`, `Thumb`, `Region`, `Marker`, `Hover`. The `Bars` part is the DOM alternative to `Canvas`, with `count` (default 24) and `mirrored`.
- **Plot.Root:** `minX`, `maxX`, `minY`, `maxY`, `scaleX="log"`. Parts: `Graph` (the svg: children go inside it), `Line axis value`, `Trace source fillTo`, `Curve`, `Band`, `Handle`. `Plot.Root` has an inline `position: relative`, so size it with `height`.
- **Pad.Root:** `onPadOn` and `onPadOff` go on the Root. Only the first pad is in the tab order (arrow keys move between pads), so a test must Tab to it, then press Space or Enter.
- **Piano.Root:** `minPitch`, `maxPitch`, `onNoteOn(pitch, details)`, `onNoteOff(pitch, details)`, `activeNotes` (pitches held by something else, such as a computer keyboard). The black keys come before the white keys in the DOM.
- **Envelope.Root:** `defaultValue` or `value` as `{ x, y, curve? }[]` (both axes 0 to 1), `onValueChange(points, details)`, `minPoints`, `maxPoints`, `snap`, `locale` for the announced text. `Envelope.Points` takes a render function `(point, index) => <Envelope.Point index={index} aria-label />`.
- **Sequencer.Root:** `defaultValue` or `value` as `boolean[][]` (a row per sound, a list of steps), `onValueChange(pattern, details)`, `source` (a source of the playing step, `-1` for none), `velocities`. `Rows` and `Cells` take render functions, `Row` needs `index`, `Cell` needs `step`; a cell is a button with `aria-pressed`, `data-on` and `data-current`. `Row` is a grid `div` that forwards `data-*` and `aria-*`: label a row with `data-label` and `.sequencer-row::before { content: attr(data-label) }`. Drive the playing step with a writable source: `const step = createSource(-1)` (it has `set`), `step.set(n)` from the look-ahead loop at the time the note sounds (queue the step with its audio time and set it from `requestAnimationFrame` once `ctx.currentTime` passes), and `step.set(-1)` on stop.
- **XYPad:** name the axes with `aria-label` on `XYPad.Thumb` ("Filter X" and "Filter Y"), not on the Root.
- **Sizes:** a pad is a 4rem square with a 0.65rem label, so a long name needs a wider column and a smaller font on `.pad`; size one knob with `style={{ "--knob-size": "6rem" }}` on its Root.
- **A stepped selector** (an attack time of 7 settings): a `Knob` with `min={1} max={7} step={1}`, a `Knob.Mark` at each value with its numeral, and `getAriaValueText={(_, value) => names[value - 1]}` on the thumb to announce the setting. It needs no `Knob.Value`. Give the label a `margin-top` of 0.7rem so the first and last numerals do not sit on it, and 3.6rem between neighbors.
- **A VU for gain reduction:** the kit's needle goes left to right. For 0 on the right and a needle that falls as reduction grows, publish `1 - reduction / maxReduction`; draw ticks and numerals from the pivot and radius of the face (x = 50 + r·sin θ, y = 72 - r·cos θ, θ from -40 to 40 degrees). A backlit face is a radial gradient from a warm center to a darker edge on `.vu-face`, dimmed when the unit is off.
- **A choice of one in N** (a waveform, a mode): a `role="group"` of `.toggle` buttons with `aria-pressed`, as `ChoiceControl` does.
- **Meter zones:** the zone gradient puts amber at 60% and red at 85% of the strip. Compute the stops from the range (0 dB sits at `(0 - min) / (max - min)`: 88.9% for -48 to +6) and override the zone gradient and its dimming layer on your skin (see the the zone gradient lines of materials.css).
- **Tab stops:** a knob with an `editable` readout has two (the slider and the readout), so five knobs give ten. That is expected.
- **Printed numerals on a knob:** a span inside `Knob.Mark` turns with the mark and reads upside down: place it outside the tick (`position: absolute; top: -1.6rem; left: 50%; translate: -50% 0`) and give it `rotate: calc(var(--knob-mark-angle) * -1)`. On a log knob, `Knob.Mark` takes real values, so evenly spaced angles need a geometric series (20, 200, 2000). Keep 2.4rem or more between knobs so numerals do not touch the next one.
- **A writable source** is `WritableSource<T>` from `@audio-ui/react` (`Source` has no `set`); `subscribe(listener)` returns the remover.
- Importing CSS in TypeScript needs `declare module "*.css";` in a `.d.ts` file under `moduleResolution: "Bundler"`.

### Envelope points to ADSR times

The points are normalized, so choose how long a full envelope is, then read the five default points:

```ts
const SPAN = 4; // seconds for x from 0 to 1
const [, peak, sustain, hold] = points;
const attack = peak.x * SPAN;
const decay = (sustain.x - peak.x) * SPAN;
const level = sustain.y; // 0 to 1
const release = (1 - hold.x) * SPAN;
```

Start the voice with `gain.setValueAtTime(0, t)`, `linearRampToValueAtTime(1, t + attack)`, then `setTargetAtTime(level, t + attack, decay / 3)`; on release, `cancelScheduledValues` and `setTargetAtTime(0, now, release / 3)`.

## Printed scales

A fader or meter on a real panel has numbers beside it. A skin whose meter has padding (retro, tape, plugin, blackface) needs the same `margin-block` on the scale, or the labels sit off the channels. If the meter's top is 0 dB, the default zones are right as they are. Draw them as an `ol.scale` (give it a width, and put it in the same flex row as the control, next to the `Fader.Root`) next to the control, one `li` per mark, at `style={{ bottom: "<percent>%" }}` of the strip (the percent of the range, 0 at the bottom), with `aria-hidden="true"` because the control already announces its value.

## A mixer strip

Calibrate the meter to the signal: with a voice gain of 0.2 a normal level sits near -36 dB, so use a floor of -60 dB and a 0 dB reference, and say so on the scale. Give the fader and the meter of a strip the same range (-60 to +6 dB, say) and the same height (--strip-h), and put the printed `ol.scale` in the same row, at the same height as `.fader-control`: a label at `bottom: <percent>%` then sits on the thumb's center at that value. Override a skin from outside with a more specific selector (`.mixer .toggle[aria-pressed="true"]`), since the skin's own rule has the same weight as a bare class.

## Making a new direction

Do not start from a blank file: read [taste.md](./taste.md), then compose from `styles/materials.css`.

Copy a skin, rename its scope class, and change in this order: surface colors, the accent, type, then the parts' shapes. Keep one idea per direction ("brushed aluminium and orange", "paper and ink") and apply the rules of the `design-` section. Do not mix the kits' rules: a retro cap on a minimal panel looks like a mistake.
