import type * as glyphs from "./glyphs.ts";

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
  /** What a search matches besides the name and the category. */
  keywords: readonly string[];
  /** What the glyph draws: its React component is `${name}Icon`. */
  name: string;
}

const entry = (
  name: string,
  category: IconCategory,
  keywords: readonly string[]
): IconEntry => ({
  category,
  glyph: name.toLowerCase() as IconEntry["glyph"],
  keywords,
  name,
});

/** Every icon of the package, by category. */
export const catalog: readonly IconEntry[] = [
  entry("Knob", "Controls", ["control", "dial", "rotary", "parameter"]),
  entry("Tracks", "Editors", ["arrangement", "clips", "timeline", "daw"]),
  entry("Rack", "Effects", ["device", "plugin", "effect", "unit"]),
  entry("Faders", "Controls", ["mixer", "levels", "channels", "sliders"]),
  entry("Waveform", "Displays", ["engine", "signal", "bars", "meter"]),
  entry("Envelope", "Editors", ["adsr", "automation", "curve"]),
  entry("XYPad", "Controls", ["pad", "two values", "position", "xy"]),
  entry("Pad", "Controls", ["drum", "trigger", "strike", "velocity"]),
  entry("Piano", "Controls", ["keyboard", "keys", "notes"]),
  entry("Meter", "Displays", ["level", "peak", "vu", "bar"]),
  entry("Gauge", "Displays", ["needle", "vu", "dial", "tuner"]),
  entry("Spectrum", "Displays", ["analyzer", "frequency", "fft", "bars"]),
  entry("Scope", "Displays", ["oscilloscope", "signal", "trace"]),
  entry("Plot", "Displays", ["graph", "curve", "axes", "eq"]),
  entry("Play", "Transport", ["start", "run"]),
  entry("Pause", "Transport", ["hold"]),
  entry("Stop", "Transport", ["halt", "end"]),
  entry("Record", "Transport", ["arm", "capture"]),
  entry("Loop", "Transport", ["repeat", "cycle", "region"]),
  entry("Mic", "Signal", ["microphone", "input", "voice"]),
  entry("Speaker", "Signal", ["output", "monitor", "loudspeaker"]),
  entry("Headphones", "Signal", ["output", "cue", "monitor"]),
  entry("Midi", "Signal", ["din", "keyboard", "controller", "plug"]),
  entry("Sequencer", "Editors", ["steps", "pattern", "drum machine"]),
  entry("PianoRoll", "Editors", ["notes", "midi", "editor"]),
  entry("Compressor", "Effects", ["dynamics", "curve", "knee", "ratio"]),
  entry("Delay", "Effects", ["echo", "repeat", "feedback"]),
  entry("Reverb", "Effects", ["room", "space", "tail"]),
  entry("Distortion", "Effects", ["overdrive", "clip", "saturation"]),
  entry("Stereo", "Signal", ["channels", "left right", "width", "pan"]),
  entry("Mono", "Signal", ["one channel", "centre", "summed", "single"]),
  entry("Tape", "Signal", ["cassette", "reel", "recording", "lo-fi"]),
  entry("Vinyl", "Signal", ["record", "disc", "turntable", "dj"]),
  entry("Clip", "Editors", ["region", "audio", "waveform", "arrangement"]),
  entry("Automation", "Editors", ["points", "line", "parameter", "envelope"]),
  entry("Magnet", "Editors", ["snap", "grid", "quantize"]),
  entry("Sine", "Oscillators", ["wave", "oscillator", "smooth"]),
  entry("Square", "Oscillators", ["wave", "oscillator", "pulse"]),
  entry("Sawtooth", "Oscillators", ["wave", "oscillator", "saw", "ramp"]),
  entry("Triangle", "Oscillators", ["wave", "oscillator"]),
  entry("Lowpass", "Filters", ["filter", "cut", "response"]),
  entry("Highpass", "Filters", ["filter", "cut", "response"]),
  entry("Bandpass", "Filters", ["filter", "band", "response"]),
  entry("Notch", "Filters", ["filter", "reject", "response"]),
  entry("Lowshelf", "Filters", ["filter", "eq", "shelf", "bass"]),
  entry("Highshelf", "Filters", ["filter", "eq", "shelf", "treble"]),
  entry("Peak", "Filters", ["filter", "eq", "bell", "band"]),
  entry("Metronome", "Transport", [
    "start",
    "begin",
    "count in",
    "tempo",
    "get started",
  ]),
  entry("TuningFork", "Docs", ["introduction", "about", "reference", "pitch"]),
  entry("Jack", "Signal", ["install", "installation", "plug", "connect"]),
  entry("Patchbay", "Signal", ["registry", "sockets", "patch", "panel"]),
  entry("Shapes", "Docs", ["primitives", "circle", "square"]),
  entry("Braces", "Docs", ["code", "headless", "css", "curly"]),
  entry("Fader", "Controls", ["theme", "tokens", "values", "mixer"]),
  entry("Playhead", "Editors", ["roadmap", "timeline", "plan", "transport"]),
  entry("Grid", "Docs", ["catalog", "icons", "tiles"]),
  entry("Note", "Docs", ["introduction", "music", "welcome", "overview"]),
  entry("Insert", "Docs", ["install", "installation", "add", "rack"]),
  entry("Crate", "Docs", ["registry", "catalog", "records", "collection"]),
  entry("Dial", "Docs", ["headless", "unstyled", "skeleton", "knob"]),
  entry("Contrast", "Docs", ["theme", "tokens", "light", "dark"]),
  entry("Sparkle", "Agents", ["ai", "skill", "magic", "star"]),
  entry("Bot", "Agents", ["llm", "robot", "assistant"]),
];
