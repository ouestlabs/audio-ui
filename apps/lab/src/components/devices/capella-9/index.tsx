import { Piano } from "@audio-ui/react/piano";
import { FOOTAGES } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Drawbar } from "./ui/drawbar";
import { CAPS } from "./ui/params";
import { PresetKey } from "./ui/preset-key";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { useCapella } from "./use-capella";

const SPEEDS = ["Stop", "Slow", "Fast"] as const;
const ONOFF = ["Off", "On"] as const;
const HARMONICS = ["2nd", "3rd"] as const;
const DECAYS = ["Fast", "Slow"] as const;

/** Capella-9: the panel. The sound is in `audio/`, what the panel keeps in `use-capella.ts`. */
export default function Capella9() {
  const capella = useCapella();
  const { onKnob, patch } = capella;

  return (
    <div className="capella-cabinet">
      <div className="capella">
        <header className="capella-header">
          <div>
            <h1 className="capella-name">
              Capella<span>-9</span>
            </h1>
            <p className="capella-tagline">Tonewheel organ</p>
          </div>
          <output aria-label="Registration" className="capella-registration">
            {capella.registration}
          </output>
          <div aria-label="Preset" className="capella-presets" role="group">
            {capella.presets.map((preset, index) => (
              <PresetKey
                index={index}
                key={preset.name}
                name={preset.name}
                onSelect={capella.load}
                selected={capella.preset === index}
              />
            ))}
          </div>
        </header>

        <div className="capella-row">
          <Section title="Drawbars">
            <div className="capella-drawbars">
              {FOOTAGES.map((footage, index) => (
                <Drawbar
                  cap={CAPS[index] ?? "white"}
                  index={index}
                  key={footage.label}
                  label={footage.label}
                  level={patch.drawbars[index] ?? 0}
                  onDrawbar={capella.onDrawbar}
                />
              ))}
            </div>
          </Section>

          <div className="capella-switches">
            <Section title="Percussion">
              <div className="capella-stack">
                <Selector
                  label="Percussion"
                  onChange={capella.setPercussion}
                  options={ONOFF}
                  value={patch.percussion ? "On" : "Off"}
                />
                <Selector
                  label="Harmonic"
                  onChange={capella.setHarmonic}
                  options={HARMONICS}
                  value={patch.harmonic}
                />
                <Selector
                  label="Decay"
                  onChange={capella.setDecay}
                  options={DECAYS}
                  value={patch.decay}
                />
              </div>
            </Section>
            <Section title="Rotary speaker">
              <Selector
                label="Speaker"
                onChange={capella.setLeslie}
                options={SPEEDS}
                value={patch.leslie}
              />
            </Section>
          </div>

          <div className="capella-knobs">
            <Section title="Tone">
              <div className="capella-group">
                <Dial
                  knob="drive"
                  label="Drive"
                  onKnob={onKnob}
                  value={patch.drive}
                />
                <Dial
                  knob="click"
                  label="Click"
                  onKnob={onKnob}
                  value={patch.click}
                />
              </div>
            </Section>
            <Section title="Out">
              <Dial
                knob="volume"
                label="Volume"
                onKnob={onKnob}
                value={patch.volume}
              />
            </Section>
          </div>
        </div>

        <Piano.Root
          activeNotes={capella.activeNotes}
          aria-label="Keyboard"
          className="capella-piano"
          maxPitch={83}
          minPitch={36}
          onNoteOff={capella.noteOff}
          onNoteOn={capella.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key
                className="capella-piano-key"
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
