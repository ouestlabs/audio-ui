import { MODES, SOURCES } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Footswitch } from "./ui/footswitch";
import { LampWindow } from "./ui/lamp-window";
import { Section } from "./ui/section";
import { Selector } from "./ui/selector";
import { useLuma } from "./use-luma";

/** Luma-4: the panel. The sound is in `audio/`, what the panel keeps in `use-luma.ts`. */
export default function Luma4() {
  const luma = useLuma();
  const { onParam, settings } = luma;

  return (
    <div className="luma-cabinet">
      <div className="luma">
        <header className="luma-header">
          <div>
            <h1 className="luma-name">
              Luma<span>-4</span>
            </h1>
            <p className="luma-tagline">Photocell vibe</p>
          </div>
          <div className="luma-transport">
            <Selector
              label="Source"
              onChange={luma.changeSource}
              options={SOURCES}
              value={luma.source}
            />
            <button
              aria-pressed={luma.playing}
              className="luma-choice luma-play"
              disabled={!luma.ready}
              onClick={luma.toggle}
              type="button"
            >
              <span
                aria-hidden="true"
                className="luma-lamp"
                data-on={luma.playing || undefined}
              />
              {luma.playing ? "Stop" : "Play"}
            </button>
          </div>
        </header>

        <div className="luma-body">
          <LampWindow lamp={luma.lamp} />
          <div className="luma-controls">
            <div className="luma-group">
              <Section title="Lamp">
                <div className="luma-group">
                  <Dial
                    label="Speed"
                    onParam={onParam}
                    param="speed"
                    size="lg"
                    value={settings.speed}
                  />
                  <Dial
                    label="Intensity"
                    onParam={onParam}
                    param="intensity"
                    value={settings.intensity}
                  />
                </div>
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
            <Section title="Mode">
              <Selector
                label="Mode"
                onChange={luma.changeMode}
                options={MODES}
                value={settings.mode}
              />
            </Section>
          </div>
        </div>

        <footer className="luma-foot">
          <Footswitch engaged={luma.engaged} onToggle={luma.stomp} />
        </footer>
      </div>
    </div>
  );
}
