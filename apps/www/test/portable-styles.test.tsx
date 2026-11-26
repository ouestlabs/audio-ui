import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";

// The timeline the piano roll sits in draws its icons through the registry, which a test has no bundler for.
mock.module("@/components/icon-placeholder", () => ({
  IconPlaceholder: () => null,
}));
mock.module("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

const { Knob, knobParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/knob"
);
const { Fader, faderParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/fader"
);
const { Meter, meterParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/meter"
);
const { Envelope, envelopeParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/envelope"
);
const { Pad, PadItem, padParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/pad"
);
const { Piano, pianoParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/piano"
);
const Plot = await import("@/registry/bases/shared/audio-ui/elements/plot");
const Wave = await import("@/registry/bases/shared/audio-ui/elements/waveform");
const { createSource } = await import("@/registry/primitives/primitive");
const Roll = await import(
  "@/registry/bases/shared/audio-ui/elements/piano-roll"
);
const RollParts = await import(
  "@/registry/bases/shared/audio-ui/elements/piano-roll-parts"
);
const { Sequencer, sequencerParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/sequencer"
);
const { XYPad, xypadParts } = await import(
  "@/registry/bases/shared/audio-ui/elements/xypad"
);

const { partSelector } = await import("../scripts/portable-css.ts");

const blank = () => "";

afterEach(cleanup);

const STYLES = ["vega", "nova", "maia", "lyra", "mira", "luma", "rhea", "sera"];
const SHEETS = `${import.meta.dir}/../public/css`;

const ELEMENTS = [
  {
    name: "knob",
    parts: knobParts,
    root: { "data-marks": "labels", "data-size": "lg" },
    render: () =>
      render(
        <Knob
          aria-label="Level"
          editableValue
          marks={[0, { label: "50", value: 50 }, 100]}
          size="lg"
        />
      ),
  },
  {
    name: "fader",
    parts: faderParts,
    root: { "data-marks": "labels", "data-size": "lg" },
    render: () =>
      render(
        <Fader
          aria-label="Volume"
          editableValue
          marks={[0, { label: "50", value: 50 }, 100]}
          size="lg"
        />
      ),
  },
  {
    name: "meter",
    parts: meterParts,
    root: { "data-marks": "labels", "data-size": "lg" },
    render: () =>
      render(
        <Meter aria-label="Output" marks={[-12, 0]} size="lg" value={[-6]} />
      ),
  },
  {
    name: "xypad",
    parts: xypadParts,
    root: { "data-fill": "", "data-size": "lg" },
    render: () => render(<XYPad aria-label="Position" fill size="lg" />),
  },
  {
    name: "envelope",
    parts: envelopeParts,
    root: { "data-size": "lg" },
    // A point high enough has its label under it.
    render: () =>
      render(
        <Envelope
          aria-label="Envelope"
          defaultValue={[
            { x: 0, y: 0 },
            { x: 0.5, y: 0.9 },
            { x: 1, y: 0 },
          ]}
          size="lg"
        />
      ),
  },
  {
    name: "pad",
    parts: padParts,
    root: {},
    render: () =>
      render(
        <Pad aria-label="Drum pads">
          <PadItem value="kick">Kick</PadItem>
        </Pad>
      ),
  },
  {
    name: "piano",
    parts: pianoParts,
    root: { "data-size": "lg" },
    render: () =>
      render(
        <Piano aria-label="Piano" maxPitch={62} minPitch={60} size="lg" />
      ),
  },
  {
    name: "plot",
    parts: Plot.plotParts,
    root: {},
    render: () => {
      const line = (x: number) => x;
      const source = createSource<ArrayLike<number>>([0.2, 0.8]);
      return render(
        <Plot.Plot maxX={1} maxY={1}>
          <Plot.PlotGrid x={{ ticks: [0.5] }} y={{ ticks: [0.5] }} />
          <Plot.PlotGraph>
            <Plot.PlotArea fillTo={0} fn={line} />
            <Plot.PlotCurve fn={line} />
            <Plot.PlotTraceArea fillTo={0} source={source} />
            <Plot.PlotTrace source={source} />
            <Plot.PlotBand axis="x" from={0.2} to={0.4} />
            <Plot.PlotLine axis="x" value={0.5} />
            <Plot.PlotDot value={{ x: 0.5, y: 0.5 }} />
          </Plot.PlotGraph>
          <Plot.PlotMark axis="x" value={0.5}>
            half
          </Plot.PlotMark>
          <Plot.PlotHandle aria-label="Peak" value={{ x: 0.5, y: 0.5 }} />
          <Plot.PlotCursor format={blank} />
        </Plot.Plot>
      );
    },
  },
  {
    name: "waveform",
    parts: Wave.waveformParts,
    root: {},
    render: () =>
      render(
        <Wave.Waveform
          aria-label="Track"
          duration={10}
          values={[0.2, 0.6, 0.4]}
          variant="playhead"
        >
          <Wave.WaveformRegion value={[2, 4]}>
            <Wave.WaveformRegionHandle aria-label="Start" edge="start" />
            <Wave.WaveformRegionHandle aria-label="End" edge="end" />
          </Wave.WaveformRegion>
          <Wave.WaveformMarker value={5}>Verse</Wave.WaveformMarker>
          <Wave.WaveformHover />
        </Wave.Waveform>
      ),
    // The live waveform and the bars are the same root as the waveform, in the same sheet.
    also: () =>
      render(
        <>
          <Wave.LiveWaveform aria-label="Input" />
          <Wave.BarVisualizer aria-label="Bands" orientation="vertical" />
        </>
      ),
  },
  {
    name: "sequencer",
    parts: sequencerParts,
    root: { "data-labels": "", "data-size": "sm" },
    render: () =>
      render(
        <Sequencer
          aria-label="Drums"
          defaultValue={[[true, false, false, false]]}
          rowLabels={["Kick"]}
          showVelocity
          size="sm"
        />
      ),
  },
  {
    name: "piano-roll",
    parts: RollParts.pianoRollParts,
    root: {},
    render: () =>
      render(
        <Roll.PianoRoll
          defaultValue={[
            { id: "a", length: 4, pitch: 60, start: 0, velocity: 0.8 },
          ]}
          maxPitch={61}
          minPitch={59}
        >
          <Roll.PianoRollKeys />
          <Roll.PianoRollGrid>
            <Roll.PianoRollStretchHandle edge="start" />
            <Roll.PianoRollStretchHandle edge="end" />
          </Roll.PianoRollGrid>
          <Roll.PianoRollVelocity />
        </Roll.PianoRoll>
      ),
    // The other sizes of the keys and the grid.
    also: () =>
      render(
        <Roll.PianoRoll maxPitch={61} minPitch={59}>
          <Roll.PianoRollKeys size="sm" />
          <Roll.PianoRollGrid size="lg" />
          <Roll.PianoRollKeys size="lg" />
          <Roll.PianoRollGrid size="sm" />
        </Roll.PianoRoll>
      ),
  },
] as const;

describe.each([...ELEMENTS])(
  "the $name, as plain CSS on its parts",
  (element) => {
    test("the React element draws every part the sheet styles, by its slot", () => {
      const containers = [
        element.render().container,
        ...("also" in element ? [element.also().container] : []),
      ];
      for (const part of Object.keys(element.parts)) {
        const drawn = containers.some(
          (container) => container.querySelector(partSelector(part)) !== null
        );
        expect(drawn ? part : `${part} missing`).toBe(part);
      }
    });

    test("its look follows the root's attributes, which the React element sets", () => {
      const { container } = element.render();
      const root = container.querySelector(
        `[data-slot=${Object.keys(element.parts)[0]}]`
      );
      for (const [name, value] of Object.entries(element.root)) {
        expect(root?.getAttribute(name)).toBe(value);
      }
    });

    test.each(STYLES)(
      "the %s style serves a sheet for every part",
      async (style) => {
        const sheet = await Bun.file(
          `${SHEETS}/${style}/${element.name}.css`
        ).text();
        for (const part of Object.keys(element.parts)) {
          expect(sheet).toContain(partSelector(part));
        }
        // The sheet needs no Tailwind: no hook, no @apply, no group class is left.
        expect(sheet).not.toContain("@apply");
        expect(sheet).not.toContain(".cn-");
        expect(sheet).not.toContain(".group\\/");
      }
    );
  }
);
