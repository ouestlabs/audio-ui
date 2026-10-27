import { Piano } from "@audio-ui/react/piano";
import { formantSemitones } from "./audio/engine";
import { Bands } from "./ui/bands";
import { Dial } from "./ui/dial";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { SOURCES, useMaia } from "./use-maia";

const formantText = (value: number) => {
  const semitones = Math.round(formantSemitones(value));
  return `${semitones > 0 ? "+" : ""}${semitones} semitones`;
};

/** Maia-16: the panel. The sound is in `audio/`, what the panel keeps in `use-maia.ts`. */
export default function Maia16() {
  const maia = useMaia();
  const { onParam, settings } = maia;
  let action = maia.running ? "Stop" : "Play";
  if (maia.source === "Mic" && !maia.running) {
    action = "Listen";
  }

  return (
    <div className="maia-cabinet">
      <div className="maia">
        <header className="maia-header">
          <div>
            <h1 className="maia-name">
              Maia<span>-16</span>
            </h1>
            <p className="maia-tagline">Sixteen-band vocoder</p>
          </div>
          <div className="maia-transport">
            <Selector
              label="Voice source"
              onChange={maia.changeSource}
              options={SOURCES}
              value={maia.source}
            />
            <button
              aria-pressed={maia.running}
              className="maia-key maia-play"
              disabled={!maia.ready}
              onClick={maia.toggle}
              type="button"
            >
              <span
                aria-hidden="true"
                className="maia-lamp"
                data-on={maia.running || undefined}
              />
              {action}
            </button>
          </div>
        </header>

        <p className="maia-status" role="status">
          {maia.status}
        </p>

        <Bands analysers={maia.analysers} />

        <div className="maia-row">
          <Section title="Voice">
            <div className="maia-group">
              <Dial
                label="Input"
                onParam={onParam}
                param="input"
                value={settings.input}
              />
              <Dial
                label="Response"
                onParam={onParam}
                param="response"
                value={settings.response}
              />
            </div>
          </Section>
          <Section title="Synth">
            <div className="maia-group">
              <Dial
                bipolar
                label="Formant"
                onParam={onParam}
                param="formant"
                value={settings.formant}
                valueText={formantText}
              />
              <Dial
                label="Noise"
                onParam={onParam}
                param="noise"
                value={settings.noise}
              />
              <Dial
                label="Detune"
                onParam={onParam}
                param="detune"
                value={settings.detune}
              />
            </div>
          </Section>
          <Section title="Keys">
            <button
              aria-pressed={maia.hold}
              className="maia-key"
              onClick={maia.toggleHold}
              type="button"
            >
              <span
                aria-hidden="true"
                className="maia-lamp"
                data-on={maia.hold || undefined}
              />
              Hold
            </button>
          </Section>
          <Section title="Out">
            <Dial
              label="Volume"
              onParam={onParam}
              param="volume"
              value={settings.volume}
            />
          </Section>
        </div>

        <Piano.Root
          activeNotes={maia.activeNotes}
          aria-label="Keyboard"
          className="maia-piano"
          maxPitch={84}
          minPitch={48}
          onNoteOff={maia.releaseKey}
          onNoteOn={maia.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="maia-piano-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>
      </div>
    </div>
  );
}
