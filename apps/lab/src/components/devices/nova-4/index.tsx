import { Piano } from "@audio-ui/react/piano";
import { ALGORITHMS, OPERATORS } from "./audio/algorithms";
import { PRESETS } from "./audio/presets";
import { Dial } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { Membrane } from "./ui/membrane";
import { Operator } from "./ui/operator";
import { Section } from "./ui/section";
import { useNova } from "./use-nova";

const ALGORITHM_NUMBERS = ALGORITHMS.map((_, index) => index + 1);

/** Nova-4: the panel. The sound is in `audio/`, what the panel keeps in `use-nova.ts`. */
export default function Nova4() {
  const nova = useNova();
  const { onParam, patch } = nova;

  return (
    <div className="nova-cabinet">
      <div className="nova">
        <header className="nova-header">
          <div>
            <h1 className="nova-name">
              Nova<span>-4</span>
            </h1>
            <p className="nova-tagline">FM digital synthesizer</p>
          </div>
          <Lcd
            algorithm={nova.algorithm}
            readout={nova.readout}
            title={nova.presetTitle}
          />
        </header>

        <div className="nova-row">
          <Section title="Voice">
            <div aria-label="Voice" className="nova-membranes" role="group">
              {PRESETS.map((preset, index) => (
                <Membrane
                  color="teal"
                  index={index}
                  key={preset.name}
                  label={`Voice ${index + 1}, ${preset.name}`}
                  onSelect={nova.load}
                  selected={nova.preset === index}
                />
              ))}
            </div>
          </Section>
          <Section title="Algorithm">
            <div aria-label="Algorithm" className="nova-membranes" role="group">
              {ALGORITHM_NUMBERS.map((number) => (
                <Membrane
                  color="maroon"
                  index={number - 1}
                  key={number}
                  label={`Algorithm ${number}`}
                  onSelect={nova.changeAlgorithm}
                  selected={patch.algorithm === number}
                />
              ))}
            </div>
          </Section>
          <Section title="Feedback">
            <Dial
              label="Op 4"
              onParam={onParam}
              param="feedback"
              value={patch.feedback}
            />
          </Section>
        </div>

        <div className="nova-row">
          <div className="nova-operators">
            {OPERATORS.map((operator) => (
              <Operator
                carrier={nova.algorithm.carriers.includes(operator)}
                key={operator}
                onParam={onParam}
                operator={operator}
                patch={patch}
              />
            ))}
          </div>
          <div className="nova-globals">
            <Section title="Envelope">
              <div className="nova-group">
                <Dial
                  label="Attack"
                  onParam={onParam}
                  param="attack"
                  value={patch.attack}
                />
                <Dial
                  label="Release"
                  onParam={onParam}
                  param="release"
                  value={patch.release}
                />
              </div>
            </Section>
            <div className="nova-group">
              <Section title="LFO">
                <Dial
                  label="Vibrato"
                  onParam={onParam}
                  param="vibrato"
                  value={patch.vibrato}
                />
              </Section>
              <Section title="Out">
                <Dial
                  label="Volume"
                  onParam={onParam}
                  param="volume"
                  value={patch.volume}
                />
              </Section>
            </div>
          </div>
        </div>

        <Piano.Root
          activeNotes={nova.activeNotes}
          aria-label="Keyboard"
          className="nova-piano"
          maxPitch={84}
          minPitch={36}
          onNoteOff={nova.noteOff}
          onNoteOn={nova.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="nova-piano-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>
      </div>
    </div>
  );
}
