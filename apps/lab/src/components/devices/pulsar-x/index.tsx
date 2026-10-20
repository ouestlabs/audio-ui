import { SCALES } from "./audio/scales";
import { Dial } from "./ui/dial";
import { Plate } from "./ui/plate";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { usePulsar } from "./use-pulsar";

const WAVES = ["Saw", "Square", "Tri"] as const;
const HOLD = ["Off", "On"] as const;

/** Pulsar-X: the panel. The sound is in `audio/`, what the panel keeps in `use-pulsar.ts`. */
export default function PulsarX() {
  const pulsar = usePulsar();
  const { onParam, settings } = pulsar;

  return (
    <div className="pulsar-cabinet">
      <div className="pulsar">
        <header className="pulsar-header">
          <div>
            <h1 className="pulsar-name">
              Pulsar<span>-X</span>
            </h1>
            <p className="pulsar-tagline">Touch plate synthesizer</p>
          </div>
          <div className="pulsar-lcd">
            <p className="pulsar-lcd-line" role="status">
              {pulsar.title}
            </p>
            <p aria-hidden="true" className="pulsar-lcd-line pulsar-lcd-dim">
              {pulsar.readout}
            </p>
          </div>
          <div className="pulsar-selectors">
            <Section title="Wave">
              <Selector
                label="Waveform"
                onChange={pulsar.changeWave}
                options={WAVES}
                value={settings.wave}
              />
            </Section>
            <Section title="Hold">
              <Selector
                label="Hold"
                onChange={pulsar.changeHold}
                options={HOLD}
                value={pulsar.held ? "On" : "Off"}
              />
            </Section>
          </div>
        </header>

        <Plate
          onKeyDown={pulsar.keyDown}
          onPoint={pulsar.onPoint}
          onPress={pulsar.press}
          point={pulsar.point}
          scale={pulsar.scale}
          touching={pulsar.touching}
        />

        <div className="pulsar-row">
          <Section title="Scale">
            <Selector
              label="Scale"
              onChange={pulsar.changeScale}
              options={SCALES}
              value={pulsar.scale}
            />
          </Section>
          <Section title="Voice">
            <div className="pulsar-group">
              <Dial
                label="Glide"
                onParam={onParam}
                param="glide"
                value={settings.glide}
              />
              <Dial
                label="Vibrato"
                onParam={onParam}
                param="vibrato"
                value={settings.vibrato}
              />
              <Dial
                label="Reso"
                onParam={onParam}
                param="resonance"
                value={settings.resonance}
              />
            </div>
          </Section>
          <Section title="Echo">
            <div className="pulsar-group">
              <Dial
                label="Time"
                onParam={onParam}
                param="time"
                value={settings.time}
              />
              <Dial
                label="Feedback"
                onParam={onParam}
                param="feedback"
                value={settings.feedback}
              />
              <Dial
                label="Mix"
                onParam={onParam}
                param="mix"
                value={settings.mix}
              />
            </div>
          </Section>
          <Section title="Out">
            <Dial
              label="Volume"
              onParam={onParam}
              param="volume"
              value={pulsar.volume}
            />
          </Section>
        </div>
      </div>
    </div>
  );
}
