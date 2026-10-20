import { Pad } from "@audio-ui/react/pad";
import { KITS, SAMPLE_NAMES } from "./audio/kits";
import { Dial, type Scale } from "./ui/dial";
import { Key } from "./ui/key";
import { Lcd } from "./ui/lcd";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { Steps } from "./ui/steps";
import { useVesta } from "./use-vesta";

const TEMPO: Scale = {
  marks: [60, 80, 100, 120, 140, 160, 180],
  max: 180,
  min: 60,
  numerals: [60, 120, 180],
};
const PAD_RANKS = [
  [12, 13, 14, 15],
  [8, 9, 10, 11],
  [4, 5, 6, 7],
  [0, 1, 2, 3],
];

/** Vesta-16: the panel. The sound is in `audio/`, what the panel keeps in `use-vesta.ts`. */
export default function Vesta16() {
  const vesta = useVesta();
  const { onParam, pad } = vesta;

  return (
    <div className="vesta-cabinet">
      <div className="vesta">
        <header className="vesta-header">
          <div>
            <h1 className="vesta-name">
              Vesta<span>-16</span>
            </h1>
            <p className="vesta-tagline">Sample drum machine</p>
          </div>
          <Lcd
            onNext={vesta.next}
            onPrevious={vesta.previous}
            readout={vesta.readout}
            title={vesta.title}
          />
        </header>

        <div className="vesta-body">
          <div className="vesta-controls">
            <Section title="Kit">
              <Selector
                label="Kit"
                onChange={vesta.changeKit}
                options={KITS}
                value={vesta.kit}
              />
            </Section>
            <Section title={SAMPLE_NAMES[vesta.selected] ?? "Pad"}>
              <div className="vesta-group">
                <Dial
                  label="Tune"
                  onParam={onParam}
                  param="tune"
                  value={pad.tune}
                />
                <Dial
                  label="Decay"
                  onParam={onParam}
                  param="decay"
                  value={pad.decay}
                />
                <Dial
                  label="Level"
                  onParam={onParam}
                  param="level"
                  value={pad.level}
                />
                <Dial
                  label="Pan"
                  onParam={onParam}
                  param="pan"
                  value={pad.pan}
                />
              </div>
            </Section>
            <div className="vesta-machine">
              <Section title="Tempo">
                <Dial
                  label="BPM"
                  onParam={onParam}
                  param="tempo"
                  scale={TEMPO}
                  size="lg"
                  value={vesta.bpm}
                />
              </Section>
              <Section title="Out">
                <Dial
                  label="Volume"
                  onParam={onParam}
                  param="volume"
                  size="lg"
                  value={vesta.volume}
                />
              </Section>
            </div>
            <div className="vesta-transport">
              <Key
                lit={vesta.isPlaying}
                onPress={vesta.toggle}
                pressed={vesta.isPlaying}
              >
                {vesta.isPlaying ? "Stop" : "Play"}
              </Key>
              <Key
                lit={vesta.recording}
                onPress={vesta.toggleRecording}
                pressed={vesta.recording}
              >
                Rec
              </Key>
              <Key onPress={vesta.clearPad}>Clear pad</Key>
              <Key onPress={vesta.clearAll}>Clear all</Key>
            </div>
          </div>

          <div className="vesta-deck">
            <Pad.Root
              activePads={vesta.activePads}
              aria-label="Pads: one sample each"
              className="vesta-pads"
              columns={4}
              onPadOn={vesta.onPadOn}
            >
              {PAD_RANKS.flat().map((index) => (
                <Pad.Item
                  className="vesta-pad"
                  data-selected={vesta.selected === index || undefined}
                  disabled={!vesta.ready}
                  key={index}
                  value={String(index)}
                >
                  <span className="vesta-pad-number">{index + 1}</span>
                  <span className="vesta-pad-name">{SAMPLE_NAMES[index]}</span>
                </Pad.Item>
              ))}
            </Pad.Root>
            <Steps hits={vesta.hits} position={vesta.position} />
          </div>
        </div>
      </div>
    </div>
  );
}
