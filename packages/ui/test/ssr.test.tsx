import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { Envelope } from "../src/entries/envelope.ts";
import { Fader } from "../src/entries/fader.ts";
import { Knob } from "../src/entries/knob.ts";
import { Meter } from "../src/entries/meter.ts";
import { Pad } from "../src/entries/pad.ts";
import { Piano } from "../src/entries/piano.ts";
import { PianoRoll } from "../src/entries/piano-roll.ts";
import { Plot } from "../src/entries/plot.ts";
import { Sequencer } from "../src/entries/sequencer.ts";
import { Timeline } from "../src/entries/timeline.ts";
import { Waveform } from "../src/entries/waveform.ts";
import { XYPad } from "../src/entries/xypad.ts";

/**
 * Frameworks render client components on the server too (Next.js prerenders
 * every page): each primitive must render there, where an external store needs
 * its server snapshot.
 */
const tenth = (x: number) => x / 10;

const CASES: Record<string, () => ReactNode> = {
  Envelope: () => (
    <Envelope.Root
      defaultValue={[
        { x: 0, y: 0 },
        { x: 0.5, y: 1 },
        { x: 1, y: 0 },
      ]}
    >
      <Envelope.Graph>
        <Envelope.Line />
      </Envelope.Graph>
      <Envelope.Points>
        {(_point, index) => (
          <Envelope.Point
            aria-label={`Point ${index + 1}`}
            index={index}
            key={`point-${index + 1}`}
          />
        )}
      </Envelope.Points>
    </Envelope.Root>
  ),
  Fader: () => (
    <Fader.Root defaultValue={0} max={6} min={-60}>
      <Fader.Control>
        <Fader.Track>
          <Fader.Indicator />
        </Fader.Track>
        <Fader.Thumb aria-label="Volume" />
      </Fader.Control>
    </Fader.Root>
  ),
  Knob: () => (
    <Knob.Root defaultValue={50} max={100} min={0}>
      <Knob.Control>
        <Knob.Track />
        <Knob.Indicator />
        <Knob.Thumb aria-label="Cutoff" />
      </Knob.Control>
      <Knob.Value />
    </Knob.Root>
  ),
  Meter: () => (
    <Meter.Root value={[-12]}>
      <Meter.Channel aria-label="Left" index={0} />
    </Meter.Root>
  ),
  Pad: () => (
    <Pad.Root aria-label="Pads">
      <Pad.Item value="kick">Kick</Pad.Item>
    </Pad.Root>
  ),
  Piano: () => (
    <Piano.Root aria-label="Piano" maxPitch={60} minPitch={48}>
      <Piano.Keys>
        {(pitch) => <Piano.Key key={pitch} pitch={pitch} />}
      </Piano.Keys>
    </Piano.Root>
  ),
  PianoRoll: () => (
    <Timeline.Root duration={16} snapStep={1}>
      <PianoRoll.Root
        defaultValue={[
          { id: "a", length: 2, pitch: 60, start: 0, velocity: 1 },
        ]}
        maxPitch={63}
        minPitch={60}
      >
        <PianoRoll.Keys aria-label="Keys">
          <PianoRoll.Rows>
            {(pitch) => <PianoRoll.Key key={pitch} pitch={pitch} />}
          </PianoRoll.Rows>
        </PianoRoll.Keys>
        <PianoRoll.Grid aria-label="Notes">
          <PianoRoll.Rows>
            {(pitch) => <PianoRoll.Row key={pitch} pitch={pitch} />}
          </PianoRoll.Rows>
          <PianoRoll.Notes>
            {(note) => <PianoRoll.Note key={note.id} note={note} />}
          </PianoRoll.Notes>
        </PianoRoll.Grid>
      </PianoRoll.Root>
    </Timeline.Root>
  ),
  Plot: () => (
    <Plot.Root maxX={100} maxY={10} minX={0} minY={0}>
      <Plot.Graph>
        <Plot.Curve fn={tenth} />
      </Plot.Graph>
      <Plot.Handle aria-label="Band" defaultValue={{ x: 50, y: 5 }} />
    </Plot.Root>
  ),
  Sequencer: () => (
    <Sequencer.Root aria-label="Pattern" defaultValue={[[true, false]]}>
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row aria-label={`Row ${row + 1}`} index={row} key={row}>
            <Sequencer.Cells>
              {(step) => (
                <Sequencer.Cell
                  aria-label={`Step ${step + 1}`}
                  key={step}
                  step={step}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  ),
  Timeline: () => (
    <Timeline.Root duration={100}>
      <Timeline.Ruler aria-label="Position" />
      <Timeline.Track>
        <Timeline.TrackHeader>
          <Timeline.TrackResizeHandle aria-label="Height" />
        </Timeline.TrackHeader>
        <Timeline.Lane>
          <Timeline.Clip
            aria-label="Clip"
            defaultValue={{
              fadeIn: 0,
              fadeOut: 0,
              length: 10,
              offset: 0,
              start: 0,
            }}
          >
            <Timeline.ClipHandle aria-label="Start" edge="start" />
          </Timeline.Clip>
          <Timeline.Range aria-label="Loop" defaultValue={[20, 60]}>
            <Timeline.RangeHandle aria-label="Loop start" edge="start" />
          </Timeline.Range>
          <Timeline.Playhead />
        </Timeline.Lane>
      </Timeline.Track>
      <Timeline.Navigator>
        <Timeline.NavigatorWindow aria-label="Visible range" />
      </Timeline.Navigator>
    </Timeline.Root>
  ),
  Waveform: () => (
    <Waveform.Root duration={100} peaks={[0.2, 0.5, 0.8, 0.4]}>
      <Waveform.Control aria-label="Position">
        <Waveform.Canvas />
        <Waveform.Region defaultValue={[30, 40]} />
        <Waveform.Hover />
      </Waveform.Control>
    </Waveform.Root>
  ),
  XYPad: () => (
    <XYPad.Root
      defaultValue={{ x: 50, y: 50 }}
      maxX={100}
      maxY={100}
      minX={0}
      minY={0}
    >
      <XYPad.Control>
        <XYPad.Thumb aria-label="Filter" />
      </XYPad.Control>
      <XYPad.Value />
    </XYPad.Root>
  ),
};

describe("Server rendering", () => {
  for (const [name, render] of Object.entries(CASES)) {
    test(`${name} renders on the server`, () => {
      expect(renderToString(render()).length).toBeGreaterThan(0);
    });
  }
});
