"use client";

import { createSource } from "@audio-ui/core";
import type { MeterElement, PlotCurveElement } from "@audio-ui/elements";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { PreviewCode } from "@/components/docs/mdx/preview-code";
import { PreviewPanel } from "@/components/preview/frame/preview-frame";
import { Frame } from "@/components/site/layout/frame";
import { usePreviewLook } from "@/hooks/use-preview-look";
import { elementAttributes } from "@/lib/docs/content/element-attributes";
import { SKINS } from "@/lib/docs/content/element-skins";
import { exampleOf } from "@/lib/docs/content/primitive-examples";

/** The primitives with a live preview, by entry point. */
export type ElementsPreviewName =
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

/** Loads one entry point, which registers its elements. On the client only: the elements register when their module runs. */
const ENTRIES: Record<ElementsPreviewName, () => Promise<unknown>> = {
  envelope: () => import("@audio-ui/elements/envelope"),
  fader: () => import("@audio-ui/elements/fader"),
  knob: () => import("@audio-ui/elements/knob"),
  meter: () => import("@audio-ui/elements/meter"),
  pad: () => import("@audio-ui/elements/pad"),
  piano: () => import("@audio-ui/elements/piano"),
  "piano-roll": () => import("@audio-ui/elements/piano-roll"),
  plot: () => import("@audio-ui/elements/plot"),
  sequencer: () => import("@audio-ui/elements/sequencer"),
  timeline: () => import("@audio-ui/elements/timeline"),
  waveform: () => import("@audio-ui/elements/waveform"),
  xypad: () => import("@audio-ui/elements/xypad"),
};

/** The events each preview reports, below it. */
const EVENTS: Record<ElementsPreviewName, readonly string[]> = {
  envelope: ["input", "change"],
  fader: ["input", "change"],
  knob: ["input", "change"],
  meter: [],
  pad: ["padon", "padoff"],
  piano: ["noteon", "noteoff"],
  "piano-roll": ["change", "noteselect", "noteon"],
  plot: ["input", "change"],
  sequencer: ["change", "velocitychange"],
  timeline: ["change", "clipchange", "rangechange", "zoomchange"],
  waveform: ["change", "regionchange"],
  xypad: ["input", "change"],
};

const PROMPTS: Record<ElementsPreviewName, string> = {
  envelope: "Drag a point, double-click the graph to add one",
  fader: "Drag the thumb or press the track",
  knob: "Drag the knob or use the arrow keys",
  meter: "Levels from a live source",
  pad: "Strike a pad, or several at once",
  piano: "Play the keys, or glide across them",
  "piano-roll": "Draw, drag and select notes",
  plot: "Drag the band's handle",
  sequencer: "Toggle steps, or drag across them",
  timeline: "Move a clip, seek on the ruler, Cmd/Ctrl + wheel to zoom",
  waveform: "Seek, scrub, or drag the loop",
  xypad: "Drag the point",
};

const round = (value: number) => Math.round(value * 100) / 100;

/** A short text for an event's detail, whatever the primitive. */
function describe(detail: Record<string, unknown> | null): string {
  if (!detail) {
    return "";
  }
  const { pitch, selection, value, velocity } = detail;
  if (typeof pitch === "number") {
    return `pitch ${pitch}${typeof velocity === "number" ? `, velocity ${round(velocity)}` : ""}`;
  }
  if (Array.isArray(selection)) {
    return `${selection.length} selected`;
  }
  if (typeof value === "number") {
    return String(round(value));
  }
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === "number")
      ? `[${value.map(round).join(", ")}]`
      : `${value.length} items`;
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => typeof item === "number")
      .map(([key, item]) => `${key} ${round(item as number)}`)
      .join(", ");
  }
  return "";
}

/** The classes of a part by its tag: the skin's Tailwind ones, or none when a stylesheet styles the parts. */
const PartContext = createContext<(tag: string) => string | undefined>(
  () => undefined
);

/** The attributes an example gives a preview's root element, over its own. */
type RootAttributes = Readonly<Record<string, string | undefined>>;

