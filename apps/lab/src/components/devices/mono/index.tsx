import { Knob } from "@audio-ui/react/knob";
import { Piano } from "@audio-ui/react/piano";
import { useCallback, useEffect, useState } from "react";
import { createMonoEngine, type MonoSettings, type Wave } from "./engine.ts";

const WAVES: { label: string; value: Wave }[] = [
  { label: "Sine", value: "sine" },
  { label: "Triangle", value: "triangle" },
  { label: "Saw", value: "sawtooth" },
  { label: "Square", value: "square" },
];

const INITIAL: MonoSettings = {
  cutoff: 2400,
  release: 0.4,
  volume: -12,
  wave: "sawtooth",
};

const formatHertz = (value: number) => `${Math.round(value)} Hz`;
const formatSeconds = (value: number) => `${value.toFixed(2)} s`;
const formatDecibels = (value: number) => `${Math.round(value)} dB`;

function WaveButton({
  label,
  onSelect,
  pressed,
  value,
}: {
  label: string;
  onSelect: (value: Wave) => void;
  pressed: boolean;
  value: Wave;
}) {
  const select = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <button
      aria-pressed={pressed}
      className="mono-wave"
      onClick={select}
      type="button"
    >
      {label}
    </button>
  );
}

function Dial({
  format,
  label,
  max,
  min,
  onChange,
  scale,
  value,
}: {
  format: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  scale?: "log";
  value: number;
}) {
  return (
    <Knob.Root
      className="mono-knob"
      defaultValue={value}
      dragMode="vertical"
      max={max}
      min={min}
      onValueChange={onChange}
      scale={scale}
      step={scale ? 1 : 0.01}
    >
      <Knob.Control className="mono-knob-control">
        <Knob.Thumb className="mono-knob-thumb" />
      </Knob.Control>
      <Knob.Label className="mono-label">{label}</Knob.Label>
      <span aria-hidden="true" className="mono-readout">
        {format(value)}
      </span>
    </Knob.Root>
  );
}

export default function Mono() {
  const [settings, setSettings] = useState(INITIAL);
  const [engine] = useState(() => createMonoEngine(INITIAL));
  useEffect(() => () => engine.dispose(), [engine]);

  const change = useCallback(
    <Key extends keyof MonoSettings>(key: Key, value: MonoSettings[Key]) => {
      engine.set(key, value);
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [engine]
  );
  const onWave = useCallback((v: Wave) => change("wave", v), [change]);
  const onCutoff = useCallback((v: number) => change("cutoff", v), [change]);
  const onRelease = useCallback((v: number) => change("release", v), [change]);
  const onVolume = useCallback((v: number) => change("volume", v), [change]);

  return (
    <div className="mono-stage">
      <div className="mono">
        <header className="mono-header">
          <h1 className="mono-title">Mono</h1>
          <p className="mono-subtitle">One oscillator, one filter.</p>
        </header>

        <div aria-label="Wave" className="mono-waves" role="group">
          {WAVES.map((wave) => (
            <WaveButton
              key={wave.value}
              label={wave.label}
              onSelect={onWave}
              pressed={settings.wave === wave.value}
              value={wave.value}
            />
          ))}
        </div>

        <div className="mono-knobs">
          <Dial
            format={formatHertz}
            label="Cutoff"
            max={12_000}
            min={80}
            onChange={onCutoff}
            scale="log"
            value={settings.cutoff}
          />
          <Dial
            format={formatSeconds}
            label="Release"
            max={2}
            min={0.05}
            onChange={onRelease}
            value={settings.release}
          />
          <Dial
            format={formatDecibels}
            label="Volume"
            max={0}
            min={-36}
            onChange={onVolume}
            value={settings.volume}
          />
        </div>

        <Piano.Root
          aria-label="Keyboard"
          className="mono-piano"
          maxPitch={72}
          minPitch={48}
          onNoteOff={engine.noteOff}
          onNoteOn={engine.noteOn}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="mono-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>
      </div>
    </div>
  );
}
