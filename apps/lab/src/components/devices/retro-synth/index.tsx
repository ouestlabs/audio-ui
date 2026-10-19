import { Fader } from "@audio-ui/react/fader";
import { Knob } from "@audio-ui/react/knob";
import { Piano } from "@audio-ui/react/piano";
import { type ReactNode, useCallback, useState } from "react";

type Cap = "black" | "ivory" | "orange";

const DIAL_MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);
const WAVES = ["Tri", "Saw", "Square", "Pulse"];
const OCTAVES = ["32'", "16'", "8'", "4'"];
const ENVELOPE = ["A", "D", "S", "R"];

function Dial({
  cap = "black",
  defaultValue = 5,
  label,
  size = "md",
}: {
  cap?: Cap;
  defaultValue?: number;
  label: string;
  size?: "lg" | "md" | "sm";
}) {
  return (
    <Knob.Root
      className="knob"
      data-cap={cap}
      data-size={size}
      defaultValue={defaultValue}
      dragMode="vertical"
      max={10}
      min={0}
      step={0.1}
    >
      <Knob.Control className="knob-control">
        <Knob.Thumb className="knob-thumb" />
        {DIAL_MARKS.map((value) => (
          <Knob.Mark className="knob-mark" key={value} value={value}>
            <span className="knob-tick" />
            {NUMERALS.has(value) && (
              <span className="knob-numeral">{value}</span>
            )}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}

function Slider({
  defaultValue,
  label,
}: {
  defaultValue: number;
  label: string;
}) {
  return (
    <Fader.Root
      className="fader"
      defaultValue={defaultValue}
      max={10}
      min={0}
      orientation="vertical"
      step={0.1}
    >
      <Fader.Control className="fader-control">
        <Fader.Track className="fader-track" />
        <Fader.Thumb className="fader-thumb" />
      </Fader.Control>
      <Fader.Label className="knob-label">{label}</Fader.Label>
    </Fader.Root>
  );
}

function Rocker({
  active,
  onSelect,
  option,
}: {
  active: boolean;
  onSelect: (option: string) => void;
  option: string;
}) {
  const select = useCallback(() => onSelect(option), [onSelect, option]);
  return (
    <button
      aria-pressed={active}
      className="rocker"
      onClick={select}
      type="button"
    >
      <span aria-hidden="true" className="lamp" data-on={active || undefined} />
      {option}
    </button>
  );
}

// A choice among a few stops: buttons with aria-pressed, each with the lamp that lights when chosen.
function Selector({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  value: string;
}) {
  return (
    <div aria-label={label} className="selector" role="group">
      {options.map((option) => (
        <Rocker
          active={value === option}
          key={option}
          onSelect={onChange}
          option={option}
        />
      ))}
    </div>
  );
}

function Section({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section className={className ? `section ${className}` : "section"}>
      <h2 className="legend">{title}</h2>
      {children}
    </section>
  );
}

export default function RetroSynth() {
  const [power, setPower] = useState(true);
  const [wave, setWave] = useState("Saw");
  const [octave, setOctave] = useState("8'");
  const [held, setHeld] = useState(0);
  const togglePower = useCallback(() => setPower((on) => !on), []);
  const noteOn = useCallback(() => setHeld((count) => count + 1), []);
  const noteOff = useCallback(
    () => setHeld((count) => Math.max(0, count - 1)),
    []
  );

  return (
    <div className="synth-cabinet">
      <div className="synth" data-power={power || undefined}>
        <span aria-hidden="true" className="screw screw-tl" />
        <span aria-hidden="true" className="screw screw-tr" />
        <header className="synth-header">
          <h1 className="synth-name">
            Orion<span>-1</span>
          </h1>
          <p className="synth-tagline">Monophonic analog synthesizer</p>
          <div className="synth-power">
            <span
              aria-hidden="true"
              className="lamp"
              data-on={(power && held > 0) || undefined}
            />
            <span className="synth-power-note">Gate</span>
            <button
              aria-pressed={power}
              className="power"
              onClick={togglePower}
              type="button"
            >
              <span
                aria-hidden="true"
                className="lamp"
                data-on={power || undefined}
              />
              Power
            </button>
          </div>
        </header>

        <div className="synth-row">
          <Section title="Oscillator">
            <div className="group">
              <Selector
                label="Range"
                onChange={setOctave}
                options={OCTAVES}
                value={octave}
              />
              <Selector
                label="Waveform"
                onChange={setWave}
                options={WAVES}
                value={wave}
              />
            </div>
            <div className="group">
              <Dial cap="ivory" defaultValue={5} label="Tune" size="sm" />
              <Dial cap="ivory" defaultValue={2} label="Glide" size="sm" />
              <Dial
                cap="ivory"
                defaultValue={7}
                label="Pulse width"
                size="sm"
              />
            </div>
          </Section>

          <Section title="Mixer">
            <div className="group">
              <Dial cap="ivory" defaultValue={8} label="Osc" size="md" />
              <Dial cap="ivory" defaultValue={4} label="Sub" size="md" />
              <Dial cap="ivory" defaultValue={1} label="Noise" size="md" />
            </div>
          </Section>

          <Section title="Filter">
            <div className="group">
              <Dial cap="orange" defaultValue={6} label="Cutoff" size="lg" />
              <Dial cap="orange" defaultValue={3} label="Resonance" size="md" />
              <Dial cap="orange" defaultValue={5} label="Contour" size="md" />
            </div>
          </Section>
        </div>

        <div className="synth-row">
          <Section title="Modulation">
            <div className="group">
              <Dial cap="black" defaultValue={3} label="Rate" size="md" />
              <Dial cap="black" defaultValue={0} label="Depth" size="md" />
            </div>
          </Section>

          <Section className="section-envelope" title="Envelope">
            <div className="group">
              {ENVELOPE.map((stage, index) => (
                <Slider
                  defaultValue={[1, 4, 7, 3][index] ?? 5}
                  key={stage}
                  label={stage}
                />
              ))}
            </div>
          </Section>

          <Section title="Output">
            <div className="group">
              <Dial cap="black" defaultValue={7} label="Volume" size="lg" />
            </div>
          </Section>
        </div>

        <Piano.Root
          aria-label="Keyboard"
          className="piano"
          maxPitch={83}
          minPitch={48}
          onNoteOff={noteOff}
          onNoteOn={noteOn}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="piano-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>

        <span aria-hidden="true" className="screw screw-bl" />
        <span aria-hidden="true" className="screw screw-br" />
      </div>
    </div>
  );
}