function Knob({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-knob
      className={part("audio-ui-knob")}
      max="100"
      min="0"
      value="40"
      {...rootAttributes}
    >
      <audio-ui-knob-control className={part("audio-ui-knob-control")}>
        <audio-ui-knob-track className={part("audio-ui-knob-track")} />
        <audio-ui-knob-indicator className={part("audio-ui-knob-indicator")} />
        <audio-ui-knob-thumb
          aria-label="Cutoff"
          className={part("audio-ui-knob-thumb")}
        />
      </audio-ui-knob-control>
      <audio-ui-knob-value className={part("audio-ui-knob-value")} />
    </audio-ui-knob>
  );
}

function Fader({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-fader
      className={part("audio-ui-fader")}
      value="-6"
      {...rootAttributes}
    >
      <audio-ui-fader-control className={part("audio-ui-fader-control")}>
        <audio-ui-fader-track className={part("audio-ui-fader-track")}>
          <audio-ui-fader-indicator
            className={part("audio-ui-fader-indicator")}
          />
        </audio-ui-fader-track>
        <audio-ui-fader-thumb
          aria-label="Volume"
          className={part("audio-ui-fader-thumb")}
        />
      </audio-ui-fader-control>
    </audio-ui-fader>
  );
}

const PADS = ["Kick", "Snare", "Clap", "Rim", "Hat", "Open", "Tom", "Ride"];

function Pad({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-pad
      aria-label="Drums"
      className={part("audio-ui-pad")}
      {...rootAttributes}
    >
      {PADS.map((label) => (
        <audio-ui-pad-item
          className={part("audio-ui-pad-item")}
          key={label}
          value={label}
        >
          {label}
        </audio-ui-pad-item>
      ))}
    </audio-ui-pad>
  );
}

function Piano({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-piano
      aria-label="Keys"
      className={part("audio-ui-piano")}
      max-pitch="71"
      min-pitch="48"
      {...rootAttributes}
    >
      <audio-ui-piano-keys className={part("audio-ui-piano-keys")} />
    </audio-ui-piano>
  );
}

function XYPad({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-xypad
      className={part("audio-ui-xypad")}
      value="30 70"
      {...rootAttributes}
    >
      <audio-ui-xypad-control className={part("audio-ui-xypad-control")}>
        <audio-ui-xypad-thumb
          aria-label="Filter"
          className={part("audio-ui-xypad-thumb")}
        />
      </audio-ui-xypad-control>
      <audio-ui-xypad-value className={part("audio-ui-xypad-value")} />
    </audio-ui-xypad>
  );
}

/** Two channels moving like a signal, from a live source the meter follows. */
function Meter({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const meter = ref.current;
    if (!meter) {
      return;
    }
    const source = createSource({ levels: [-60, -60], peaks: [-60, -60] });
    (meter as MeterElement).source = source;
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
  }, []);
  return (
    <audio-ui-meter
      className={part("audio-ui-meter")}
      max="6"
      min="-60"
      ref={ref}
      unit="dB"
      warn-threshold="-12"
      {...rootAttributes}
    >
      {[0, 1].map((index) => (
        <audio-ui-meter-channel
          aria-label={index === 0 ? "Left" : "Right"}
          className={part("audio-ui-meter-channel")}
          index={index}
          key={index}
        >
          <audio-ui-meter-indicator
            className={part("audio-ui-meter-indicator")}
          />
          <audio-ui-meter-peak className={part("audio-ui-meter-peak")} />
        </audio-ui-meter-channel>
      ))}
    </audio-ui-meter>
  );
}

const ROWS = ["Kick", "Snare", "Hat"];
const STEPS = Array.from({ length: 16 }, (_, index) => index);

