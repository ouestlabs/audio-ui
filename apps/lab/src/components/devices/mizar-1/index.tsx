import { SOURCES } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { Tank } from "./ui/tank";
import { Vu } from "./ui/vu";
import { useMizar } from "./use-mizar";

/** Mizar-1: the panel. The sound is in `audio/`, what the panel keeps in `use-mizar.ts`. */
export default function Mizar1() {
  const mizar = useMizar();
  const { onParam, settings } = mizar;

  return (
    <div className="mizar-cabinet">
      <div className="mizar">
        <header className="mizar-header">
          <div>
            <h1 className="mizar-name">
              Mizar<span>-1</span>
            </h1>
            <p className="mizar-tagline">Spring reverb</p>
          </div>
          <div className="mizar-transport">
            <Selector
              label="Source"
              onChange={mizar.changeSource}
              options={SOURCES}
              value={mizar.source}
            />
            <button
              aria-pressed={mizar.playing}
              className="mizar-play"
              disabled={!mizar.ready}
              onClick={mizar.toggle}
              type="button"
            >
              <span
                aria-hidden="true"
                className="mizar-lamp"
                data-on={mizar.playing || undefined}
              />
              {mizar.playing ? "Stop" : "Play"}
            </button>
            <button
              className="mizar-play mizar-bump"
              disabled={!mizar.ready}
              onClick={mizar.bump}
              type="button"
            >
              Bump
            </button>
          </div>
        </header>

        <div className="mizar-window">
          <div className="mizar-glass">
            <Tank analyser={mizar.analyser} bumped={mizar.bumped} />
          </div>
          {mizar.analyser ? (
            <Vu analyser={mizar.analyser} />
          ) : (
            <div className="mizar-vu" />
          )}
        </div>

        <div className="mizar-row">
          <Section title="Springs">
            <div className="mizar-group">
              <Dial
                label="Dwell"
                onParam={onParam}
                param="dwell"
                value={settings.dwell}
              />
              <Dial
                label="Tension"
                onParam={onParam}
                param="tension"
                value={settings.tension}
              />
              <Dial
                label="Decay"
                onParam={onParam}
                param="decay"
                value={settings.decay}
              />
            </div>
          </Section>
          <Section title="Return">
            <div className="mizar-group">
              <Dial
                label="Tone"
                onParam={onParam}
                param="tone"
                value={settings.tone}
              />
              <Dial
                label="Mix"
                onParam={onParam}
                param="mix"
                value={settings.mix}
              />
              <Dial
                label="Output"
                onParam={onParam}
                param="output"
                value={settings.output}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
