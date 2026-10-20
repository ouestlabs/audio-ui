import { Piano } from "@audio-ui/react/piano";
import type { Param } from "./audio/engine";
import { PRESETS } from "./audio/presets";
import { Dial } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { PatchKey } from "./ui/patch-key";
import { Section } from "./ui/section";
import { Slider } from "./ui/slider";
import { useCastor } from "./use-castor";

const REGISTERS: { label: string; param: Param }[] = [
  { label: "Violin", param: "violin" },
  { label: "Viola", param: "viola" },
  { label: "Cello", param: "cello" },
  { label: "Bass", param: "bass" },
];
const BOW: { label: string; param: Param }[] = [
  { label: "Attack", param: "attack" },
  { label: "Release", param: "release" },
  { label: "Bright", param: "bright" },
];

/** Castor-4: the panel. The sound is in `audio/`, what the panel keeps in `use-castor.ts`. */
export default function Castor4() {
  const castor = useCastor();
  const { onParam, patch } = castor;

  return (
    <div className="castor-cabinet">
      <div className="castor">
        <header className="castor-header">
          <div>
            <h1 className="castor-name">
              Castor<span>-4</span>
            </h1>
            <p className="castor-tagline">String machine</p>
          </div>
          <Lcd readout={castor.readout} title={castor.presetTitle} />
          <div
            aria-label="Registration"
            className="castor-patches"
            role="group"
          >
            {PRESETS.map((preset, index) => (
              <PatchKey
                index={index}
                key={preset.name}
                name={preset.name}
                onSelect={castor.load}
                selected={castor.preset === index}
              />
            ))}
          </div>
        </header>

        <div className="castor-row">
          <Section color="red" title="Registers">
            <div className="castor-group">
              {REGISTERS.map((slider) => (
                <Slider
                  key={slider.param}
                  label={slider.label}
                  onParam={onParam}
                  param={slider.param}
                  value={patch[slider.param]}
                />
              ))}
            </div>
          </Section>
          <Section color="orange" title="Bow">
            <div className="castor-group">
              {BOW.map((knob) => (
                <Dial
                  key={knob.param}
                  label={knob.label}
                  onParam={onParam}
                  param={knob.param}
                  value={patch[knob.param]}
                />
              ))}
            </div>
          </Section>
          <Section color="green" title="Ensemble">
            <Dial
              label="Depth"
              onParam={onParam}
              param="ensemble"
              value={patch.ensemble}
            />
          </Section>
          <Section color="blue" title="Out">
            <Dial
              label="Volume"
              onParam={onParam}
              param="volume"
              value={patch.volume}
            />
          </Section>
        </div>

        <Piano.Root
          activeNotes={castor.activeNotes}
          aria-label="Keyboard"
          className="castor-piano"
          maxPitch={84}
          minPitch={36}
          onNoteOff={castor.noteOff}
          onNoteOn={castor.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key
                className="castor-piano-key"
                key={pitch}
                pitch={pitch}
              />
            )}
          </Piano.Keys>
        </Piano.Root>
      </div>
    </div>
  );
}
