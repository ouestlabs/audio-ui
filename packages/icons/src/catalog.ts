import type { ComponentType } from "react";
import type { IconProps } from "./icon.tsx";
import {
  BandpassIcon,
  BotIcon,
  BoxIcon,
  BracesIcon,
  DownloadIcon,
  DropIcon,
  EnvelopeIcon,
  FlagIcon,
  GridIcon,
  type glyphs,
  HighpassIcon,
  HighshelfIcon,
  InfoIcon,
  KnobIcon,
  LowpassIcon,
  LowshelfIcon,
  NotchIcon,
  PeakIcon,
  RackIcon,
  RouteIcon,
  SawtoothIcon,
  ShapesIcon,
  SineIcon,
  SparkleIcon,
  SquareIcon,
  TracksIcon,
  TriangleIcon,
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
  entry("Flag", FlagIcon, "Docs", ["start", "begin", "get started"]),
  entry("Info", InfoIcon, "Docs", ["introduction", "about", "help"]),
  entry("Download", DownloadIcon, "Docs", ["install", "installation", "arrow"]),
  entry("Box", BoxIcon, "Docs", ["registry", "package", "cube"]),
  entry("Shapes", ShapesIcon, "Docs", ["primitives", "circle", "square"]),
  entry("Braces", BracesIcon, "Docs", ["code", "headless", "css", "curly"]),
  entry("Drop", DropIcon, "Docs", ["theme", "tokens", "color", "water"]),
  entry("Route", RouteIcon, "Docs", ["roadmap", "path", "plan"]),
  entry("Grid", GridIcon, "Docs", ["catalog", "icons", "tiles"]),
  entry("Sparkle", SparkleIcon, "Agents", ["ai", "skill", "magic", "star"]),
  entry("Bot", BotIcon, "Agents", ["llm", "robot", "assistant"]),
];
