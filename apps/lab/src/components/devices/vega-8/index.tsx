import { Sequencer } from "@audio-ui/react/sequencer";
import { INSTRUMENTS } from "./audio/engine";
import { STEPS } from "./audio/patterns";
import { Dial, type Scale } from "./ui/dial";
import { InstrumentKey } from "./ui/instrument-key";
import { Lcd } from "./ui/lcd";
import { CONTROLS, NAMES } from "./ui/params";
import { Section } from "./ui/section";
import { useVega } from "./use-vega";

const TEMPO: Scale = {
  marks: [60, 80, 100, 120, 140, 160, 180],
  max: 180,
  min: 60,
  numerals: [60, 120, 180],
};
const NUMBERS = Array.from({ length: STEPS }, (_, step) => step + 1);

/** Vega-8: the panel. The sound is in `audio/`, what the panel keeps in `use-vega.ts`. */
export default function Vega8() {
  const vega = useVega();
  const row = INSTRUMENTS.indexOf(vega.selected);
  const name = NAMES[vega.selected];

  return (
    <div className="vega-cabinet">
      <div className="vega" data-playing={vega.isPlaying || undefined}>
        <header className="vega-header">
          <div>
            <h1 className="vega-name">
              Vega<span>-8</span>
            </h1>
            <p className="vega-tagline">Rhythm composer</p>
          </div>
          <Lcd
            onNext={vega.next}
            onPrevious={vega.previous}
            readout={vega.readout}
            title={vega.presetTitle}
          />
          <button
            aria-pressed={vega.isPlaying}
            className="vega-start"
            onClick={vega.toggle}
            type="button"
          >
            <span
              aria-hidden="true"
              className="vega-lamp"
              data-on={vega.isPlaying || undefined}
            />
            {vega.isPlaying ? "Stop" : "Start"}
          </button>
        </header>

        <div className="vega-row">
          <Section title="Tempo">
            <Dial
              label="BPM"
              onParam={vega.onParam}
              param="tempo"
              scale={TEMPO}
              size="lg"
              value={vega.bpm}
            />
          </Section>

          <Section title={name.long}>
            <div className="vega-group">
              {CONTROLS.map(({ control, label }) => (
                <Dial
                  key={control}
                  label={label}
                  onParam={vega.onParam}
                  param={control}
                  value={vega.kit[vega.selected][control]}
                />
              ))}
            </div>
          </Section>

          <Section title="Master">
            <Dial
              label="Volume"
              onParam={vega.onParam}
              param="volume"
              size="lg"
              value={vega.volume}
            />
          </Section>
        </div>

        <div className="vega-steps">
          <Sequencer.Root
            aria-label={`${name.long} pattern`}
            className="vega-grid"
            onValueChange={vega.setPattern}
            source={vega.position}
            value={vega.pattern}
          >
            <Sequencer.Rows>
              {(index) =>
                index === row ? (
                  <Sequencer.Row
                    aria-label={name.long}
                    className="vega-step-row"
                    index={index}
                  >
                    <Sequencer.Cells>
                      {(step) => (
                        <Sequencer.Cell
                          aria-label={`${name.long}, step ${step + 1}`}
                          className="vega-step"
                          data-group={Math.floor(step / 4)}
                          step={step}
                        />
                      )}
                    </Sequencer.Cells>
                  </Sequencer.Row>
                ) : null
              }
            </Sequencer.Rows>
          </Sequencer.Root>
          <ol aria-hidden="true" className="vega-numbers">
            {NUMBERS.map((number) => (
              <li key={number}>{number}</li>
            ))}
          </ol>
        </div>

        <div aria-label="Instrument" className="vega-instruments" role="group">
          {INSTRUMENTS.map((instrument, index) => (
            <InstrumentKey
              filled={vega.pattern[index]?.includes(true) ?? false}
              instrument={instrument}
              key={instrument}
              onSelect={vega.select}
              selected={vega.selected === instrument}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
