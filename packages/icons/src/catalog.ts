import type { ComponentType } from "react";
import type { IconProps } from "./icon.tsx";
import {
  BandpassIcon,
  BotIcon,
  BracesIcon,
  EnvelopeIcon,
  FadersIcon,
  GridIcon,
  type glyphs,
  HighpassIcon,
  HighshelfIcon,
  JackIcon,
  KnobIcon,
  LowpassIcon,
  LowshelfIcon,
  MetronomeIcon,
  NotchIcon,
  PatchbayIcon,
  PeakIcon,
  PlayheadIcon,
  RackIcon,
  SawtoothIcon,
  ShapesIcon,
  SineIcon,
  SparkleIcon,
  SquareIcon,
  TracksIcon,
  TriangleIcon,
  TuningForkIcon,
  WaveformIcon,
} from "./icons.ts";

export type IconCategory =
  | "Agents"
  | "Audio"
  | "Docs"
  | "Filters"
  | "Oscillators";

/** The order the catalog lists the categories in. */
export const categories: readonly IconCategory[] = [
  "Audio",
  "Oscillators",
  "Filters",
  "Docs",
  "Agents",
];

export interface IconEntry {
  category: IconCategory;
  glyph: keyof typeof glyphs;
  /** The icon: draw it with a `weight` and a `size`. */
  Icon: ComponentType<IconProps>;
  /** What a search matches besides the name and the category. */
  keywords: readonly string[];
  /** What the glyph draws: the component is `${name}Icon`. */
  name: string;
}

const entry = (
  name: string,
  Icon: ComponentType<IconProps>,
  category: IconCategory,
  keywords: readonly string[]
): IconEntry => ({
  category,
  glyph: name.toLowerCase() as IconEntry["glyph"],
  Icon,
  keywords,
  name,
});

/** Every icon of the package, by category. */
export const catalog: readonly IconEntry[] = [
  entry("Knob", KnobIcon, "Audio", ["control", "dial", "rotary", "parameter"]),
  entry("Tracks", TracksIcon, "Audio", [
    "arrangement",
    "clips",
    "timeline",
    "daw",
  ]),
  entry("Rack", RackIcon, "Audio", ["device", "plugin", "effect", "unit"]),
  entry("Waveform", WaveformIcon, "Audio", [
    "engine",
    "signal",
    "bars",
    "meter",
  ]),
  entry("Envelope", EnvelopeIcon, "Audio", ["adsr", "automation", "curve"]),
  entry("Sine", SineIcon, "Oscillators", ["wave", "oscillator", "smooth"]),
  entry("Square", SquareIcon, "Oscillators", ["wave", "oscillator", "pulse"]),
  entry("Sawtooth", SawtoothIcon, "Oscillators", [
    "wave",
    "oscillator",
    "saw",
    "ramp",
  ]),
  entry("Triangle", TriangleIcon, "Oscillators", ["wave", "oscillator"]),
  entry("Lowpass", LowpassIcon, "Filters", ["filter", "cut", "response"]),
  entry("Highpass", HighpassIcon, "Filters", ["filter", "cut", "response"]),
  entry("Bandpass", BandpassIcon, "Filters", ["filter", "band", "response"]),
  entry("Notch", NotchIcon, "Filters", ["filter", "reject", "response"]),
  entry("Lowshelf", LowshelfIcon, "Filters", ["filter", "eq", "shelf", "bass"]),
  entry("Highshelf", HighshelfIcon, "Filters", [
    "filter",
    "eq",
    "shelf",
    "treble",
  ]),
  entry("Peak", PeakIcon, "Filters", ["filter", "eq", "bell", "band"]),
  entry("Metronome", MetronomeIcon, "Docs", [
    "start",
    "begin",
    "count in",
    "tempo",
    "get started",
  ]),
  entry("TuningFork", TuningForkIcon, "Docs", [
    "introduction",
    "about",
    "reference",
    "pitch",
  ]),
  entry("Jack", JackIcon, "Docs", [
    "install",
    "installation",
    "plug",
    "connect",
  ]),
  entry("Patchbay", PatchbayIcon, "Docs", [
    "registry",
    "sockets",
    "patch",
    "panel",
  ]),
  entry("Shapes", ShapesIcon, "Docs", ["primitives", "circle", "square"]),
  entry("Braces", BracesIcon, "Docs", ["code", "headless", "css", "curly"]),
  entry("Faders", FadersIcon, "Docs", ["theme", "tokens", "values", "mixer"]),
  entry("Playhead", PlayheadIcon, "Docs", [
    "roadmap",
    "timeline",
    "plan",
    "transport",
  ]),
  entry("Grid", GridIcon, "Docs", ["catalog", "icons", "tiles"]),
  entry("Sparkle", SparkleIcon, "Agents", ["ai", "skill", "magic", "star"]),
  entry("Bot", BotIcon, "Agents", ["llm", "robot", "assistant"]),
];
