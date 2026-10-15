import type { ComponentType } from "react";
import { EnvelopeShowcase } from "./envelope.tsx";
import { FaderShowcase } from "./fader.tsx";
import { KnobShowcase } from "./knob.tsx";
import { MeterShowcase } from "./meter.tsx";
import { PadShowcase } from "./pad.tsx";
import { PianoShowcase } from "./piano.tsx";
import { PianoRollShowcase } from "./piano-roll.tsx";
import { PlotShowcase } from "./plot.tsx";
import { ScrubberShowcase } from "./scrubber.tsx";
import { SequencerShowcase } from "./sequencer.tsx";
import { TimelineShowcase } from "./timeline.tsx";
import { TransportShowcase } from "./transport.tsx";
import { WaveformShowcase } from "./waveform.tsx";
import { XYPadShowcase } from "./xypad.tsx";

export interface Showcase {
  /** Drives the real registry component from `t`, in seconds since it came on screen. */
  Demo: ComponentType<{ t: number }>;
  /** Its size when it has the screen to itself, in px. */
  height: number;
  title: string;
  width: number;
}

/**
 * One entry per registry component, keyed by its registry name: a new
 * component needs one here before `bun run new <name>` can film it.
 */
export const SHOWCASES: Record<string, Showcase> = {
  envelope: {
    Demo: EnvelopeShowcase,
    height: 280,
    title: "Envelope",
    width: 604,
  },
  fader: { Demo: FaderShowcase, height: 160, title: "Fader", width: 584 },
  knob: { Demo: KnobShowcase, height: 240, title: "Knob", width: 520 },
  meter: { Demo: MeterShowcase, height: 260, title: "Meter", width: 160 },
  pad: { Demo: PadShowcase, height: 420, title: "Pad", width: 420 },
  piano: { Demo: PianoShowcase, height: 192, title: "Piano", width: 584 },
  "piano-roll": {
    Demo: PianoRollShowcase,
    height: 300,
    title: "Piano Roll",
    width: 760,
  },
  plot: { Demo: PlotShowcase, height: 280, title: "Plot", width: 584 },
  scrubber: {
    Demo: ScrubberShowcase,
    height: 80,
    title: "Scrubber",
    width: 560,
  },
  sequencer: {
    Demo: SequencerShowcase,
    height: 200,
    title: "Sequencer",
    width: 760,
  },
  timeline: {
    Demo: TimelineShowcase,
    height: 240,
    title: "Timeline",
    width: 1000,
  },
  transport: {
    Demo: TransportShowcase,
    height: 96,
    title: "Transport",
    width: 720,
  },
  waveform: {
    Demo: WaveformShowcase,
    height: 140,
    title: "Waveform",
    width: 760,
  },
  xypad: { Demo: XYPadShowcase, height: 280, title: "XY Pad", width: 380 },
};
