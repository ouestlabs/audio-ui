import { Sequencer } from "@audio-ui/react/sequencer";
import { INSTRUMENTS } from "./audio/engine";
import { STEPS } from "./audio/patterns";
import { Dial, type Scale } from "./ui/dial";
import { InstrumentKey } from "./ui/instrument-key";
import { Lcd } from "./ui/lcd";
import { BASS_CONTROLS, CONTROLS, NAMES } from "./ui/params";
import { Section } from "./ui/section";
import { StepKnob } from "./ui/step-knob";
import { useMira } from "./use-mira";

const TEMPO: Scale = {
  marks: [60, 80, 100, 120, 140, 160, 180],
  max: 180,
  min: 60,
  numerals: [60, 120, 180],
};
const STEP_INDEXES = Array.from({ length: STEPS }, (_, step) => step);
const BASS_ROWS = ["gate", "accent"] as const;
const BASS_GATE = INSTRUMENTS.length;

/** Mira-16: the panel. The sound is in `audio/`, what the panel keeps in `use-mira.ts`. */
export default function Mira16() {
  const mira = useMira();
  const row = INSTRUMENTS.indexOf(mira.selected);
  const name = NAMES[mira.selected];

  return (
    <div className="mira-cabinet">
      <div className="mira" data-playing={mira.isPlaying || undefined}>
        <header className="mira-header">
          <div>
            <h1 className="mira-name">
              Mira<span>-16</span>
            </h1>
            <p className="mira-tagline">Groovebox</p>
          </div>
          <Lcd
            onNext={mira.next}
            onPrevious={mira.previous}
            readout={mira.readout}
            title={mira.presetTitle}
          />
          <button
            aria-pressed={mira.isPlaying}
            className="mira-start"
            onClick={mira.toggle}
            type="button"
          >
            <span
              aria-hidden="true"
              className="mira-lamp"
              data-on={mira.isPlaying || undefined}
            />
            {mira.isPlaying ? "Stop" : "Start"}
          </button>
        </header>

        <div className="mira-row">
          <Section title="Tempo">
            <Dial
              label="BPM"
              onParam={mira.onParam}
              param="tempo"
              scale={TEMPO}
              size="lg"
              value={mira.bpm}
            />
          </Section>

          <Section title={name.long}>
            <div className="mira-group">
              {CONTROLS.map(({ control, label }) => (
                <Dial
                  key={control}
                  label={label}
                  onParam={mira.onParam}
                  param={control}
                  value={mira.kit[mira.selected][control]}
                />
              ))}
            </div>
          </Section>

          <Section title="Bass">
            <div className="mira-group">
              {BASS_CONTROLS.map(({ control, label }) => (
                <Dial
                  key={control}
                  label={label}
                  onParam={mira.onParam}
                  param={control}
                  value={mira.bass[control]}
                />
              ))}
            </div>
          </Section>

          <Section title="Master">
            <Dial
              label="Volume"
              onParam={mira.onParam}
              param="volume"
              size="lg"
              value={mira.volume}
            />
          </Section>
        </div>

        <div className="mira-steps">
          <Sequencer.Root
            aria-label={`${name.long} pattern`}
            className="mira-grid"
            onValueChange={mira.setPattern}
            source={mira.position}
            value={mira.pattern}
          >
            <Sequencer.Rows>
              {(index) => {
                if (index === row) {
                  return (
                    <Sequencer.Row
                      aria-label={name.long}
                      className="mira-step-row"
                      index={index}
                    >
                      <Sequencer.Cells>
                        {(step) => (
                          <Sequencer.Cell
                            aria-label={`${name.long}, step ${step + 1}`}
                            className="mira-step"
                            data-group={Math.floor(step / 4)}
                            step={step}
                          />
                        )}
                      </Sequencer.Cells>
                    </Sequencer.Row>
                  );
                }
                if (index < BASS_GATE) {
                  return null;
                }
                const label = BASS_ROWS[index - BASS_GATE];
                return (
                  <Sequencer.Row
                    aria-label={`Bass ${label}`}
                    className="mira-step-row mira-bass-row"
                    index={index}
                  >
                    <Sequencer.Cells>
                      {(step) => (
                        <Sequencer.Cell
                          aria-label={`Bass ${label}, step ${step + 1}`}
                          className="mira-bass-step"
                          data-accent={index === BASS_GATE + 1 || undefined}
                          step={step}
                        />
                      )}
                    </Sequencer.Cells>
                  </Sequencer.Row>
                );
              }}
            </Sequencer.Rows>
          </Sequencer.Root>
          <div className="mira-pitches">
            {STEP_INDEXES.map((step) => (
              <StepKnob
                key={step}
                onPitch={mira.onPitch}
                step={step}
                value={mira.pitches[step] ?? 0}
              />
            ))}
          </div>
          <ol aria-hidden="true" className="mira-numbers">
            {STEP_INDEXES.map((step) => (
              <li key={step}>{step + 1}</li>
            ))}
          </ol>
        </div>

        <div aria-label="Instrument" className="mira-instruments" role="group">
          {INSTRUMENTS.map((instrument, index) => (
            <InstrumentKey
              filled={mira.pattern[index]?.includes(true) ?? false}
              instrument={instrument}
              key={instrument}
              onSelect={mira.select}
              selected={mira.selected === instrument}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
