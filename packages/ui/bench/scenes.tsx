import { type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Envelope } from "../src/entries/envelope";
import { Fader } from "../src/entries/fader";
import { Knob } from "../src/entries/knob";
import { Meter } from "../src/entries/meter";
import { PianoRoll } from "../src/entries/piano-roll";
import { Plot } from "../src/entries/plot";
import { Sequencer } from "../src/entries/sequencer";
import { Timeline } from "../src/entries/timeline";
import { Waveform } from "../src/entries/waveform";
import { XYPad } from "../src/entries/xypad";
import { createSource } from "../src/source";

declare global {
  interface Window {
    __changes: number;
    /** What a live scene does on one frame: emit the next value of its sources. */
    __tick?: (frame: number) => void;
  }
}

const count = () => {
  window.__changes += 1;
};

const NOTES = Array.from({ length: 500 }, (_, index) => ({
  id: `n${index}`,
  length: 1,
  pitch: 60 + (index % 12),
  start: index % 60,
  velocity: 0.8,
}));

const ENVELOPE = Array.from({ length: 64 }, (_, index) => ({
  x: index / 63,
  y: 0.5 + 0.4 * Math.sin(index / 4),
}));

const PATTERN = Array.from({ length: 16 }, (_, row) =>
  Array.from({ length: 64 }, (_, step) => false)
);

function PianoRoll500() {
  return (
    <Timeline.Root duration={64} snapStep={1}>
      <PianoRoll.Root
        defaultValue={NOTES}
        maxPitch={71}
        minPitch={60}
        onValueChange={count}
      >
        <PianoRoll.Grid aria-label="Notes" style={{ height: 240, width: 1280 }}>
          <PianoRoll.Rows>
            {(pitch) => (
              <PianoRoll.Row
                key={pitch}
                pitch={pitch}
                style={{
                  background: pitch % 2 ? "#0001" : undefined,
                  borderBottom: "1px solid #8884",
                }}
              />
            )}
          </PianoRoll.Rows>
          <PianoRoll.Notes>
            {(note) => (
              <PianoRoll.Note
                data-bench={note.id === "n0" ? "target" : undefined}
                key={note.id}
                note={note}
                style={{ background: "#59f", border: "1px solid #fff" }}
              >
                <PianoRoll.NoteHandle edge="start" />
                <PianoRoll.NoteHandle edge="end" />
              </PianoRoll.Note>
            )}
          </PianoRoll.Notes>
        </PianoRoll.Grid>
      </PianoRoll.Root>
    </Timeline.Root>
  );
}

