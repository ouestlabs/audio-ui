import { SOURCES } from "./audio/engine";
import { Dial } from "./ui/dial";
import { Reel } from "./ui/reel";
import { Selector } from "./ui/selector";
import { Vu } from "./ui/vu";
import { useDeneb } from "./use-deneb";

/** The reels turn slower the longer the repeat: from about two seconds a turn down to under one. */
const turnSeconds = (rate: number) => 2.6 - rate * 0.17;

/** Deneb-1: the panel. The sound is in `audio/`, what the panel keeps in `use-deneb.ts`. */
export default function Deneb1() {
  const deneb = useDeneb();
  const { onParam, settings } = deneb;
  const turn = turnSeconds(settings.rate);

  return (
    <div className="deneb-cabinet">
      <div className="deneb">
        <header className="deneb-header">
          <div>
            <h1 className="deneb-name">
              Deneb<span>-1</span>
            </h1>
            <p className="deneb-tagline">Tape echo</p>
          </div>
          <div className="deneb-transport">
            <Selector
              label="Source"
              onChange={deneb.changeSource}
              options={SOURCES}
              value={deneb.source}
            />
            <button
              aria-pressed={deneb.playing}
              className="deneb-play"
              disabled={!deneb.ready}
              onClick={deneb.toggle}
              type="button"
            >
              <span
                aria-hidden="true"
                className="deneb-lamp"
                data-on={deneb.playing || undefined}
              />
              {deneb.playing ? "Stop" : "Play"}
            </button>
          </div>
        </header>

        <div className="deneb-window">
          <div className="deneb-tape">
            <Reel playing={deneb.playing} seconds={turn} />
            <span aria-hidden="true" className="deneb-tape-path" />
            <Reel playing={deneb.playing} seconds={turn} />
          </div>
          <div className="deneb-meters">
            <figure className="deneb-meter">
              {deneb.analysers ? (
                <Vu analyser={deneb.analysers.input} label="Input level" />
              ) : (
                <div className="deneb-vu" />
              )}
              <figcaption>In</figcaption>
            </figure>
            <figure className="deneb-meter">
              {deneb.analysers ? (
                <Vu analyser={deneb.analysers.output} label="Output level" />
              ) : (
                <div className="deneb-vu" />
              )}
              <figcaption>Out</figcaption>
            </figure>
          </div>
        </div>

        <div className="deneb-knobs">
          <Dial
            label="Input"
            onParam={onParam}
            param="input"
            size="lg"
            value={settings.input}
          />
          <Dial
            label="Repeat rate"
            onParam={onParam}
            param="rate"
            size="lg"
            value={settings.rate}
          />
          <Dial
            label="Intensity"
            onParam={onParam}
            param="intensity"
            size="lg"
            value={settings.intensity}
          />
          <Dial
            label="Echo"
            onParam={onParam}
            param="echo"
            size="lg"
            value={settings.echo}
          />
          <Dial
            label="Tone"
            onParam={onParam}
            param="tone"
            size="lg"
            value={settings.tone}
          />
          <Dial
            label="Wow"
            onParam={onParam}
            param="wow"
            size="lg"
            value={settings.wow}
          />
          <Dial
            label="Output"
            onParam={onParam}
            param="output"
            size="lg"
            value={settings.output}
          />
        </div>
      </div>
    </div>
  );
}
