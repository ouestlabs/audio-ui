"use client";

import { createSource } from "@audio-ui/core";
import {
  Envelope,
  Fader,
  Knob,
  Meter,
  Pad,
  Piano,
  Plot,
  Sequencer,
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
import { PreviewPanel } from "@/components/preview/frame/preview-frame";
import { Frame } from "@/components/site/layout/frame";
import { usePreviewLook } from "@/hooks/use-preview-look";
import { SKINS } from "@/lib/docs/content/element-skins";
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
  | "plot"
  | "sequencer"
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

function KnobPreview() {
  const p = usePart("knob");
  return (
    <Knob.Root className={p("Root")} defaultValue={40} max={100} min={0}>
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

const PREVIEWS: Record<ReactPreviewName, () => ReactNode> = {
  envelope: EnvelopePreview,
  fader: FaderPreview,
  knob: KnobPreview,
  meter: MeterPreview,
  pad: PadPreview,
  piano: PianoPreview,
  plot: PlotPreview,
  sequencer: SequencerPreview,
  waveform: WaveformPreview,
  xypad: XYPadPreview,
};

/**
 * A live preview of one React primitive, in the styling the reader chose:
 * the parts take the skin's Tailwind classes, or the classes of the CSS
 * Modules sheet the page shows, scoped to the preview.
 */
export function ReactPreview({ name }: { name: ReactPreviewName }) {
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
            <Preview />
          </PartContext>
        </div>
      </PreviewPanel>
    </Frame>
  );
}
