import { Pad } from "@audio-ui/react/pad";
import { Waveform } from "@audio-ui/react/waveform";
import { SLICES } from "./audio/engine";
import { Dial, SEMITONES } from "./ui/dial";
import { Lcd } from "./ui/lcd";
import { Load } from "./ui/load";
import { Section } from "./ui/section";
import { Switch } from "./ui/switch";
import { useAltair } from "./use-altair";

const SLICE_INDEXES = Array.from({ length: SLICES }, (_, slice) => slice);
/** Pad 1 sits at the bottom left, as on a drum machine: the rows are listed from the top. */
const ROWS = [
  [12, 13, 14, 15],
  [8, 9, 10, 11],
  [4, 5, 6, 7],
  [0, 1, 2, 3],
];

/** Altair-16: the panel. The sound is in `audio/`, what the panel keeps in `use-altair.ts`. */
export default function Altair16() {
  const altair = useAltair();
  const { duration, settings } = altair;
  const length = duration / SLICES;

  return (
    <div className="altair-cabinet">
      <div className="altair">
        <header className="altair-header">
          <div>
            <h1 className="altair-name">
              Altair<span>-16</span>
            </h1>
            <p className="altair-tagline">Sampling workstation</p>
          </div>
          <Load onFile={altair.load} />
        </header>

        <Lcd
          onNext={altair.next}
          onPrevious={altair.previous}
          readout={altair.failed ? "CANNOT READ FILE" : altair.readout}
          title={altair.loaded?.name.toUpperCase() ?? "LOADING"}
        >
          <Waveform.Root
            aria-label="Sample: press a slice to play it"
            className="altair-wave"
            disabled={!altair.loaded}
            duration={duration || 1}
            loading={!altair.loaded}
            onValueChange={altair.onScreen}
            onValueCommitted={altair.onScreenEnd}
            peaks={altair.loaded?.peaks}
            source={altair.position}
          >
            <Waveform.Control className="altair-wave-control">
              <Waveform.Canvas
                barGap={1}
                barWidth={2}
                className="altair-wave-canvas"
              />
              {altair.loaded
                ? SLICE_INDEXES.map((slice) => (
                    <Waveform.Marker
                      className="altair-slice-line"
                      key={slice}
                      value={slice * length}
                    >
                      <span className="altair-slice-number">{slice + 1}</span>
                    </Waveform.Marker>
                  ))
                : null}
              {altair.loaded ? (
                <Waveform.Region
                  className="altair-slice"
                  movable={false}
                  value={[
                    altair.selected * length,
                    (altair.selected + 1) * length,
                  ]}
                />
              ) : null}
              <Waveform.Playhead className="altair-playhead" />
            </Waveform.Control>
          </Waveform.Root>
        </Lcd>

        <div className="altair-row">
          <Section title="Play">
            <div className="altair-group">
              <Dial
                label="Pitch"
                onParam={altair.onParam}
                param="pitch"
                scale={SEMITONES}
                size="lg"
                value={settings.pitch}
              />
              <Dial
                label="Filter"
                onParam={altair.onParam}
                param="cutoff"
                value={settings.cutoff}
              />
              <Dial
                label="Release"
                onParam={altair.onParam}
                param="release"
                value={settings.release}
              />
            </div>
          </Section>

          <Section title="Pads">
            <div className="altair-keys">
              <Switch
                off="Shot"
                on="Gate"
                onToggle={altair.setGate}
                pressed={settings.gate}
              />
              <Switch
                off="Poly"
                on="Mono"
                onToggle={altair.setMono}
                pressed={settings.mono}
              />
            </div>
          </Section>

          <Section title="Out">
            <Dial
              label="Volume"
              onParam={altair.onParam}
              param="volume"
              size="lg"
              value={altair.volume}
            />
          </Section>
        </div>

        <Pad.Root
          activePads={altair.activePads}
          aria-label="Pads: one slice each"
          className="altair-pads"
          columns={4}
          onPadOff={altair.onPadOff}
          onPadOn={altair.onPadOn}
        >
          {ROWS.flat().map((slice) => (
            <Pad.Item
              className="altair-pad"
              data-selected={altair.selected === slice || undefined}
              key={slice}
              value={String(slice)}
            >
              <span className="altair-pad-number">{slice + 1}</span>
            </Pad.Item>
          ))}
        </Pad.Root>
      </div>
    </div>
  );
}
