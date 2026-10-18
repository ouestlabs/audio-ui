import type { ComponentType } from "react";
import type { IconProps } from "./icon.tsx";
import {
  AutomationIcon,
  BandpassIcon,
  BotIcon,
  BracesIcon,
  ClipIcon,
  CompressorIcon,
  ContrastIcon,
  CrateIcon,
  DelayIcon,
  DialIcon,
  DistortionIcon,
  EnvelopeIcon,
  FaderIcon,
  FadersIcon,
  GaugeIcon,
  GridIcon,
  type glyphs,
  HeadphonesIcon,
  HighpassIcon,
  HighshelfIcon,
  InsertIcon,
  JackIcon,
  KnobIcon,
  LoopIcon,
  LowpassIcon,
  LowshelfIcon,
  MagnetIcon,
  MeterIcon,
  MetronomeIcon,
  MicIcon,
  MidiIcon,
  MonoIcon,
  NotchIcon,
  NoteIcon,
  PadIcon,
  PatchbayIcon,
  PauseIcon,
  PeakIcon,
  PianoIcon,
  PianoRollIcon,
  PlayheadIcon,
  PlayIcon,
  PlotIcon,
  RackIcon,
  RecordIcon,
  ReverbIcon,
  SawtoothIcon,
  ScopeIcon,
  SequencerIcon,
  ShapesIcon,
  SineIcon,
  SparkleIcon,
  SpeakerIcon,
  SpectrumIcon,
  SquareIcon,
  StereoIcon,
  StopIcon,
  TapeIcon,
  TracksIcon,
  TriangleIcon,
  TuningForkIcon,
  VinylIcon,
  WaveformIcon,
  XypadIcon,
} from "./icons.ts";

export type IconCategory =
  | "Agents"
  | "Controls"
  | "Displays"
  | "Docs"
  | "Editors"
  | "Effects"
  | "Filters"
  | "Oscillators"
  | "Signal"
  | "Transport";

