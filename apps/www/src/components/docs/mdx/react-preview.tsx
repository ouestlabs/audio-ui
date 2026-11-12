"use client";

import { createSource } from "@audio-ui/core";
import { Fader, Knob, Meter, Pad, Sequencer, XYPad } from "@audio-ui/react";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useMemo,
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
  | "fader"
  | "knob"
  | "meter"
  | "pad"
  | "sequencer"
  | "xypad";

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

const PREVIEWS: Record<ReactPreviewName, () => ReactNode> = {
  fader: FaderPreview,
  knob: KnobPreview,
  meter: MeterPreview,
  pad: PadPreview,
  sequencer: SequencerPreview,
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
        : moduleClass(partName);
    },
    [styling]
  );
  const Preview = PREVIEWS[name];
  return (
    <Frame className="mt-4 mb-8" data-slot="react-preview" style={style}>
      {styling === "css" && SKINS[name] ? (
        // The sheet the page shows, scoped to this preview.
        <style>{`@scope ([data-slot="react-preview"]) {\n${moduleCss(name)}\n}`}</style>
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
