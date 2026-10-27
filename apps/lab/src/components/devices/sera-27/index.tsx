import { QUALITIES, ROOTS } from "./audio/chords";
import { RHYTHMS } from "./audio/rhythms";
import { BeatLamp } from "./ui/beat-lamp";
import { ChordButton } from "./ui/chord-button";
import { Dial } from "./ui/dial";
import { Plate } from "./ui/plate";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { useSera } from "./use-sera";

const ROW_NAMES = { major: "Major", minor: "Minor", seventh: "7th" } as const;
const CHORD_ROWS = QUALITIES.map((quality) => ({
  chords: ROOTS.map((root) => ({ quality, root })),
  quality,
}));

/** Sera-27: the panel. The sound is in `audio/`, what the panel keeps in `use-sera.ts`. */
export default function Sera27() {
  const sera = useSera();
  const { onParam, settings } = sera;

  return (
    <div className="sera-cabinet">
      <div className="sera">
        <header className="sera-header">
          <div>
            <h1 className="sera-name">
              Sera<span>-27</span>
            </h1>
            <p className="sera-tagline">Chord harp</p>
          </div>
          <Section title="Rhythm">
            <div className="sera-group">
              <Selector
                label="Rhythm"
                onChange={sera.changeRhythm}
                options={RHYTHMS}
                value={sera.rhythm}
              />
              <button
                aria-pressed={sera.isPlaying}
                className="sera-key sera-start"
                onClick={sera.toggle}
                type="button"
              >
                <BeatLamp
                  getPosition={sera.getPosition}
                  playing={sera.isPlaying}
                  stepsPerBeat={sera.stepsPerBeat}
                />
                {sera.isPlaying ? "Stop" : "Start"}
              </button>
            </div>
          </Section>
        </header>

        <div className="sera-body">
          <div aria-label="Chords" className="sera-chords" role="group">
            {CHORD_ROWS.map((row) => (
              <div className="sera-chord-row" key={row.quality}>
                <span aria-hidden="true" className="sera-row-name">
                  {ROW_NAMES[row.quality]}
                </span>
                {row.chords.map((chord) => (
                  <ChordButton
                    chord={chord}
                    key={chord.root}
                    onPress={sera.pressChord}
                    onRelease={sera.releaseChord}
                    selected={
                      sera.chord.root === chord.root &&
                      sera.chord.quality === chord.quality
                    }
                  />
                ))}
              </div>
            ))}
          </div>
          <Plate
            onCommit={sera.lift}
            onStrum={sera.strum}
            strings={sera.strings}
            value={sera.finger}
          />
        </div>

        <div className="sera-row">
          <Section title="Levels">
            <div className="sera-group">
              <Dial
                label="Chords"
                onParam={onParam}
                param="chords"
                value={settings.chords}
              />
              <Dial
                label="Harp"
                onParam={onParam}
                param="harp"
                value={settings.harp}
              />
              <Dial
                label="Rhythm"
                onParam={onParam}
                param="rhythm"
                value={settings.rhythm}
              />
            </div>
          </Section>
          <Section title="Strings">
            <Dial
              label="Sustain"
              onParam={onParam}
              param="sustain"
              value={settings.sustain}
            />
          </Section>
          <Section title="Tempo">
            <Dial
              label="BPM"
              max={180}
              min={60}
              onParam={onParam}
              param="tempo"
              value={sera.bpm}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
