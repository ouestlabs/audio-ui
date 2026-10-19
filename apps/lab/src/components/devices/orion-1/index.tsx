import { Fader } from "@audio-ui/react/fader";
import { Knob } from "@audio-ui/react/knob";
import { Piano } from "@audio-ui/react/piano";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react/ssr";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useMasterBus } from "@/hooks/use-master-bus";
import {
  createOrionEngine,
  type Param,
  volumeGain,
  type Wave,
} from "./engine.ts";
import { type Patch, PRESETS, patchOf } from "./presets.ts";

type Cap = "black" | "ivory" | "orange";

const DIAL_MARKS = Array.from({ length: 11 }, (_, value) => value);
const NUMERALS = new Set([0, 5, 10]);
const WAVES: Wave[] = ["Tri", "Saw", "Square", "Pulse"];
const ENVELOPE: { label: string; param: Param }[] = [
  { label: "A", param: "attack" },
  { label: "D", param: "decay" },
  { label: "S", param: "sustain" },
  { label: "R", param: "release" },
];

type Knobbed = Param | "volume";
type OnParam = (param: Knobbed, value: number) => void;

/** What the LCD calls each control it reads out. */
const NAMES: Record<Knobbed, string> = {
  attack: "Attack",
  contour: "Contour",
  cutoff: "Cutoff",
  decay: "Decay",
  depth: "Depth",
  glide: "Glide",
  noise: "Noise",
  osc: "Osc",
  rate: "Rate",
  release: "Release",
  resonance: "Resonance",
  sub: "Sub",
  sustain: "Sustain",
  tune: "Tune",
  volume: "Volume",
  width: "Width",
};

function Dial({
  cap = "black",
  label,
  onParam,
  param,
  size = "md",
  value,
}: {
  cap?: Cap;
  label: string;
  onParam: OnParam;
  param: Knobbed;
  size?: "lg" | "md" | "sm";
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Knob.Root
      className="knob"
      data-cap={cap}
      data-size={size}
      dragMode="vertical"
      largeStep={2}
      max={10}
      min={0}
      onValueChange={change}
      step={1}
      value={value}
    >
      <Knob.Control className="knob-control">
        <Knob.Thumb className="knob-thumb" />
        {DIAL_MARKS.map((mark) => (
          <Knob.Mark className="knob-mark" key={mark} value={mark}>
            <span className="knob-tick" />
            {NUMERALS.has(mark) && <span className="knob-numeral">{mark}</span>}
          </Knob.Mark>
        ))}
      </Knob.Control>
      <Knob.Label className="knob-label">{label}</Knob.Label>
    </Knob.Root>
  );
}

