import { describe, expect, test } from "bun:test";
import { polylinePoints } from "@audio-ui/core/envelope";
import { renderToString } from "react-dom/server";
import { createSSRApp, h } from "vue";
import { renderToString as renderVue } from "vue/server-renderer";
import { Envelope } from "@/registry-audio/bases/base/primitives/envelope/react.tsx";
import { Envelope as VueEnvelope } from "@/registry-audio/bases/base/primitives/envelope/vue.ts";
import { Fader } from "@/registry-audio/bases/base/primitives/fader/react.tsx";
import { Fader as VueFader } from "@/registry-audio/bases/base/primitives/fader/vue.ts";
import { Meter } from "@/registry-audio/bases/base/primitives/meter/react.tsx";
import { Meter as VueMeter } from "@/registry-audio/bases/base/primitives/meter/vue.ts";
import { Pad } from "@/registry-audio/bases/base/primitives/pad/react.tsx";
import { Piano } from "@/registry-audio/bases/base/primitives/piano/react.tsx";
import { Plot } from "@/registry-audio/bases/base/primitives/plot/react.tsx";
import { Sequencer } from "@/registry-audio/bases/base/primitives/sequencer/react.tsx";
import { Timeline } from "@/registry-audio/bases/base/primitives/timeline/react.tsx";
import { Waveform } from "@/registry-audio/bases/base/primitives/waveform/react.tsx";
import { XYPad } from "@/registry-audio/bases/base/primitives/xypad/react.tsx";
import { XYPad as VueXYPad } from "@/registry-audio/bases/base/primitives/xypad/vue.ts";

/** What a fader at 25 and a pad at (25, 75) hold in their server HTML, before any script runs. */
const faderFeatures = (markup: string) => ({
  input: markup.includes('type="range"'),
  place: markup.includes("bottom:25%") || markup.includes("bottom: 25%"),
  text: markup.includes(">25<"),
});
const padFeatures = (markup: string) => ({
  inputs: markup.match(/type="range"/g)?.length,
  place: markup.includes("left:25%") || markup.includes("left: 25%"),
  text: markup.includes("25") && markup.includes("75"),
});

const FADER = { input: true, place: true, text: true };
const PAD = { inputs: 2, place: true, text: true };

