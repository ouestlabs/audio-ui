import { Piano } from "@audio-ui/react/piano";
import type { Param } from "./audio/engine";
import { PRESETS } from "./audio/presets";
import { Dial } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { PatchKey } from "./ui/patch-key";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { Slider } from "./ui/slider";
import { useLyra } from "./use-lyra";

const CHORUS = ["Off", "I", "II"] as const;
const SOURCES: { label: string; param: Param }[] = [
  { label: "Saw", param: "saw" },
  { label: "Pulse", param: "pulse" },
  { label: "Width", param: "width" },
  { label: "Sub", param: "sub" },
  { label: "Noise", param: "noise" },
];
const LFO: { label: string; param: Param }[] = [
  { label: "Rate", param: "rate" },
  { label: "Vibrato", param: "vibrato" },
];
const FILTER: { label: string; param: Param }[] = [
  { label: "Cutoff", param: "cutoff" },
  { label: "Reso", param: "resonance" },
  { label: "Env", param: "contour" },
  { label: "Keys", param: "keys" },
];
const ENVELOPE: { label: string; param: Param }[] = [
  { label: "A", param: "attack" },
  { label: "D", param: "decay" },
  { label: "S", param: "sustain" },
  { label: "R", param: "release" },
];

/** Lyra-8: the panel. The sound is in `audio/`, what the panel keeps in `use-lyra.ts`. */
export default function Lyra8() {
  const lyra = useLyra();
  const { onParam, patch } = lyra;

  return (
    <div className="lyra-cabinet">
      <div className="lyra">
        <header className="lyra-header">
          <div>
            <h1 className="lyra-name">
              Lyra<span>-8</span>
            </h1>
            <p className="lyra-tagline">Polyphonic synthesizer</p>
          </div>
          <Lcd readout={lyra.readout} title={lyra.presetTitle} />
          <div aria-label="Patch" className="lyra-patches" role="group">
            {PRESETS.map((preset, index) => (
              <PatchKey
                index={index}
                key={preset.name}
                name={preset.name}
                onSelect={lyra.load}
                selected={lyra.preset === index}
              />
            ))}
          </div>
        </header>

        <div className="lyra-row">
          <Section color="red" title="Oscillators">
            <div className="lyra-group">
              {SOURCES.map((slider) => (
                <Slider
                  key={slider.param}
                  label={slider.label}
                  onParam={onParam}
                  param={slider.param}
                  value={patch[slider.param]}
                />
              ))}
            </div>
          </Section>

          <Section color="orange" title="LFO">
            <div className="lyra-group">
              {LFO.map((slider) => (
                <Slider
                  key={slider.param}
                  label={slider.label}
                  onParam={onParam}
                  param={slider.param}
                  value={patch[slider.param]}
                />
              ))}
            </div>
          </Section>

          <Section color="green" title="Filter">
            <div className="lyra-group">
              {FILTER.map((slider) => (
                <Slider
                  key={slider.param}
                  label={slider.label}
                  onParam={onParam}
                  param={slider.param}
                  value={patch[slider.param]}
                />
              ))}
            </div>
          </Section>

          <Section color="blue" title="Envelope">
            <div className="lyra-group">
              {ENVELOPE.map((slider) => (
                <Slider
                  key={slider.param}
                  label={slider.label}
                  onParam={onParam}
                  param={slider.param}
                  value={patch[slider.param]}
                />
              ))}
            </div>
          </Section>

          <Section color="red" title="Chorus">
            <Selector
              label="Chorus"
              onChange={lyra.changeChorus}
              options={CHORUS}
              value={patch.chorus}
            />
          </Section>

          <Section color="orange" title="Out">
            <Dial
              label="Volume"
              onParam={onParam}
              param="volume"
              value={patch.volume}
            />
          </Section>
        </div>

        <Piano.Root
          activeNotes={lyra.activeNotes}
          aria-label="Keyboard"
          className="lyra-piano"
          maxPitch={83}
          minPitch={36}
          onNoteOff={lyra.noteOff}
          onNoteOn={lyra.pressKey}
        >
          <Piano.Keys>
            {(pitch: number) => (
              <Piano.Key className="lyra-piano-key" key={pitch} pitch={pitch} />
            )}
          </Piano.Keys>
        </Piano.Root>
      </div>
    </div>
  );
}
