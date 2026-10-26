import { Piano } from "@audio-ui/react/piano";
import { HIGHEST, LOWEST } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Section } from "./ui/section";
import { StationKnob } from "./ui/station";
import { TapeGauge } from "./ui/tape-gauge";
import { useRhea } from "./use-rhea";

/** Rhea-35: the panel. The sound is in `audio/`, what the panel keeps in `use-rhea.ts`. */
export default function Rhea35() {
  const rhea = useRhea();
  const { onParam, settings } = rhea;

  return (
    <div className="rhea-cabinet">
      <div className="rhea">
        <div className="rhea-panel">
          <header className="rhea-header">
            <h1 className="rhea-name">
              Rhea<span>-35</span>
            </h1>
            <p className="rhea-tagline">Tape replay keyboard</p>
            <span aria-hidden="true" className="rhea-pilot" />
          </header>

          <TapeGauge read={rhea.remaining} />

          <div className="rhea-controls">
            <Section title="Tracks">
              <StationKnob
                onChange={rhea.changeStation}
                value={settings.station}
              />
            </Section>
            <Section title="Tape">
              <div className="rhea-group">
                <Dial
                  bipolar
                  label="Pitch"
                  onParam={onParam}
                  param="pitch"
                  value={settings.pitch}
                />
                <Dial
                  label="Wow"
                  onParam={onParam}
                  param="wow"
                  value={settings.wow}
                />
              </div>
            </Section>
            <Section title="Out">
              <div className="rhea-group">
                <Dial
                  label="Tone"
                  onParam={onParam}
                  param="tone"
                  value={settings.tone}
                />
                <Dial
                  label="Volume"
                  onParam={onParam}
                  param="volume"
                  value={settings.volume}
                />
              </div>
            </Section>
          </div>
        </div>

        <Piano.Root
          activeNotes={rhea.activeNotes}
          aria-label="Keyboard"
          className="rhea-piano"
          maxPitch={HIGHEST}
          minPitch={LOWEST}
          onNoteOff={rhea.noteOff}
          onNoteOn={rhea.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="rhea-piano-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>
      </div>
    </div>
  );
}