function Slider({
  label,
  onParam,
  param,
  value,
}: {
  label: string;
  onParam: OnParam;
  param: Param;
  value: number;
}) {
  const change = useCallback(
    (next: number) => onParam(param, next),
    [onParam, param]
  );
  return (
    <Fader.Root
      className="fader"
      max={10}
      min={0}
      onValueChange={change}
      orientation="vertical"
      step={0.1}
      value={value}
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

const LAST_PRESET = PRESETS.length - 1;
const pad = (n: number) => String(n + 1).padStart(2, "0");

export default function Orion1() {
  const [power, setPower] = useState(true);
  const [preset, setPreset] = useState(0);
  const [patch, setPatch] = useState<Patch>(() => patchOf(0));
  const [touched, setTouched] = useState<Knobbed | null>(null);
  const [held, setHeld] = useState(0);
  const [engine] = useState(() => createOrionEngine());

  // The shared context's bus: the master level and a safety limiter.
  const bus = useMasterBus(volumeGain(patch.volume));
  useEffect(() => {
    if (!bus) {
      return;
    }
    engine.attach(bus);
    return () => engine.detach();
  }, [bus, engine]);

  const togglePower = useCallback(() => {
    setPower((on) => {
      engine.setPower(!on);
      return !on;
    });
  }, [engine]);

  /** A control moved: the engine follows, and the LCD reads it out. */
  const onParam = useCallback<OnParam>(
    (param, value) => {
      setPatch((current) => ({ ...current, [param]: value }));
      setTouched(param);
      if (param !== "volume") {
        engine.set(param, value);
      }
    },
    [engine]
  );
  const changeWave = useCallback(
    (value: string) => {
      setPatch((current) => ({ ...current, wave: value as Wave }));
      setTouched(null);
      engine.set("wave", value as Wave);
    },
    [engine]
  );

  /** A preset loads every control at once, the engine included. */
  const load = useCallback(
    (index: number) => {
      const next = patchOf(index);
      setPreset(index);
      setPatch(next);
      setTouched(null);
      for (const [key, value] of Object.entries(next)) {
        if (key !== "volume") {
          engine.set(
            key as (keyof typeof next & Param) | "wave",
            value as never
          );
        }
      }
    },
    [engine]
  );
  const previous = useCallback(
    () => load(preset === 0 ? LAST_PRESET : preset - 1),
    [load, preset]
  );
  const next = useCallback(
    () => load(preset === LAST_PRESET ? 0 : preset + 1),
    [load, preset]
  );

  const noteOn = useCallback(
    (pitch: number) => {
      setHeld((count) => count + 1);
      engine.noteOn(pitch);
    },
    [engine]
  );
  const noteOff = useCallback(
    (pitch: number) => {
      setHeld((count) => Math.max(0, count - 1));
      engine.noteOff(pitch);
    },
    [engine]
  );

  return (
    <div className="synth-cabinet">
      <div className="synth" data-power={power || undefined}>
        <header className="synth-header">
          <h1 className="synth-name">
            Orion<span>-1</span>
          </h1>
          <div className="lcd-bar">
            <button
              aria-label="Previous preset"
              className="lcd-button"
              onClick={previous}
              type="button"
            >
              <CaretLeftIcon aria-hidden="true" weight="bold" />
            </button>
            <div className="lcd">
              {/* The preset is what a screen reader hears; the readout under it is for the eyes. */}
              <p className="lcd-line" role="status">
                {pad(preset)} {PRESETS[preset]?.name}
              </p>
              <p aria-hidden="true" className="lcd-line lcd-dim">
                {touched
                  ? `${NAMES[touched]} ${Math.round(patch[touched])}`
                  : patch.wave}
              </p>
            </div>
            <button
              aria-label="Next preset"
              className="lcd-button"
              onClick={next}
              type="button"
            >
              <CaretRightIcon aria-hidden="true" weight="bold" />
            </button>
          </div>
          <div className="synth-power">
            <span
              aria-hidden="true"
              className="lamp"
              data-on={(power && held > 0) || undefined}
            />
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
          <Section title="Wave">
            <Selector
              label="Waveform"
              onChange={changeWave}
              options={WAVES}
              value={patch.wave}
            />
          </Section>

          <Section title="Filter">
            <div className="group">
              <Dial
                cap="orange"
                label="Cutoff"
                onParam={onParam}
                param="cutoff"
                size="lg"
                value={patch.cutoff}
              />
              <Dial
                cap="orange"
                label="Reso"
                onParam={onParam}
                param="resonance"
                size="md"
                value={patch.resonance}
              />
              <Dial
                cap="orange"
                label="Contour"
                onParam={onParam}
                param="contour"
                size="md"
                value={patch.contour}
              />
            </div>
          </Section>

          <Section title="Envelope">
            <div className="group">
              {ENVELOPE.map((stage) => (
                <Slider
                  key={stage.param}
                  label={stage.label}
                  onParam={onParam}
                  param={stage.param}
                  value={patch[stage.param]}
                />
              ))}
            </div>
          </Section>

          <Section title="Out">
            <Dial
              cap="black"
              label="Volume"
              onParam={onParam}
              param="volume"
              size="lg"
              value={patch.volume}
            />
          </Section>
        </div>

        <Piano.Root
          aria-label="Keyboard"
          className="piano"
          maxPitch={71}
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
      </div>
    </div>
  );
}