/** The order the catalog lists the categories in. */
export const categories: readonly IconCategory[] = [
  "Controls",
  "Displays",
  "Transport",
  "Editors",
  "Signal",
  "Effects",
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
  entry("Knob", KnobIcon, "Controls", [
    "control",
    "dial",
    "rotary",
    "parameter",
  ]),
  entry("Tracks", TracksIcon, "Editors", [
    "arrangement",
    "clips",
    "timeline",
    "daw",
  ]),
  entry("Rack", RackIcon, "Effects", ["device", "plugin", "effect", "unit"]),
  entry("Faders", FadersIcon, "Controls", [
    "mixer",
    "levels",
    "channels",
    "sliders",
  ]),
  entry("Waveform", WaveformIcon, "Displays", [
    "engine",
    "signal",
    "bars",
    "meter",
  ]),
  entry("Envelope", EnvelopeIcon, "Editors", ["adsr", "automation", "curve"]),
  entry("XYPad", XypadIcon, "Controls", [
    "pad",
    "two values",
    "position",
    "xy",
  ]),
  entry("Pad", PadIcon, "Controls", ["drum", "trigger", "strike", "velocity"]),
  entry("Piano", PianoIcon, "Controls", ["keyboard", "keys", "notes"]),
  entry("Meter", MeterIcon, "Displays", ["level", "peak", "vu", "bar"]),
  entry("Gauge", GaugeIcon, "Displays", ["needle", "vu", "dial", "tuner"]),
  entry("Spectrum", SpectrumIcon, "Displays", [
    "analyzer",
    "frequency",
    "fft",
    "bars",
  ]),
  entry("Scope", ScopeIcon, "Displays", ["oscilloscope", "signal", "trace"]),
  entry("Plot", PlotIcon, "Displays", ["graph", "curve", "axes", "eq"]),
  entry("Play", PlayIcon, "Transport", ["start", "run"]),
  entry("Pause", PauseIcon, "Transport", ["hold"]),
  entry("Stop", StopIcon, "Transport", ["halt", "end"]),
  entry("Record", RecordIcon, "Transport", ["arm", "capture"]),
  entry("Loop", LoopIcon, "Transport", ["repeat", "cycle", "region"]),
  entry("Mic", MicIcon, "Signal", ["microphone", "input", "voice"]),
  entry("Speaker", SpeakerIcon, "Signal", ["output", "monitor", "loudspeaker"]),
  entry("Headphones", HeadphonesIcon, "Signal", ["output", "cue", "monitor"]),
  entry("Midi", MidiIcon, "Signal", ["din", "keyboard", "controller", "plug"]),
  entry("Sequencer", SequencerIcon, "Editors", [
    "steps",
    "pattern",
    "drum machine",
  ]),
  entry("PianoRoll", PianoRollIcon, "Editors", ["notes", "midi", "editor"]),
  entry("Compressor", CompressorIcon, "Effects", [
    "dynamics",
    "curve",
    "knee",
    "ratio",
  ]),
  entry("Delay", DelayIcon, "Effects", ["echo", "repeat", "feedback"]),
  entry("Reverb", ReverbIcon, "Effects", ["room", "space", "tail"]),
  entry("Distortion", DistortionIcon, "Effects", [
    "overdrive",
    "clip",
    "saturation",
  ]),
  entry("Stereo", StereoIcon, "Signal", [
    "channels",
    "left right",
    "width",
    "pan",
  ]),
  entry("Mono", MonoIcon, "Signal", [
    "one channel",
    "centre",
    "summed",
    "single",
  ]),
  entry("Tape", TapeIcon, "Signal", ["cassette", "reel", "recording", "lo-fi"]),
  entry("Vinyl", VinylIcon, "Signal", ["record", "disc", "turntable", "dj"]),
  entry("Clip", ClipIcon, "Editors", [
    "region",
    "audio",
    "waveform",
    "arrangement",
  ]),
  entry("Automation", AutomationIcon, "Editors", [
    "points",
    "line",
    "parameter",
    "envelope",
  ]),
  entry("Magnet", MagnetIcon, "Editors", ["snap", "grid", "quantize"]),
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
  entry("Metronome", MetronomeIcon, "Transport", [
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
  entry("Jack", JackIcon, "Signal", [
    "install",
    "installation",
    "plug",
    "connect",
  ]),
  entry("Patchbay", PatchbayIcon, "Signal", [
    "registry",
    "sockets",
    "patch",
    "panel",
  ]),
  entry("Shapes", ShapesIcon, "Docs", ["primitives", "circle", "square"]),
  entry("Braces", BracesIcon, "Docs", ["code", "headless", "css", "curly"]),
  entry("Fader", FaderIcon, "Controls", ["theme", "tokens", "values", "mixer"]),
  entry("Playhead", PlayheadIcon, "Editors", [
    "roadmap",
    "timeline",
    "plan",
    "transport",
  ]),
  entry("Grid", GridIcon, "Docs", ["catalog", "icons", "tiles"]),
  entry("Note", NoteIcon, "Docs", [
    "introduction",
    "music",
    "welcome",
    "overview",
  ]),
  entry("Insert", InsertIcon, "Docs", [
    "install",
    "installation",
    "add",
    "rack",
  ]),
  entry("Crate", CrateIcon, "Docs", [
    "registry",
    "catalog",
    "records",
    "collection",
  ]),
  entry("Dial", DialIcon, "Docs", ["headless", "unstyled", "skeleton", "knob"]),
  entry("Contrast", ContrastIcon, "Docs", ["theme", "tokens", "light", "dark"]),
  entry("Sparkle", SparkleIcon, "Agents", ["ai", "skill", "magic", "star"]),
  entry("Bot", BotIcon, "Agents", ["llm", "robot", "assistant"]),
];