describe("server rendering of the fader and the XY pad", () => {
  test("React", () => {
    const fader = renderToString(
      <Fader.Root max={100} min={0} value={25}>
        <Fader.Control>
          <Fader.Track>
            <Fader.Indicator />
          </Fader.Track>
          <Fader.Thumb aria-label="Level" />
        </Fader.Control>
        <Fader.Value />
      </Fader.Root>
    );
    expect(faderFeatures(fader)).toEqual(FADER);
    const pad = renderToString(
      <XYPad.Root value={{ x: 25, y: 75 }}>
        <XYPad.Control>
          <XYPad.Thumb aria-label="Cursor" />
        </XYPad.Control>
        <XYPad.Value />
      </XYPad.Root>
    );
    expect(padFeatures(pad)).toEqual(PAD);
  });

  test("Vue", async () => {
    const fader = await renderVue(
      createSSRApp({
        render: () =>
          h(VueFader.Root, { max: 100, min: 0, value: 25 }, () => [
            h(VueFader.Control, null, () => [
              h(VueFader.Thumb, { "aria-label": "Level" }),
            ]),
            h(VueFader.Value),
          ]),
      })
    );
    expect(faderFeatures(fader)).toEqual(FADER);
    const pad = await renderVue(
      createSSRApp({
        render: () =>
          h(VueXYPad.Root, { value: { x: 25, y: 75 } }, () => [
            h(VueXYPad.Control, null, () => [
              h(VueXYPad.Thumb, { "aria-label": "Cursor" }),
            ]),
            h(VueXYPad.Value),
          ]),
      })
    );
    expect(padFeatures(pad)).toEqual(PAD);
  });

  test("the meter writes its channels, levels and indicators, in React and Vue", async () => {
    const meter = (markup: string) => ({
      channels: markup.match(/role="meter"/g)?.length,
      indicator: /scaleY\(0\.5\)/.test(markup),
      level: markup.includes('aria-valuenow="-30"'),
    });
    const expected = { channels: 2, indicator: true, level: true };
    const react = renderToString(
      <Meter.Root max={0} min={-60} value={[-30, -60]}>
        {({ channelCount }) =>
          Array.from({ length: channelCount }, (_, index) => (
            <Meter.Channel index={index} key={index}>
              <Meter.Indicator />
              <Meter.Value />
            </Meter.Channel>
          ))
        }
      </Meter.Root>
    );
    expect(meter(react)).toEqual(expected);
    const vue = await renderVue(
      createSSRApp({
        render: () =>
          h(
            VueMeter.Root,
            { max: 0, min: -60, value: [-30, -60] },
            {
              default: ({ state }: { state: { channelCount: number } }) =>
                Array.from({ length: state.channelCount }, (_, index) =>
                  h(VueMeter.Channel, { index, key: index }, () => [
                    h(VueMeter.Indicator),
                    h(VueMeter.Value),
                  ])
                ),
            }
          ),
      })
    );
    expect(meter(vue)).toEqual(expected);
  });

  test("the envelope writes its points, handles and curve, in React and Vue", async () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 1 },
      { x: 1, y: 0 },
    ];
    const markup = (html: string) => ({
      line: html.includes(`points="${polylinePoints(points)}"`),
      points: html.match(/role="slider"/g)?.length,
    });
    // Three points and two handles, all sliders.
    const expected = { line: true, points: 5 };
    const react = renderToString(
      <Envelope.Root value={points}>
        {({ value }) => (
          <>
            <Envelope.Graph>
              <Envelope.Line />
            </Envelope.Graph>
            {value.map((_, index) => (
              <Envelope.Point index={index} key={index} />
            ))}
            {value.slice(0, -1).map((_, index) => (
              <Envelope.Segment index={index} key={index} />
            ))}
          </>
        )}
      </Envelope.Root>
    );
    expect(markup(react)).toEqual(expected);
    const vue = await renderVue(
      createSSRApp({
        render: () =>
          h(
            VueEnvelope.Root,
            { value: points },
            {
              default: ({ state }: { state: { value: unknown[] } }) => [
                h(VueEnvelope.Graph, null, () => [h(VueEnvelope.Line)]),
                ...state.value.map((_, index) =>
                  h(VueEnvelope.Point, { index, key: index })
                ),
                ...state.value
                  .slice(0, -1)
                  .map((_, index) =>
                    h(VueEnvelope.Segment, { index, key: index })
                  ),
              ],
            }
          ),
      })
    );
    expect(markup(vue)).toEqual(expected);
  });

  test("the pad grid writes its buttons with one tab stop, in React", () => {
    const html = renderToString(
      <Pad.Root activePads={["snare"]} columns={2}>
        <Pad.Item value="kick">Kick</Pad.Item>
        <Pad.Item value="snare">Snare</Pad.Item>
      </Pad.Root>
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('role="group"');
    expect(html.match(/data-active/g)).toHaveLength(1);
  });

  test("the piano writes a button for each pitch, named by its note, in React", () => {
    const html = renderToString(
      <Piano.Root layout="even" maxPitch={62} minPitch={60}>
        {({ pitches }) =>
          pitches.map((pitch) => (
            <Piano.Key key={pitch} pitch={pitch}>
              <Piano.Label />
            </Piano.Key>
          ))
        }
      </Piano.Root>
    );
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('aria-label="C4"');
    expect(html).toContain(">C#4<");
  });

  test("the sequencer writes its rows and cells, with the pattern's state, in React", () => {
    const html = renderToString(
      <Sequencer.Root
        defaultValue={[
          [true, false],
          [false, true],
        ]}
      >
        {({ rows, steps }) =>
          Array.from({ length: rows }, (_, row) => (
            <Sequencer.Row index={row} key={row}>
              {Array.from({ length: steps }, (_, step) => (
                <Sequencer.Cell key={step} row={row} step={step} />
              ))}
            </Sequencer.Row>
          ))
        }
      </Sequencer.Root>
    );
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  test("the plot writes its handle's input and its grid's markup, in React", () => {
    const html = renderToString(
      <Plot.Root maxX={100} maxY={100}>
        <Plot.Grid y={{ ticks: [0, 50, 100] }} />
        <Plot.Handle
          aria-label="Cutoff"
          defaultValue={{ x: 25, y: 75 }}
          handle="cutoff"
        />
      </Plot.Root>
    );
    expect(html).toContain('data-slot="plot-grid"');
    expect(html.match(/type="range"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Cutoff');
  });

  test("the waveform writes its position, its input and its bars, in React", () => {
    const html = renderToString(
      <Waveform.Root duration={100} value={25}>
        <Waveform.Control aria-label="Position" />
        <Waveform.Playhead />
        <Waveform.Bars count={4} />
      </Waveform.Root>
    );
    expect(html).toContain("--waveform-position:25%");
    expect(html).toContain('aria-valuetext="25%"');
    expect(html).toContain('aria-label="Position"');
    expect(html.match(/data-slot="waveform-bar"/g)).toHaveLength(4);
  });

  test("the timeline writes its lanes' unit, its clip's place and its ruler's input, in React", () => {
    const html = renderToString(
      <Timeline.Root duration={100} position={25} zoom={10}>
        <Timeline.Viewport>
          <Timeline.Ruler aria-label="Position" />
          <Timeline.Lane>
            <Timeline.Playhead />
            <Timeline.Clip
              aria-label="Take"
              clip="a"
              defaultValue={{
                fadeIn: 0,
                fadeOut: 0,
                length: 20,
                offset: 0,
                start: 10,
              }}
            />
          </Timeline.Lane>
        </Timeline.Viewport>
      </Timeline.Root>
    );
    expect(html).toContain("--timeline-unit:10px");
    expect(html).toContain("--timeline-offset:25");
    expect(html).toContain('data-clip="a"');
    expect(html).toContain("--timeline-length:20");
    expect(html).toContain('aria-label="Position"');
  });
});
