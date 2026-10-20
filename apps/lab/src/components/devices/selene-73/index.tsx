import { Piano } from "@audio-ui/react/piano";
import type { Param } from "./audio/engine";
import { PRESETS } from "./audio/presets";
import { Dial } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { PatchKey } from "./ui/patch-key";
import { Section } from "./ui/section";
import { useSelene } from "./use-selene";

const TONE: { label: string; param: Param }[] = [
  { label: "Bark", param: "bark" },
  { label: "Bell", param: "bell" },
  { label: "Decay", param: "decay" },
];
const TREMOLO: { label: string; param: Param }[] = [
  { label: "Rate", param: "rate" },
  { label: "Depth", param: "depth" },
];

/** Selene-73: the panel. The sound is in `audio/`, what the panel keeps in `use-selene.ts`. */
export default function Selene73() {
  const selene = useSelene();
  const { onParam, patch } = selene;

  return (
    <div className="selene-cabinet">
      <div className="selene">
        <header className="selene-header">
          <div>
            <h1 className="selene-name">
              Selene<span>-73</span>
            </h1>
            <p className="selene-tagline">Electric piano</p>
          </div>
          <Lcd readout={selene.readout} title={selene.presetTitle} />
          <div aria-label="Patch" className="selene-patches" role="group">
            {PRESETS.map((preset, index) => (
              <PatchKey
                index={index}
                key={preset.name}
                name={preset.name}
                onSelect={selene.load}
                selected={selene.preset === index}
              />
            ))}
          </div>
        </header>

        <div className="selene-row">
          <Section color="red" title="Tine">
            <div className="selene-group">
              {TONE.map((knob) => (
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
          <Section color="green" title="Pickup">
            <Dial
              label="Drive"
              onParam={onParam}
              param="drive"
              value={patch.drive}
            />
          </Section>
          <Section color="blue" title="Tremolo">
            <div className="selene-group">
              {TREMOLO.map((knob) => (
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
          <Section color="orange" title="Out">
            <Dial
              label="Volume"
              onParam={onParam}
              param="volume"
              value={patch.volume}
            />
          </Section>
        </div>

        <Piano.Root
          activeNotes={selene.activeNotes}
          aria-label="Keyboard"
          className="selene-piano"
          maxPitch={84}
          minPitch={36}
          onNoteOff={selene.noteOff}
          onNoteOn={selene.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key
                className="selene-piano-key"
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
