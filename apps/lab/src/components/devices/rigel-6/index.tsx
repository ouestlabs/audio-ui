import { CHANNELS } from "./audio/engine";
import { ChannelStrip } from "./ui/channel";
import { Slide } from "./ui/fader";
import { Levels } from "./ui/meter";
import { useRigel } from "./use-rigel";

/** Rigel-6: the panel. The sound is in `audio/`, what the panel keeps in `use-rigel.ts`. */
export default function Rigel6() {
  const rigel = useRigel();

  return (
    <div className="rigel-cabinet">
      <div className="rigel">
        <header className="rigel-header">
          <div>
            <h1 className="rigel-name">
              Rigel<span>-6</span>
            </h1>
            <p className="rigel-tagline">Mixing desk</p>
          </div>
        </header>

        <div className="rigel-desk">
          <div className="rigel-strips">
            {CHANNELS.map((channel) => (
              <ChannelStrip
                analysers={rigel.analysers ? [rigel.analysers[channel]] : []}
                channel={channel}
                key={channel}
                onKnob={rigel.onKnob}
                onStrip={rigel.onStrip}
                strip={rigel.desk[channel]}
              />
            ))}
          </div>

          <section className="rigel-master">
            <h2 className="rigel-strip-name">Master</h2>
            <button
              aria-pressed={rigel.playing}
              className="rigel-play"
              disabled={!rigel.ready}
              onClick={rigel.toggle}
              type="button"
            >
              <span
                aria-hidden="true"
                className="rigel-lamp"
                data-on={rigel.playing || undefined}
              />
              {rigel.playing ? "Stop" : "Play"}
            </button>
            <div className="rigel-slide">
              <Slide
                label="Master level"
                onChange={rigel.setMaster}
                value={rigel.master}
              />
              {rigel.masterAnalysers.length > 0 ? (
                <Levels
                  analysers={rigel.masterAnalysers}
                  label="Master meter"
                />
              ) : (
                <div className="rigel-meter" />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
