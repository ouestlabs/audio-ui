"use client";

import { createSource } from "@audio-ui/core";
import {
  Envelope,
  Fader,
  Knob,
  Meter,
  Pad,
  Piano,
  PianoRoll,
  Plot,
  Sequencer,
  Timeline,
  Waveform,
  XYPad,
} from "@audio-ui/react";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { PreviewCode } from "@/components/docs/mdx/preview-code";
import { PreviewPanel } from "@/components/preview/frame/preview-frame";
import { Frame } from "@/components/site/layout/frame";
import { usePreviewLook } from "@/hooks/use-preview-look";
import { SKINS } from "@/lib/docs/content/element-skins";
import { exampleOf } from "@/lib/docs/content/primitive-examples";
import {
  moduleClass,
  moduleCss,
  tailwindClasses,
} from "@/lib/docs/content/react-usage";

/** The primitives with a live preview. */
export type ReactPreviewName =
  | "envelope"
  | "fader"
  | "knob"
  | "meter"
  | "pad"
  | "piano"
  | "piano-roll"
  | "plot"
  | "sequencer"
  | "timeline"
  | "waveform"
  | "xypad";

/** In front of the classes of the preview's sheet, which a page's own utilities (`grid`) would otherwise meet. */
const PREFIX = "preview-";

/** The class of a part by its name: the skin's Tailwind ones, or the sheet's class for it. */
const PartContext = createContext<(part: string) => string | undefined>(
  () => undefined
);

function usePart(entry: string) {
  const part = use(PartContext);
  return useCallback((name: string) => part(`${entry}:${name}`), [entry, part]);
}

/** What an example gives a preview's root, over its own props. */
type RootProps = Readonly<Record<string, boolean | number | string>>;

function KnobPreview({ rootProps }: { rootProps?: RootProps }) {
  const p = usePart("knob");
  return (
    <Knob.Root
      className={p("Root")}
      defaultValue={40}
      max={100}
      min={0}
      {...rootProps}
    >
      <Knob.Label className={p("Label")}>Volume</Knob.Label>
      <Knob.Control className={p("Control")}>
        <Knob.Track className={p("Track")} />
        <Knob.Indicator className={p("Indicator")} />
        <Knob.Thumb className={p("Thumb")} />
      </Knob.Control>
      <Knob.Value className={p("Value")} />
    </Knob.Root>
  );
}

function FaderPreview() {
  const p = usePart("fader");
  return (
    <Fader.Root className={p("Root")} defaultValue={-6}>
      <Fader.Control className={p("Control")}>
        <Fader.Track className={p("Track")}>
          <Fader.Indicator className={p("Indicator")} />
        </Fader.Track>
        <Fader.Thumb aria-label="Volume" className={p("Thumb")} />
      </Fader.Control>
    </Fader.Root>
  );
}

const PADS = ["Kick", "Snare", "Clap", "Rim", "Hat", "Open", "Tom", "Ride"];

function PadPreview() {
  const p = usePart("pad");
  return (
    <Pad.Root aria-label="Drums" className={p("Root")}>
      {PADS.map((label) => (
        <Pad.Item className={p("Item")} key={label} value={label}>
          {label}
        </Pad.Item>
      ))}
    </Pad.Root>
  );
}

function XYPadPreview() {
  const p = usePart("xypad");
  return (
    <XYPad.Root className={p("Root")} defaultValue={{ x: 30, y: 70 }}>
      <XYPad.Control className={p("Control")}>
        <XYPad.Thumb aria-label="Filter" className={p("Thumb")} />
      </XYPad.Control>
      <XYPad.Value className={p("Value")} />
    </XYPad.Root>
  );
}

