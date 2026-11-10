"use client";

import { createSource } from "@audio-ui/core";
import type { MeterElement, PlotCurveElement } from "@audio-ui/elements";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { PreviewPanel } from "@/components/preview/frame/preview-frame";
import { Frame } from "@/components/site/layout/frame";

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

/** The styles of the previews' generated parts, scoped to the preview, from the theme's tokens. */
const STYLES = `
[data-slot="elements-preview"] audio-ui-piano-key { top: 0; height: 100%; box-sizing: border-box; border: 1px solid var(--border); border-radius: 0 0 4px 4px; background: var(--background); z-index: 0; cursor: pointer; outline: none; }
[data-slot="elements-preview"] audio-ui-piano-key[data-color="black"] { height: 62%; background: var(--foreground); z-index: 1; border-color: var(--foreground); }
[data-slot="elements-preview"] audio-ui-piano-key[data-active] { background: var(--primary); border-color: var(--primary); }
[data-slot="elements-preview"] audio-ui-envelope-point { width: 12px; height: 12px; border-radius: 9999px; background: var(--background); border: 2px solid var(--primary); cursor: grab; outline: none; }
[data-slot="elements-preview"] audio-ui-envelope-point:focus-visible, [data-slot="elements-preview"] audio-ui-envelope-point[data-dragging] { background: var(--primary); }
[data-slot="elements-preview"] audio-ui-envelope-segment { width: 8px; height: 8px; border-radius: 9999px; background: var(--muted-foreground); opacity: 0.5; cursor: ns-resize; outline: none; }
[data-slot="elements-preview"] audio-ui-envelope-segment[data-flat] { display: none; }
[data-slot="elements-preview"] audio-ui-piano-roll-row[data-color="black"] { background: color-mix(in oklab, var(--muted) 70%, transparent); }
[data-slot="elements-preview"] audio-ui-piano-roll-row[data-octave] { border-bottom: 1px solid var(--border); }
[data-slot="elements-preview"] audio-ui-piano-roll-note { background: color-mix(in oklab, var(--primary) calc(40% + 60% * var(--piano-roll-velocity)), transparent); border-radius: 2px; outline: none; cursor: grab; }
[data-slot="elements-preview"] audio-ui-piano-roll-note[data-selected] { box-shadow: 0 0 0 2px var(--ring); }
[data-slot="elements-preview"] audio-ui-piano-roll-velocity { width: 3px; background: var(--primary); translate: -1px 0; }
[data-slot="elements-preview"] audio-ui-piano-roll-marquee { border: 1px dashed var(--primary); background: color-mix(in oklab, var(--primary) 8%, transparent); }
[data-slot="elements-preview"] audio-ui-piano-roll-keys audio-ui-piano-key { top: auto; left: 0; right: 0; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; }
[data-slot="elements-preview"] audio-ui-piano-roll-keys audio-ui-piano-key[data-color="black"] { right: 35%; }
[data-slot="elements-preview"] audio-ui-timeline-viewport, [data-slot="elements-preview"] audio-ui-piano-roll audio-ui-timeline-viewport { scrollbar-width: none; }
`;

function Knob() {
  return (
    <audio-ui-knob
      className="cn-knob cn-knob-size-default group/knob relative mb-8 inline-flex outline-none"
      max="100"
      min="0"
      value="40"
    >
      <audio-ui-knob-control
        className="cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] active:cursor-grabbing"
        data-slot="knob-control"
      >
        <div className="cn-knob-body cn-knob-body-size-default absolute z-0" />
        <audio-ui-knob-track className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22" />
        <audio-ui-knob-indicator className="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full" />
        <audio-ui-knob-thumb
          aria-label="Cutoff"
          className="pointer-events-none absolute inset-0 z-2"
        >
          <svg
            aria-hidden="true"
            className="cn-knob-indicator block size-full"
            viewBox="0 0 48 48"
          >
            <line
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth={2.75}
              x1={24}
              x2={24}
              y1={11.53}
              y2={18.84}
            />
          </svg>
        </audio-ui-knob-thumb>
      </audio-ui-knob-control>
      <audio-ui-knob-value className="cn-knob-value pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap" />
    </audio-ui-knob>
  );
}