function Sequencer({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-sequencer
      aria-label="Pattern"
      className={part("audio-ui-sequencer")}
      default-value="x...x...x...x... ....x.......x... x.x.x.x.x.x.x.xx"
      {...rootAttributes}
    >
      {ROWS.map((label, row) => (
        <audio-ui-sequencer-row
          aria-label={label}
          className={part("audio-ui-sequencer-row")}
          index={row}
          key={label}
        >
          {STEPS.map((step) => (
            <audio-ui-sequencer-cell
              className={part("audio-ui-sequencer-cell")}
              key={step}
              step={step}
            />
          ))}
        </audio-ui-sequencer-row>
      ))}
    </audio-ui-sequencer>
  );
}

function Envelope({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-envelope
      aria-label="Amp envelope"
      className={part("audio-ui-envelope")}
      default-value="0 0, 0.12 1, 0.35 0.6 0.4, 0.75 0.6, 1 0"
      {...rootAttributes}
    >
      <audio-ui-envelope-graph>
        <audio-ui-envelope-fill className={part("audio-ui-envelope-fill")} />
        <audio-ui-envelope-line className={part("audio-ui-envelope-line")} />
      </audio-ui-envelope-graph>
      <audio-ui-envelope-segments
        className={part("audio-ui-envelope-segments")}
      />
      <audio-ui-envelope-points className={part("audio-ui-envelope-points")} />
    </audio-ui-envelope>
  );
}

/** A peaking band's response in dB at `hz`, around `center` with `gain`. */
const bell = (center: number, gain: number) => (hz: number) =>
  gain * Math.exp(-(Math.log2(hz / center) ** 2) * 1.6);

function Plot({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  const curveRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const curve = curveRef.current as PlotCurveElement | null;
    const handle = handleRef.current;
    if (!(curve && handle)) {
      return;
    }
    curve.fn = bell(800, 6);
    const follow = (event: Event) => {
      const { value } = (
        event as CustomEvent<{ value: { x: number; y: number } }>
      ).detail;
      curve.fn = bell(value.x, value.y);
    };
    handle.addEventListener("input", follow);
    return () => handle.removeEventListener("input", follow);
  }, []);
  return (
    <audio-ui-plot
      className={part("audio-ui-plot")}
      max-x="20000"
      max-y="18"
      min-x="20"
      min-y="-18"
      scale-x="log"
      {...rootAttributes}
    >
      <audio-ui-plot-grid className={part("audio-ui-plot-grid")} />
      <audio-ui-plot-curve
        className={part("audio-ui-plot-curve")}
        fill-to="0"
        ref={curveRef}
      />
      <audio-ui-plot-handle
        aria-label="Band"
        className={part("audio-ui-plot-handle")}
        ref={handleRef}
        value="800 6"
      />
    </audio-ui-plot>
  );
}

const PEAKS = Array.from({ length: 480 }, (_, index) => {
  const envelope = 0.25 + 0.75 * Math.abs(Math.sin(index / 37));
  return envelope * (0.35 + 0.65 * Math.abs(Math.sin(index / 3.3)));
});

const formatSeconds = (value: number) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;

function Waveform({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-waveform
      className={part("audio-ui-waveform")}
      duration="96"
      peaks={PEAKS}
      value="30"
      {...rootAttributes}
    >
      <audio-ui-waveform-control
        aria-label="Seek"
        className={part("audio-ui-waveform-control")}
      >
        <audio-ui-waveform-canvas
          className={part("audio-ui-waveform-canvas")}
        />
        <audio-ui-waveform-region
          className={part("audio-ui-waveform-region")}
          default-value="54 72"
        >
          <audio-ui-waveform-region-handle
            aria-label="Loop start"
            className={part("audio-ui-waveform-region-handle")}
            edge="start"
          />
          <audio-ui-waveform-region-handle
            aria-label="Loop end"
            className={part("audio-ui-waveform-region-handle")}
            edge="end"
          />
        </audio-ui-waveform-region>
        <audio-ui-waveform-playhead
          className={part("audio-ui-waveform-playhead")}
        />
        <audio-ui-waveform-hover
          className={part("audio-ui-waveform-hover")}
          format={formatSeconds}
        />
      </audio-ui-waveform-control>
    </audio-ui-waveform>
  );
}

const BARS = [0, 4, 8, 12, 16, 20, 24, 28];

