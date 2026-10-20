import { Sequencer } from "@audio-ui/react/sequencer";
import { STEPS } from "./audio/patterns";
import { Dial, TEMPO } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { StepKnob } from "./ui/step-knob";
import { useSirius } from "./use-sirius";

const WAVES = ["Saw", "Square"] as const;
const STEP_INDEXES = Array.from({ length: STEPS }, (_, step) => step);
const ROWS = ["Gate", "Accent", "Slide"] as const;

/** Sirius-16: the panel. The sound is in `audio/`, what the panel keeps in `use-sirius.ts`. */
export default function Sirius16() {
  const sirius = useSirius();
  const { onParam, settings } = sirius;

  return (
    <div className="sirius-cabinet">
      <div className="sirius">
        <header className="sirius-header">
          <div>
            <h1 className="sirius-name">
              Sirius<span>-16</span>
            </h1>
            <p className="sirius-tagline">Bass line sequencer</p>
          </div>
          <Lcd
            onNext={sirius.next}
            onPrevious={sirius.previous}
            readout={sirius.readout}
            title={sirius.presetTitle}
          />
          <button
            aria-pressed={sirius.isPlaying}
            className="sirius-run"
            onClick={sirius.toggle}
            type="button"
          >
            <span
              aria-hidden="true"
              className="sirius-lamp"
              data-on={sirius.isPlaying || undefined}
            />
            {sirius.isPlaying ? "Stop" : "Run"}
          </button>
        </header>

        <div className="sirius-row">
          <Section title="Wave">
            <Selector
              label="Waveform"
              onChange={sirius.changeWave}
              options={WAVES}
              value={settings.wave}
            />
          </Section>
          <Section title="Voice">
            <div className="sirius-group">
              <Dial
                label="Cutoff"
                onParam={onParam}
                param="cutoff"
                value={settings.cutoff}
              />
              <Dial
                label="Reso"
                onParam={onParam}
                param="resonance"
                value={settings.resonance}
              />
              <Dial
                label="Env mod"
                onParam={onParam}
                param="envmod"
                value={settings.envmod}
              />
              <Dial
                label="Decay"
                onParam={onParam}
                param="decay"
                value={settings.decay}
              />
              <Dial
                label="Accent"
                onParam={onParam}
                param="accent"
                value={settings.accent}
              />
            </div>
          </Section>
          <Section title="Tempo">
            <Dial
              label="BPM"
              onParam={onParam}
              param="tempo"
              scale={TEMPO}
              value={sirius.bpm}
            />
          </Section>
          <Section title="Out">
            <Dial
              label="Volume"
              onParam={onParam}
              param="volume"
              value={sirius.volume}
            />
          </Section>
        </div>

        <div className="sirius-steps">
          <div className="sirius-pitches">
            <span className="sirius-row-label">Pitch</span>
            {STEP_INDEXES.map((step) => (
              <StepKnob
                key={step}
                onPitch={sirius.onPitch}
                step={step}
                value={sirius.pitches[step] ?? 0}
              />
            ))}
          </div>
          <Sequencer.Root
            aria-label="Steps"
            className="sirius-grid"
            onValueChange={sirius.setPattern}
            source={sirius.position}
            value={sirius.pattern}
          >
            <Sequencer.Rows>
              {(index) => (
                <Sequencer.Row
                  aria-label={ROWS[index]}
                  className="sirius-step-row"
                  index={index}
                >
                  <span aria-hidden="true" className="sirius-row-label">
                    {ROWS[index]}
                  </span>
                  <Sequencer.Cells>
                    {(step) => (
                      <Sequencer.Cell
                        aria-label={`${ROWS[index]}, step ${step + 1}`}
                        className="sirius-step"
                        data-row={index}
                        step={step}
                      />
                    )}
                  </Sequencer.Cells>
                </Sequencer.Row>
              )}
            </Sequencer.Rows>
          </Sequencer.Root>
          <ol aria-hidden="true" className="sirius-numbers">
            <li />
            {STEP_INDEXES.map((step) => (
              <li key={step}>{step + 1}</li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