function Fader() {
  return (
    <audio-ui-fader className="group/fader relative h-40" value="-6">
      <audio-ui-fader-control className="relative flex h-full w-auto touch-none select-none flex-col items-center">
        <audio-ui-fader-track className="cn-fader-track cn-fader-track-size-default relative grow cursor-pointer select-none overflow-hidden">
          <audio-ui-fader-indicator className="cn-fader-range absolute w-full select-none" />
        </audio-ui-fader-track>
        <audio-ui-fader-thumb
          aria-label="Volume"
          className="cn-fader-thumb cn-fader-thumb-size-default absolute z-10 block shrink-0 cursor-grab select-none outline-none active:cursor-grabbing"
        />
      </audio-ui-fader-control>
    </audio-ui-fader>
  );
}

const PADS = ["Kick", "Snare", "Clap", "Rim", "Hat", "Open", "Tom", "Ride"];

function Pad() {
  return (
    <audio-ui-pad aria-label="Drums" className="grid w-72 grid-cols-4 gap-2">
      {PADS.map((label) => (
        <audio-ui-pad-item
          className="flex aspect-square select-none items-center justify-center rounded-md bg-muted text-muted-foreground text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring data-active:bg-primary data-active:text-primary-foreground"
          key={label}
          value={label}
        >
          {label}
        </audio-ui-pad-item>
      ))}
    </audio-ui-pad>
  );
}

function Piano() {
  return (
    <audio-ui-piano
      aria-label="Keys"
      className="relative block h-28 w-full max-w-lg"
      max-pitch="71"
      min-pitch="48"
    >
      <audio-ui-piano-keys />
    </audio-ui-piano>
  );
}

function XYPad() {
  return (
    <audio-ui-xypad className="block w-48" value="30 70">
      <audio-ui-xypad-control className="relative block aspect-square cursor-crosshair overflow-hidden rounded-md bg-muted">
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-border"
          style={{ left: "var(--xy-pad-x)" }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 h-px bg-border"
          style={{ top: "var(--xy-pad-y)" }}
        />
        <audio-ui-xypad-thumb
          aria-label="Filter"
          className="absolute size-4 rounded-full bg-primary ring-4 ring-primary/20"
        />
      </audio-ui-xypad-control>
      <audio-ui-xypad-value className="mt-2 block text-center font-mono text-muted-foreground text-xs tabular-nums" />
    </audio-ui-xypad>
  );
}

/** Two channels moving like a signal, from a live source the meter follows. */
function Meter() {
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
      className="flex h-44 gap-1.5"
      max="6"
      min="-60"
      ref={ref}
      unit="dB"
      warn-threshold="-12"
    >
      {[0, 1].map((index) => (
        <audio-ui-meter-channel
          aria-label={index === 0 ? "Left" : "Right"}
          className="relative block h-full w-3 overflow-hidden rounded-sm bg-muted"
          index={index}
          key={index}
        >
          <audio-ui-meter-indicator className="absolute bottom-0 block bg-primary" />
          <audio-ui-meter-peak className="absolute inset-x-0 block h-0.5 bg-foreground" />
        </audio-ui-meter-channel>
      ))}
    </audio-ui-meter>
  );
}

const ROWS = ["Kick", "Snare", "Hat"];
const STEPS = Array.from({ length: 16 }, (_, index) => index);

function Sequencer() {
  return (
    <audio-ui-sequencer
      aria-label="Pattern"
      className="grid w-full max-w-xl gap-1"
      default-value="x...x...x...x... ....x.......x... x.x.x.x.x.x.x.xx"
    >
      {ROWS.map((label, row) => (
        <audio-ui-sequencer-row
          aria-label={label}
          className="grid grid-cols-16 gap-1"
          index={row}
          key={label}
        >
          {STEPS.map((step) => (
            <audio-ui-sequencer-cell
              className="aspect-square rounded-sm bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring data-on:bg-primary"
              key={step}
              step={step}
            />
          ))}
        </audio-ui-sequencer-row>
      ))}
    </audio-ui-sequencer>
  );
}

