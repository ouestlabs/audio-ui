import { Piano } from "@audio-ui/react/piano";
import type { Param, Wave } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { Slider } from "./ui/slider";
import { useOrion } from "./use-orion";

const WAVES: Wave[] = ["Tri", "Saw", "Square", "Pulse"];
const ENVELOPE: { label: string; param: Param }[] = [
  { label: "A", param: "attack" },
  { label: "D", param: "decay" },
  { label: "S", param: "sustain" },
  { label: "R", param: "release" },
];

/** Orion-1: the panel. The sound is in `audio/`, what the panel keeps in `use-orion.ts`. */
export default function Orion1() {
  const orion = useOrion();
  const { onParam, patch, power } = orion;

  return (
    <div className="synth-cabinet">
      <div className="synth" data-power={power || undefined}>
        <header className="synth-header">
          <h1 className="synth-name">
            Orion<span>-1</span>
          </h1>
          <Lcd
            onNext={orion.next}
            onPrevious={orion.previous}
            readout={orion.readout}
            title={orion.presetTitle}
          />
          <div className="synth-power">
            <span
              aria-hidden="true"
              className="lamp"
              data-on={(power && orion.held > 0) || undefined}
            />
            <button
              aria-pressed={power}
              className="power"
              onClick={orion.togglePower}
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
              onChange={orion.changeWave}
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
          activeNotes={orion.activeNotes}
          aria-label="Keyboard"
          className="piano"
          maxPitch={83}
          minPitch={48}
          onNoteOff={orion.noteOff}
          onNoteOn={orion.pressKey}
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