/** Two channels moving like a signal, from a live source the meter follows. */
function MeterPreview() {
  const p = usePart("meter");
  const source = useMemo(
    () => createSource({ levels: [-60, -60], peaks: [-60, -60] }),
    []
  );
  useEffect(() => {
    const peaks = [-60, -60];
    let frame = 0;
    const tick = (time: number) => {
      const levels = [0, 1].map(
        (channel) =>
          -30 +
          18 * Math.sin(time / (420 + channel * 90)) +
          8 * Math.sin(time / (130 + channel * 40))
      );
      for (const [index, level] of levels.entries()) {
        peaks[index] = Math.max(level, (peaks[index] ?? -60) - 0.4);
      }
      source.set({ levels, peaks: [...peaks] });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [source]);
  return (
    <Meter.Root className={p("Root")} max={6} min={-60} source={source}>
      <Meter.Channels>
        {(index) => (
          <Meter.Channel
            aria-label={index === 0 ? "Left" : "Right"}
            className={p("Channel")}
            index={index}
          >
            <Meter.Indicator className={p("Indicator")} />
            <Meter.Peak className={p("Peak")} />
          </Meter.Channel>
        )}
      </Meter.Channels>
    </Meter.Root>
  );
}

const PATTERN = [
  "x...x...x...x...",
  "....x.......x...",
  "x.x.x.x.x.x.x.xx",
].map((row) => [...row].map((step) => step === "x"));

function SequencerPreview() {
  const p = usePart("sequencer");
  return (
    <Sequencer.Root
      aria-label="Pattern"
      className={p("Root")}
      defaultValue={PATTERN}
    >
      <Sequencer.Rows>
        {(row) => (
          <Sequencer.Row className={p("Row")} index={row}>
            <Sequencer.Cells>
              {(step) => <Sequencer.Cell className={p("Cell")} step={step} />}
            </Sequencer.Cells>
          </Sequencer.Row>
        )}
      </Sequencer.Rows>
    </Sequencer.Root>
  );
}

function PianoPreview() {
  const p = usePart("piano");
  return (
    <Piano.Root
      aria-label="Keys"
      className={p("Root")}
      maxPitch={71}
      minPitch={48}
    >
      <Piano.Keys>
        {(pitch) => <Piano.Key className={p("Key")} pitch={pitch} />}
      </Piano.Keys>
    </Piano.Root>
  );
}

const ENVELOPE = [
  { x: 0, y: 0 },
  { x: 0.12, y: 1 },
  { curve: 0.4, x: 0.35, y: 0.6 },
  { x: 0.75, y: 0.6 },
  { x: 1, y: 0 },
];

function EnvelopePreview() {
  const p = usePart("envelope");
  return (
    <Envelope.Root
      aria-label="Amp envelope"
      className={p("Root")}
      defaultValue={ENVELOPE}
    >
      <Envelope.Graph className={p("Graph")}>
        <Envelope.Fill className={p("Fill")} />
        <Envelope.Line className={p("Line")} />
      </Envelope.Graph>
      <Envelope.Segments>
        {(_, index) => (
          <Envelope.Segment className={p("Segment")} index={index} />
        )}
      </Envelope.Segments>
      <Envelope.Points>
        {(_, index) => <Envelope.Point className={p("Point")} index={index} />}
      </Envelope.Points>
    </Envelope.Root>
  );
}

/** A peaking band's response in dB at `hz`, around the band's center. */
const bell = (hz: number, { x, y }: { x: number; y: number }) =>
  y * Math.exp(-(Math.log2(hz / x) ** 2) * 1.6);

function PlotPreview() {
  const p = usePart("plot");
  // The curve follows the handle as it is dragged.
  const [band, setBand] = useState({ x: 800, y: 6 });
  const curve = useCallback((hz: number) => bell(hz, band), [band]);
  return (
    <Plot.Root
      className={p("Root")}
      maxX={20_000}
      maxY={18}
      minX={20}
      minY={-18}
      scaleX="log"
    >
      <Plot.Grid className={p("Grid")} x={{}} y={{}} />
      <Plot.Graph>
        <Plot.Curve className={p("Curve")} fillTo={0} fn={curve} />
      </Plot.Graph>
      <Plot.Handle
        aria-label="Band"
        className={p("Handle")}
        onValueChange={setBand}
        value={band}
      />
    </Plot.Root>
  );
}

const PEAKS = Array.from({ length: 480 }, (_, index) => {
  const envelope = 0.25 + 0.75 * Math.abs(Math.sin(index / 37));
  return envelope * (0.35 + 0.65 * Math.abs(Math.sin(index / 3.3)));
});

function WaveformPreview() {
  const p = usePart("waveform");
  return (
    <Waveform.Root
      className={p("Root")}
      defaultValue={30}
      duration={96}
      peaks={PEAKS}
    >
      <Waveform.Control aria-label="Seek" className={p("Control")}>
        <Waveform.Canvas className={p("Canvas")} />
        <Waveform.Region className={p("Region")} defaultValue={[54, 72]}>
          <Waveform.RegionHandle
            aria-label="Loop start"
            className={p("RegionHandle")}
            edge="start"
          />
          <Waveform.RegionHandle
            aria-label="Loop end"
            className={p("RegionHandle")}
            edge="end"
          />
        </Waveform.Region>
        <Waveform.Playhead className={p("Playhead")} />
      </Waveform.Control>
    </Waveform.Root>
  );
}

const BARS = [0, 4, 8, 12, 16, 20, 24, 28];
const TRACKS = [
  { clip: "Beat", length: 8, name: "Drums", start: 0 },
  { clip: "Bass line", length: 12, name: "Bass", start: 8 },
];

function TimelinePreview() {
  const p = usePart("timeline");
  return (
    <Timeline.Root className={p("Root")} duration={32} snapStep={1}>
      <Timeline.Viewport className={p("Viewport")}>
        <Timeline.Ruler aria-label="Position" className={p("Ruler")}>
          {BARS.map((bar) => (
            <Timeline.Mark className={p("Mark")} key={bar} value={bar}>
              {bar / 4 + 1}
            </Timeline.Mark>
          ))}
          <Timeline.Range
            aria-label="Loop"
            className={p("Range")}
            defaultValue={[8, 16]}
          />
        </Timeline.Ruler>
        {TRACKS.map((track) => (
          <Timeline.Track className={p("Track")} key={track.name}>
            <Timeline.TrackHeader className={p("TrackHeader")}>
              {track.name}
            </Timeline.TrackHeader>
            <Timeline.Lane className={p("Lane")}>
              <Timeline.Clip
                aria-label={track.clip}
                className={p("Clip")}
                defaultValue={{
                  fadeIn: 0,
                  fadeOut: 0,
                  length: track.length,
                  offset: 0,
                  start: track.start,
                }}
              >
                <Timeline.ClipHeader className={p("ClipHeader")}>
                  {track.clip}
                </Timeline.ClipHeader>
                <Timeline.ClipHandle
                  aria-label="Trim start"
                  className={p("ClipHandle")}
                  edge="start"
                />
                <Timeline.ClipHandle
                  aria-label="Trim end"
                  className={p("ClipHandle")}
                  edge="end"
                />
              </Timeline.Clip>
              <Timeline.Playhead className={p("Playhead")} />
            </Timeline.Lane>
          </Timeline.Track>
        ))}
      </Timeline.Viewport>
      <Timeline.Navigator className={p("Navigator")}>
        <Timeline.NavigatorWindow
          aria-label="View"
          className={p("NavigatorWindow")}
        />
      </Timeline.Navigator>
    </Timeline.Root>
  );
}

const NOTES = [
  { id: "a", length: 1, pitch: 60, start: 0, velocity: 0.9 },
  { id: "b", length: 1, pitch: 64, start: 1, velocity: 0.6 },
  { id: "c", length: 1, pitch: 67, start: 2, velocity: 0.75 },
  { id: "d", length: 2, pitch: 72, start: 3, velocity: 1 },
  { id: "e", length: 1.5, pitch: 69, start: 5, velocity: 0.5 },
  { id: "f", length: 1.5, pitch: 65, start: 6.5, velocity: 0.7 },
];

function PianoRollPreview() {
  const p = usePart("piano-roll");
  return (
    <Timeline.Root className={p("Timeline.Root")} duration={8} snapStep={0.5}>
      <PianoRoll.Root
        className={p("Root")}
        defaultValue={NOTES}
        maxPitch={74}
        minPitch={57}
        mode="draw"
      >
        <PianoRoll.Keys className={p("Keys")}>
          <PianoRoll.Rows>
            {(pitch) => <PianoRoll.Key className={p("Key")} pitch={pitch} />}
          </PianoRoll.Rows>
        </PianoRoll.Keys>
        <Timeline.Viewport className={p("Timeline.Viewport")}>
          <PianoRoll.Grid aria-label="Notes" className={p("Grid")}>
            <PianoRoll.Rows>
              {(pitch) => <PianoRoll.Row className={p("Row")} pitch={pitch} />}
            </PianoRoll.Rows>
            <PianoRoll.Notes>
              {(note) => (
                <PianoRoll.Note
                  className={p("Note")}
                  key={note.id}
                  note={note}
                />
              )}
            </PianoRoll.Notes>
            <PianoRoll.Marquee className={p("Marquee")} />
            <Timeline.Playhead className={p("Timeline.Playhead")} />
          </PianoRoll.Grid>
        </Timeline.Viewport>
        <PianoRoll.VelocityLane
          aria-label="Velocity"
          className={p("VelocityLane")}
        >
          <PianoRoll.Notes>
            {(note) => (
              <PianoRoll.Velocity
                className={p("Velocity")}
                key={note.id}
                note={note}
              />
            )}
          </PianoRoll.Notes>
        </PianoRoll.VelocityLane>
      </PianoRoll.Root>
    </Timeline.Root>
  );
}

const PREVIEWS: Record<
  ReactPreviewName,
  (props: { rootProps?: RootProps }) => ReactNode
> = {
  envelope: EnvelopePreview,
  fader: FaderPreview,
  knob: KnobPreview,
  meter: MeterPreview,
  pad: PadPreview,
  piano: PianoPreview,
  "piano-roll": PianoRollPreview,
  plot: PlotPreview,
  sequencer: SequencerPreview,
  timeline: TimelinePreview,
  waveform: WaveformPreview,
  xypad: XYPadPreview,
};

/**
 * A live preview of one React primitive, in the styling the reader chose:
 * the parts take the skin's Tailwind classes, or the classes of the CSS
 * Modules sheet the page shows, scoped to the preview.
 */
export function ReactPreview({
  children,
  example,
  name,
}: {
  /** The code of the preview, shown under it: a few lines until View Code. */
  children?: ReactNode;
  /** An example of the page's primitive, from `primitive-examples.ts`: its props over the usage's. */
  example?: string;
  name: ReactPreviewName;
}) {
  const { style, styling } = usePreviewLook();
  const part = useCallback(
    (key: string) => {
      const [entry = "", partName = ""] = key.split(":");
      return styling === "tailwind"
        ? tailwindClasses(entry, partName)
        : moduleClass(partName, PREFIX);
    },
    [styling]
  );
  const Preview = PREVIEWS[name];
  return (
    <Frame className="mt-4 mb-8" data-slot="react-preview" style={style}>
      {styling === "css" && SKINS[name] ? (
        // The sheet the page shows, scoped to this preview.
        <style>{`@scope ([data-slot="react-preview"]) {\n${moduleCss(name, PREFIX)}\n}`}</style>
      ) : null}
      <PreviewPanel className="min-h-64 gap-4 px-4">
        <div className="flex w-full items-center justify-center">
          <PartContext value={part}>
            <Preview rootProps={exampleOf(name, example)?.props} />
          </PartContext>
        </div>
      </PreviewPanel>
      {children ? <PreviewCode>{children}</PreviewCode> : null}
    </Frame>
  );
}