function Sequencer1024() {
  return (
    <Sequencer.Root defaultValue={PATTERN} onValueChange={count}>
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row index={row} style={{ display: "flex" }}>
            <Sequencer.Cells>
              {(step) => (
                <Sequencer.Cell
                  aria-label={`Row ${row + 1}, step ${step + 1}`}
                  data-bench={row === 0 && step === 0 ? "target" : undefined}
                  step={step}
                  style={{
                    background: "#8883",
                    height: 16,
                    margin: 1,
                    width: 16,
                  }}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
}

function PlotHandle() {
  return (
    <Plot.Root
      maxX={100}
      maxY={10}
      minX={0}
      minY={0}
      style={{ height: 300, position: "relative", width: 600 }}
    >
      <Plot.Graph>
        <Plot.Curve fn={(x: number) => x / 10} />
        <Plot.Band axis="x" from={20} to={60} />
      </Plot.Graph>
      <Plot.Handle
        aria-label="Band"
        data-bench="target"
        defaultValue={{ x: 50, y: 5 }}
        onValueChange={count}
        style={{ background: "#f59", height: 14, width: 14 }}
      />
    </Plot.Root>
  );
}

function Envelope64() {
  const [value, setValue] = useState(ENVELOPE);
  return (
    <Envelope.Root
      onValueChange={(next) => {
        count();
        setValue(next);
      }}
      value={value}
    >
      <Envelope.Graph style={{ height: 200, width: 900 }}>
        <Envelope.Fill />
        <Envelope.Line />
      </Envelope.Graph>
      <Envelope.Points>
        {(_point, index) => (
          <Envelope.Point
            aria-label={`Point ${index}`}
            data-bench={index === 32 ? "target" : undefined}
            index={index}
            key={index}
            style={{ background: "#fa0", height: 10, width: 10 }}
          />
        )}
      </Envelope.Points>
    </Envelope.Root>
  );
}

function FaderControlled() {
  const [value, setValue] = useState(0);
  return (
    <Fader.Root
      max={6}
      min={-60}
      onValueChange={(next) => {
        count();
        setValue(next);
      }}
      value={value}
    >
      <Fader.Control
        data-bench="target"
        style={{ height: 300, position: "relative", width: 30 }}
      >
        <Fader.Track style={{ background: "#8884", height: "100%", width: 6 }}>
          <Fader.Indicator style={{ background: "#59f" }} />
        </Fader.Track>
        <Fader.Thumb aria-label="Volume" style={{ background: "#fff" }} />
      </Fader.Control>
    </Fader.Root>
  );
}

function KnobControlled() {
  const [value, setValue] = useState(50);
  return (
    <Knob.Root
      max={100}
      min={0}
      onValueChange={(next) => {
        count();
        setValue(next);
      }}
      value={value}
    >
      <Knob.Control
        data-bench="target"
        style={{ height: 160, position: "relative", width: 160 }}
      >
        <Knob.Track style={{ inset: 0, position: "absolute" }} />
        <Knob.Indicator style={{ inset: 0, position: "absolute" }} />
        <Knob.Thumb aria-label="Cutoff" />
      </Knob.Control>
      <Knob.Value />
    </Knob.Root>
  );
}

function XYPadControlled() {
  const [value, setValue] = useState({ x: 50, y: 50 });
  return (
    <XYPad.Root
      maxX={100}
      maxY={100}
      minX={0}
      minY={0}
      onValueChange={(next) => {
        count();
        setValue(next);
      }}
      value={value}
    >
      <XYPad.Control
        data-bench="target"
        style={{ height: 300, position: "relative", width: 300 }}
      >
        <XYPad.Thumb aria-label="Filter" />
      </XYPad.Control>
      <XYPad.Value />
    </XYPad.Root>
  );
}

const PEAKS = Array.from(
  { length: 2048 },
  (_, index) => 0.3 + 0.7 * Math.abs(Math.sin(index / 20))
);

function WaveformScrub() {
  const [value, setValue] = useState(10);
  return (
    <Waveform.Root
      duration={100}
      onValueChange={(next) => {
        count();
        setValue(next);
      }}
      peaks={PEAKS}
      value={value}
    >
      <Waveform.Control
        aria-label="Position"
        data-bench="target"
        style={{ height: 96, position: "relative", width: 1000 }}
      >
        <Waveform.Canvas style={{ height: "100%", width: "100%" }} />
        <Waveform.Playhead />
        <Waveform.Thumb />
      </Waveform.Control>
    </Waveform.Root>
  );
}

function TimelineScrub() {
  return (
    <Timeline.Root duration={1000} onPositionChange={count} snapStep={5}>
      <Timeline.Ruler
        aria-label="Position"
        data-bench="target"
        style={{ height: 32, width: 1000 }}
      >
        {Array.from({ length: 200 }, (_, index) => (
          <Timeline.Mark key={`mark-${index * 5}`} value={index * 5}>
            {index}
          </Timeline.Mark>
        ))}
      </Timeline.Ruler>
      <Timeline.Lane style={{ height: 32 }}>
        <Timeline.Playhead />
      </Timeline.Lane>
    </Timeline.Root>
  );
}

function SequencerVelocities() {
  return (
    <Sequencer.Root
      defaultValue={[new Array(64).fill(true)]}
      onVelocityChange={count}
    >
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row index={row} style={{ display: "flex" }}>
            <Sequencer.Cells>
              {(step) => (
                <Sequencer.Velocity
                  aria-label={`Step ${step + 1} velocity`}
                  data-bench={step === 0 ? "target" : undefined}
                  step={step}
                  style={{
                    background: "#8883",
                    height: 120,
                    margin: "0 1px",
                    width: 14,
                  }}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
}

const sweepTo = (index: number, span: number, period = 90) => {
  const phase = (index % period) / period;
  return span * (phase < 0.5 ? phase * 2 : 2 - phase * 2);
};

/** Live scenes: sources a clock would feed once per frame. */
const meterSource = createSource({ levels: new Array(32).fill(-60) });
const positionSource = createSource(0);
const stepSource = createSource(-1);

const ticks: Record<string, (frame: number) => void> = {
  "live-meter-32": (frame) =>
    meterSource.set({
      levels: Array.from(
        { length: 32 },
        (_, channel) => -60 + sweepTo(frame + channel * 7, 60)
      ),
    }),
  "live-sequencer-step": (frame) => stepSource.set(Math.floor(frame / 4) % 64),
  "live-timeline-playhead": (frame) =>
    positionSource.set(sweepTo(frame, 1000, 240)),
  "live-waveform-playhead": (frame) =>
    positionSource.set(sweepTo(frame, 100, 240)),
};

function LiveMeter() {
  return (
    <Meter.Root
      aria-label="Out"
      max={0}
      min={-60}
      source={meterSource}
      style={{ display: "flex", gap: 2, height: 160 }}
    >
      <Meter.Channels>
        {(index) => (
          <Meter.Channel
            aria-label={`Ch ${index}`}
            index={index}
            key={index}
            style={{ background: "#8883", height: 160, width: 12 }}
          >
            <Meter.Indicator style={{ background: "#5c8" }} />
            <Meter.Peak />
            <Meter.Value />
          </Meter.Channel>
        )}
      </Meter.Channels>
    </Meter.Root>
  );
}

function LiveSequencerStep() {
  return (
    <Sequencer.Root defaultValue={PATTERN} source={stepSource}>
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row index={row} style={{ display: "flex" }}>
            <Sequencer.Cells>
              {(step) => (
                <Sequencer.Cell
                  aria-label={`Row ${row + 1}, step ${step + 1}`}
                  step={step}
                  style={{
                    background: "#8883",
                    height: 16,
                    margin: 1,
                    width: 16,
                  }}
                />
              )}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
}

function LiveTimelinePlayhead() {
  return (
    <Timeline.Root duration={1000} source={positionSource}>
      <Timeline.Ruler aria-label="Position" style={{ height: 32, width: 1000 }}>
        {Array.from({ length: 200 }, (_, index) => (
          <Timeline.Mark key={`mark-${index * 5}`} value={index * 5}>
            {index}
          </Timeline.Mark>
        ))}
      </Timeline.Ruler>
      <Timeline.Lane style={{ height: 32 }}>
        <Timeline.Playhead />
      </Timeline.Lane>
    </Timeline.Root>
  );
}

function LiveWaveformPlayhead() {
  return (
    <Waveform.Root duration={100} peaks={PEAKS} source={positionSource}>
      <Waveform.Control
        aria-label="Position"
        style={{ height: 96, position: "relative", width: 1000 }}
      >
        <Waveform.Canvas style={{ height: "100%", width: "100%" }} />
        <Waveform.Playhead />
        <Waveform.Thumb />
      </Waveform.Control>
    </Waveform.Root>
  );
}

const scenes: Record<string, ReactNode> = {
  envelope64: <Envelope64 />,
  fader: <FaderControlled />,
  knob: <KnobControlled />,
  "live-meter-32": <LiveMeter />,
  "live-sequencer-step": <LiveSequencerStep />,
  "live-timeline-playhead": <LiveTimelinePlayhead />,
  "live-waveform-playhead": <LiveWaveformPlayhead />,
  "piano-roll-500": <PianoRoll500 />,
  plot: <PlotHandle />,
  "sequencer-1024": <Sequencer1024 />,
  "sequencer-velocities": <SequencerVelocities />,
  timeline: <TimelineScrub />,
  waveform: <WaveformScrub />,
  xypad: <XYPadControlled />,
};

window.__changes = 0;
const name = location.hash.slice(1);
const tick = ticks[name];
if (tick) {
  window.__tick = (frame) => {
    count();
    tick(frame);
  };
}
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <div style={{ padding: 40 }}>{scenes[name] ?? null}</div>
  );
}
