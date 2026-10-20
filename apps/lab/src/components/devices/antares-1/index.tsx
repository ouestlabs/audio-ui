import { SOURCES } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Reduction } from "./ui/reduction";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { Vu } from "./ui/vu";
import { useAntares } from "./use-antares";

const KNEES = ["Hard", "Soft"] as const;
const MAKEUPS = ["Manual", "Auto"] as const;
const ENGAGED = ["Out", "In"] as const;

/** Antares-1: the panel. The sound is in `audio/`, what the panel keeps in `use-antares.ts`. */
export default function Antares1() {
  const antares = useAntares();
  const { onKnob, panel } = antares;

  return (
    <div className="antares-cabinet">
      <div className="antares">
        <header className="antares-header">
          <div>
            <h1 className="antares-name">
              Antares<span>-1</span>
            </h1>
            <p className="antares-tagline">Compressor</p>
          </div>
          <div className="antares-lcd">
            <p className="antares-lcd-line" role="status">
              {antares.source} {panel.engaged ? "in" : "out"}
            </p>
            <p aria-hidden="true" className="antares-lcd-line antares-lcd-dim">
              {antares.readout}
            </p>
          </div>
          <div className="antares-transport">
            <Selector
              label="Source"
              onChange={antares.changeSource}
              options={SOURCES}
              value={antares.source}
            />
            <button
              aria-pressed={antares.playing}
              className="antares-play"
              disabled={!antares.ready}
              onClick={antares.toggle}
              type="button"
            >
              <span
                aria-hidden="true"
                className="antares-lamp"
                data-on={antares.playing || undefined}
              />
              {antares.playing ? "Stop" : "Play"}
            </button>
          </div>
        </header>

        <div className="antares-meters">
          {antares.meters ? (
            <Reduction read={antares.meters.reduction} />
          ) : (
            <div className="antares-dial" />
          )}
          {antares.meters ? (
            <Vu analyser={antares.meters.analyser} />
          ) : (
            <div className="antares-dial" />
          )}
        </div>

        <div className="antares-row">
          <Section title="Level">
            <div className="antares-group">
              <Dial
                label="Input"
                onKnob={onKnob}
                param="input"
                value={panel.input}
              />
              <Dial
                label="Output"
                onKnob={onKnob}
                param="output"
                value={panel.output}
              />
            </div>
          </Section>
          <Section title="Compression">
            <div className="antares-group">
              <Dial
                label="Threshold"
                onKnob={onKnob}
                param="threshold"
                value={panel.threshold}
              />
              <Dial
                label="Ratio"
                onKnob={onKnob}
                param="ratio"
                value={panel.ratio}
              />
              <Dial
                label="Attack"
                onKnob={onKnob}
                param="attack"
                value={panel.attack}
              />
              <Dial
                label="Release"
                onKnob={onKnob}
                param="release"
                value={panel.release}
              />
            </div>
          </Section>
          <Section title="Blend">
            <div className="antares-group">
              <Dial
                label="Make-up"
                onKnob={onKnob}
                param="makeup"
                value={panel.makeup}
              />
              <Dial label="Mix" onKnob={onKnob} param="mix" value={panel.mix} />
            </div>
          </Section>
          <Section title="Switches">
            <div className="antares-switches">
              <Selector
                label="Knee"
                onChange={antares.setKnee}
                options={KNEES}
                value={panel.knee}
              />
              <Selector
                label="Make-up mode"
                onChange={antares.setMakeup}
                options={MAKEUPS}
                value={panel.auto ? "Auto" : "Manual"}
              />
              <Selector
                label="Compressor"
                onChange={antares.setEngaged}
                options={ENGAGED}
                value={panel.engaged ? "In" : "Out"}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