function Envelope() {
  return (
    <audio-ui-envelope
      aria-label="Amp envelope"
      className="block h-40 w-full max-w-md rounded-md bg-muted"
      default-value="0 0, 0.12 1, 0.35 0.6 0.4, 0.75 0.6, 1 0"
    >
      <audio-ui-envelope-graph>
        <audio-ui-envelope-fill className="text-primary opacity-15" />
        <audio-ui-envelope-line className="text-primary [stroke-width:2px]" />
      </audio-ui-envelope-graph>
      <audio-ui-envelope-segments />
      <audio-ui-envelope-points />
    </audio-ui-envelope>
  );
}

/** A peaking band's response in dB at `hz`, around `center` with `gain`. */
const bell = (center: number, gain: number) => (hz: number) =>
  gain * Math.exp(-(Math.log2(hz / center) ** 2) * 1.6);

function Plot() {
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
      className="block h-44 w-full max-w-lg rounded-md bg-muted"
      max-x="20000"
      max-y="18"
      min-x="20"
      min-y="-18"
      scale-x="log"
    >
      <audio-ui-plot-grid className="text-[10px] text-muted-foreground [&_[data-part=label][data-axis=x]]:bottom-1 [&_[data-part=label][data-axis=x]]:translate-x-1 [&_[data-part=label][data-axis=y]]:left-1 [&_[data-part=label][data-axis=y]]:-translate-y-full [&_[data-part=line]]:stroke-border" />
      <audio-ui-plot-curve
        className="text-primary/15"
        fill-to="0"
        ref={curveRef}
      />
      <audio-ui-plot-handle
        aria-label="Band"
        className="size-4 cursor-grab rounded-full bg-primary ring-4 ring-primary/20"
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

function Waveform() {
  return (
    <audio-ui-waveform
      className="block w-full max-w-xl"
      duration="96"
      peaks={PEAKS}
      value="30"
    >
      <audio-ui-waveform-control
        aria-label="Seek"
        className="relative block h-20 cursor-pointer rounded-md bg-muted"
      >
        <audio-ui-waveform-canvas className="absolute inset-0 text-muted-foreground [--waveform-progress-color:var(--primary)]" />
        <audio-ui-waveform-region
          className="inset-y-0 bg-primary/10"
          default-value="54 72"
        >
          <audio-ui-waveform-region-handle
            aria-label="Loop start"
            className="absolute inset-y-0 left-0 w-1 cursor-ew-resize bg-primary"
            edge="start"
          />
          <audio-ui-waveform-region-handle
            aria-label="Loop end"
            className="absolute inset-y-0 right-0 w-1 cursor-ew-resize bg-primary"
            edge="end"
          />
        </audio-ui-waveform-region>
        <audio-ui-waveform-playhead className="inset-y-0 w-0.5 bg-foreground" />
        <audio-ui-waveform-hover
          className="pointer-events-none -top-6 -translate-x-1/2 rounded bg-popover px-1 font-mono text-[10px] shadow-sm"
          format={formatSeconds}
        />
      </audio-ui-waveform-control>
    </audio-ui-waveform>
  );
}

const BARS = [0, 4, 8, 12, 16, 20, 24, 28];

function Timeline() {
  return (
    <audio-ui-timeline
      className="block w-full max-w-xl"
      duration="32"
      snap-step="1"
    >
      <audio-ui-timeline-viewport className="rounded-md border">
        <audio-ui-timeline-ruler
          aria-label="Position"
          className="ms-20 h-6 cursor-pointer bg-muted"
        >
          {BARS.map((bar) => (
            <audio-ui-timeline-mark
              className="h-full border-s ps-1 text-[10px] text-muted-foreground"
              key={bar}
              value={bar}
            >
              {bar / 4 + 1}
            </audio-ui-timeline-mark>
          ))}
          <audio-ui-timeline-range
            aria-label="Loop"
            className="inset-y-0 bg-primary/15"
            value="8 16"
          />
        </audio-ui-timeline-ruler>
        {[
          { clip: "Beat", length: 8, name: "Drums", start: 0 },
          { clip: "Bass line", length: 12, name: "Bass", start: 8 },
        ].map((track) => (
          <audio-ui-timeline-track className="h-14 border-t" key={track.name}>
            <audio-ui-timeline-track-header className="w-20 border-e bg-background p-2 text-xs">
              {track.name}
            </audio-ui-timeline-track-header>
            <audio-ui-timeline-lane seekable="">
              <audio-ui-timeline-clip
                aria-label={track.clip}
                className="inset-y-1 overflow-hidden rounded-sm bg-primary/15 data-selected:ring-2 data-selected:ring-ring"
                length={track.length}
                start={track.start}
              >
                <audio-ui-timeline-clip-header className="cursor-grab truncate bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {track.clip}
                </audio-ui-timeline-clip-header>
                <audio-ui-timeline-clip-handle
                  aria-label="Trim start"
                  className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
                  edge="start"
                />
                <audio-ui-timeline-clip-handle
                  aria-label="Trim end"
                  className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
                  edge="end"
                />
              </audio-ui-timeline-clip>
              <audio-ui-timeline-playhead className="inset-y-0 w-px bg-foreground" />
            </audio-ui-timeline-lane>
          </audio-ui-timeline-track>
        ))}
      </audio-ui-timeline-viewport>
      <audio-ui-timeline-navigator className="mt-2 h-3 rounded-sm bg-muted">
        <audio-ui-timeline-navigator-window
          aria-label="View"
          className="inset-y-0 cursor-grab rounded-sm bg-primary/25"
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

function PianoRoll() {
  return (
    <audio-ui-timeline
      className="block w-full max-w-xl"
      duration="8"
      snap-step="0.5"
    >
      <audio-ui-piano-roll
        className="grid grid-cols-[3rem_1fr] overflow-hidden rounded-md border"
        max-pitch="74"
        min-pitch="57"
        mode="draw"
        value={NOTES}
      >
        <audio-ui-piano-roll-keys className="h-48 border-e">
          <audio-ui-piano aria-label="Keys" className="block h-full">
            <audio-ui-piano-keys />
          </audio-ui-piano>
        </audio-ui-piano-roll-keys>
        <audio-ui-timeline-viewport>
          <audio-ui-piano-roll-grid
            aria-label="Notes"
            className="h-48 outline-none"
          >
            <audio-ui-piano-roll-rows />
            <audio-ui-piano-roll-notes />
            <audio-ui-piano-roll-marquee />
            <audio-ui-timeline-playhead className="inset-y-0 w-px bg-foreground" />
          </audio-ui-piano-roll-grid>
        </audio-ui-timeline-viewport>
        <audio-ui-piano-roll-velocity-lane
          aria-label="Velocity"
          className="col-start-2 h-12 border-t"
        >
          <audio-ui-piano-roll-velocities />
        </audio-ui-piano-roll-velocity-lane>
      </audio-ui-piano-roll>
    </audio-ui-timeline>
  );
}

const PREVIEWS: Record<ElementsPreviewName, () => ReactNode> = {
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
export function ElementsPreview({ name }: { name: ElementsPreviewName }) {
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
  return (
    <Frame className="mt-4 mb-8" data-slot="elements-preview">
      <style>{STYLES}</style>
      <PreviewPanel className="min-h-64 gap-4 px-4">
        {registered ? (
          <div
            className="flex w-full items-center justify-center"
            ref={panelRef}
          >
            <Preview />
          </div>
        ) : null}
        <output
          aria-live="off"
          className="font-mono text-muted-foreground text-xs tabular-nums"
          ref={eventRef}
        />
      </PreviewPanel>
    </Frame>
  );
}