function Timeline({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-timeline
      className={part("audio-ui-timeline")}
      duration="32"
      max-zoom="80"
      min-zoom="12"
      snap-step="1"
      {...rootAttributes}
    >
      <audio-ui-timeline-viewport
        className={part("audio-ui-timeline-viewport")}
      >
        <audio-ui-timeline-ruler
          aria-label="Position"
          className={part("audio-ui-timeline-ruler")}
        >
          {BARS.map((bar) => (
            <audio-ui-timeline-mark
              className={part("audio-ui-timeline-mark")}
              key={bar}
              value={bar}
            >
              {bar / 4 + 1}
            </audio-ui-timeline-mark>
          ))}
          <audio-ui-timeline-range
            aria-label="Loop"
            className={part("audio-ui-timeline-range")}
            value="8 16"
          />
        </audio-ui-timeline-ruler>
        {[
          { clip: "Beat", length: 8, name: "Drums", start: 0 },
          { clip: "Bass line", length: 12, name: "Bass", start: 8 },
        ].map((track) => (
          <audio-ui-timeline-track
            className={part("audio-ui-timeline-track")}
            key={track.name}
            style={{ minWidth: "max-content" }}
          >
            <audio-ui-timeline-track-header
              className={part("audio-ui-timeline-track-header")}
            >
              {track.name}
            </audio-ui-timeline-track-header>
            <audio-ui-timeline-lane seekable="">
              <audio-ui-timeline-clip
                aria-label={track.clip}
                className={part("audio-ui-timeline-clip")}
                length={track.length}
                start={track.start}
              >
                <audio-ui-timeline-clip-header
                  className={part("audio-ui-timeline-clip-header")}
                >
                  {track.clip}
                </audio-ui-timeline-clip-header>
                <audio-ui-timeline-clip-handle
                  aria-label="Trim start"
                  className={part("audio-ui-timeline-clip-handle")}
                  edge="start"
                />
                <audio-ui-timeline-clip-handle
                  aria-label="Trim end"
                  className={part("audio-ui-timeline-clip-handle")}
                  edge="end"
                />
              </audio-ui-timeline-clip>
              <audio-ui-timeline-playhead
                className={part("audio-ui-timeline-playhead")}
              />
            </audio-ui-timeline-lane>
          </audio-ui-timeline-track>
        ))}
      </audio-ui-timeline-viewport>
      <audio-ui-timeline-navigator
        className={part("audio-ui-timeline-navigator")}
      >
        <audio-ui-timeline-navigator-window
          aria-label="View"
          className={part("audio-ui-timeline-navigator-window")}
        />
        <audio-ui-timeline-navigator-handle
          aria-label="View start"
          className={part("audio-ui-timeline-navigator-handle")}
          edge="start"
        />
        <audio-ui-timeline-navigator-handle
          aria-label="View end"
          className={part("audio-ui-timeline-navigator-handle")}
          edge="end"
        />
      </audio-ui-timeline-navigator>
    </audio-ui-timeline>
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

function PianoRoll({ rootAttributes }: { rootAttributes?: RootAttributes }) {
  const part = use(PartContext);
  return (
    <audio-ui-timeline
      className={part("audio-ui-timeline")}
      duration="8"
      max-zoom="300"
      min-zoom="40"
      snap-step="0.5"
      {...rootAttributes}
    >
      <audio-ui-piano-roll
        className={part("audio-ui-piano-roll")}
        max-pitch="74"
        min-pitch="57"
        mode="draw"
        value={NOTES}
      >
        <audio-ui-piano-roll-keys className={part("audio-ui-piano-roll-keys")}>
          <audio-ui-piano aria-label="Keys" className={part("audio-ui-piano")}>
            <audio-ui-piano-keys className={part("audio-ui-piano-keys")} />
          </audio-ui-piano>
        </audio-ui-piano-roll-keys>
        <audio-ui-timeline-viewport
          className={part("audio-ui-timeline-viewport")}
        >
          <audio-ui-piano-roll-grid
            aria-label="Notes"
            className={part("audio-ui-piano-roll-grid")}
          >
            <audio-ui-piano-roll-rows
              className={part("audio-ui-piano-roll-rows")}
            />
            <audio-ui-piano-roll-notes
              className={part("audio-ui-piano-roll-notes")}
            />
            <audio-ui-piano-roll-marquee
              className={part("audio-ui-piano-roll-marquee")}
            />
            <audio-ui-timeline-playhead
              className={part("audio-ui-timeline-playhead")}
            />
          </audio-ui-piano-roll-grid>
        </audio-ui-timeline-viewport>
        <audio-ui-piano-roll-velocity-lane
          aria-label="Velocity"
          className={part("audio-ui-piano-roll-velocity-lane")}
        >
          <audio-ui-piano-roll-velocities
            className={part("audio-ui-piano-roll-velocities")}
          />
        </audio-ui-piano-roll-velocity-lane>
      </audio-ui-piano-roll>
    </audio-ui-timeline>
  );
}

const PREVIEWS: Record<
  ElementsPreviewName,
  (props: { rootAttributes?: RootAttributes }) => ReactNode
> = {
  envelope: Envelope,
  fader: Fader,
  knob: Knob,
  meter: Meter,
  pad: Pad,
  piano: Piano,
  "piano-roll": PianoRoll,
  plot: Plot,
  sequencer: Sequencer,
  timeline: Timeline,
  waveform: Waveform,
  xypad: XYPad,
};

/**
 * A live preview of one primitive as custom elements, rendered once its
 * entry point has registered them, with the last event it fired below it.
 */
export function ElementsPreview({
  children,
  example,
  name,
}: {
  /** The code of the preview, shown under it: a few lines until View Code. */
  children?: ReactNode;
  /** An example of the page's element, from `primitive-examples.ts`: its attributes over the usage's. */
  example?: string;
  name: ElementsPreviewName;
}) {
  const { style: look, styling } = usePreviewLook();
  const skin = SKINS[name];
  const part = useCallback(
    (tag: string) => (styling === "tailwind" ? skin?.tailwind[tag] : undefined),
    [skin, styling]
  );
  const [registered, setRegistered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const eventRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    ENTRIES[name]().then(() => setRegistered(true));
  }, [name]);

  useEffect(() => {
    const panel = panelRef.current;
    const output = eventRef.current;
    if (!(registered && panel && output)) {
      return;
    }
    const text = document.createTextNode(PROMPTS[name]);
    output.replaceChildren(text);
    // One text node's data, written on each event: no render per move of a drag.
    const show = (event: Event) => {
      const { detail } = event as CustomEvent<Record<string, unknown> | null>;
      const shown = describe(detail);
      text.data = shown ? `${event.type}: ${shown}` : event.type;
    };
    for (const type of EVENTS[name]) {
      panel.addEventListener(type, show);
    }
    return () => {
      for (const type of EVENTS[name]) {
        panel.removeEventListener(type, show);
      }
    };
  }, [name, registered]);

  const Preview = PREVIEWS[name];
  const given = exampleOf(name, example)?.props;
  const attributes = given ? elementAttributes(given) : undefined;
  return (
    <Frame className="mt-4 mb-8" data-slot="elements-preview" style={look}>
      {styling === "css" && skin ? (
        // The stylesheet the page shows, scoped to this preview.
        <style>{`@scope ([data-slot="elements-preview"]) {\n${skin.css}\n}`}</style>
      ) : null}
      <PreviewPanel className="min-h-64 gap-4 px-4">
        {registered ? (
          <div
            className="flex w-full items-center justify-center"
            ref={panelRef}
          >
            <PartContext value={part}>
              <Preview rootAttributes={attributes} />
            </PartContext>
          </div>
        ) : null}
        <output
          aria-live="off"
          className="font-mono text-muted-foreground text-xs tabular-nums"
          ref={eventRef}
        />
      </PreviewPanel>
      {children ? <PreviewCode>{children}</PreviewCode> : null}
    </Frame>
  );
}
