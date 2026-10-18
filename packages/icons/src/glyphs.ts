import { circle, type Glyph, path, rect } from "./glyph.ts";

/** A metronome: the count before the first note. */
export const metronome: Glyph = [
  path("M8.5 21 10.7 4h2.6l2.2 17z", { tint: true }),
  path("M12 16h.01", { knock: true }),
];

/** A knob with its mark. */
export const knob: Glyph = [
  circle(12, 12, 8, { tint: true }),
  path("M12 8h.01", { knock: true }),
];

/** Clips on tracks. */
export const tracks: Glyph = [
  rect(3, 5, 10, 3.5, 1.5, { tint: true }),
  rect(8, 10.25, 13, 3.5, 1.5, { tint: true }),
  rect(5, 15.5, 9, 3.5, 1.5, { tint: true }),
];

/** A unit of a rack, with its indicator. */
export const rack: Glyph = [
  rect(3, 7, 18, 10, 2, { tint: true }),
  path("M7.5 12h.01", { knock: true }),
];

/** A sound that dies away. */
export const waveform: Glyph = [
  path("M2 12C4 12 4 5 6 5S8 19 10 19 12 7 14 7 16 17 18 17 20 12 22 12"),
];

/** A tuning fork: the reference every sound is set against. */
export const tuningfork: Glyph = [
  path("M8.5 3v6.5a3.5 3.5 0 0 0 7 0V3M12 13v8"),
];

/** A jack plug: its cable, its body and its tip. */
export const jack: Glyph = [
  path("M2 12h5M15 12h7"),
  rect(7, 8.5, 8, 7, 1.5, { tint: true }),
];

/** A patchbay: a panel with its sockets. */
export const patchbay: Glyph = [
  rect(3, 7, 18, 10, 2, { tint: true }),
  path("M8 12h.01M12 12h.01M16 12h.01", { knock: true }),
];

export const shapes: Glyph = [
  circle(8, 8, 4, { tint: true }),
  rect(12, 12, 8, 8, 1, { tint: true }),
];

export const braces: Glyph = [
  path(
    "M9 5H8a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h1M15 5h1a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a2 2 0 0 1-2 2h-1"
  ),
];

/** A fader: its slot and its cap. */
export const fader: Glyph = [
  path("M12 3v7M12 15v6"),
  rect(7, 10, 10, 5, 1.5, { tint: true }),
];

/** A playhead: its handle and its line. */
export const playhead: Glyph = [
  path("M7 3h10v7l-5 4-5-4z", { tint: true }),
  path("M12 14v7"),
];

/** An agent: a spark and its small one. */
export const sparkle: Glyph = [
  path(
    "M10 4c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z",
    {
      tint: true,
    }
  ),
  path("M19 3v4M17 5h4"),
];

/** A bot: a head with an antenna. */
export const bot: Glyph = [
  rect(4, 8, 16, 11, 3, { tint: true }),
  path("M12 8V5"),
  circle(12, 4, 1),
  path("M9 13.5h.01M15 13.5h.01", { knock: true }),
];

/** The four shapes of an oscillator. */
export const sine: Glyph = [path("M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 4 4 6 0")];
export const square: Glyph = [path("M2 18h4V6h6v12h4V6h6")];
export const sawtooth: Glyph = [path("M2 18l8-12v12l8-12v12")];
export const triangle: Glyph = [path("M2 12l5-6 5 12 5-12 5 6")];

/** The response of a filter, gain up the page and frequency across. */
export const lowpass: Glyph = [path("M2 7h9c6 0 8 3 11 12")];
export const highpass: Glyph = [path("M2 19c3-9 5-12 11-12h9")];
export const bandpass: Glyph = [path("M2 19c5 0 5-13 10-13s5 13 10 13")];
export const notch: Glyph = [path("M2 7c5 0 5 12 10 12s5-12 10-12")];
export const lowshelf: Glyph = [path("M2 8h7c3 0 4 9 7 9h6")];
export const highshelf: Glyph = [path("M2 17h8c3 0 4-9 7-9h5")];
export const peak: Glyph = [path("M2 17h6c3 0 3-10 4-10s1 10 4 10h6")];

/** An envelope: attack, decay, sustain and release as one shape. */
export const envelope: Glyph = [path("M3 19 8 5l4 6h5l4 8z", { tint: true })];

/** Four tiles: a catalog. */
export const grid: Glyph = [
  rect(3, 3, 7, 7, 1.5, { tint: true }),
  rect(14, 3, 7, 7, 1.5, { tint: true }),
  rect(3, 14, 7, 7, 1.5, { tint: true }),
  rect(14, 14, 7, 7, 1.5, { tint: true }),
];

/** Three faders, each at its own level. */
export const faders: Glyph = [
  path("M5.5 3v10M5.5 16.5V21M12 3v3.5M12 10v11M18.5 3v7M18.5 13.5V21"),
  rect(3, 13, 5, 3.5, 1, { tint: true }),
  rect(9.5, 6.5, 5, 3.5, 1, { tint: true }),
  rect(16, 10, 5, 3.5, 1, { tint: true }),
];

/** Controls: a pad that holds two values, a drum pad, a keyboard. */
export const xypad: Glyph = [
  rect(3, 3, 18, 18, 2, { tint: true }),
  path("M15.5 8.5h.01", { knock: true }),
];
export const pad: Glyph = [
  rect(4, 4, 16, 16, 4, { tint: true }),
  path("M8.5 15.5h7", { knock: true }),
];
export const piano: Glyph = [
  rect(3, 5, 18, 14, 2, { tint: true }),
  path("M8 5v7M16 5v7M12 12v7", { knock: true }),
];

/** Displays: a level, a needle, a spectrum, a scope, a plot. */
export const meter: Glyph = [
  rect(8, 3, 8, 18, 2, { tint: true }),
  path("M12 17v-5", { knock: true }),
];
export const gauge: Glyph = [
  path("M4 17a8 8 0 0 1 16 0z", { tint: true }),
  path("M12 17l3.5-6.5", { knock: true }),
];
/** The skyline of a spectrum, as one shape. */
export const spectrum: Glyph = [
  path("M3 20v-7h3.5V9h3.5V4h4v6h3.5V8H21v12z", { tint: true }),
];
export const scope: Glyph = [
  rect(3, 5, 18, 14, 2, { tint: true }),
  path("M6 12l2-3 3 6 3-6 2 3", { knock: true }),
];
export const plot: Glyph = [
  rect(3, 4, 18, 16, 2, { tint: true }),
  path("M6 16c3 0 3-8 6-8s3 8 6 8", { knock: true }),
];

/** Transport. */
export const play: Glyph = [path("M8 5.5v13l10.5-6.5z", { tint: true })];
export const pause: Glyph = [
  rect(6.5, 5, 3.5, 14, 1, { tint: true }),
  rect(14, 5, 3.5, 14, 1, { tint: true }),
];
export const stop: Glyph = [rect(6, 6, 12, 12, 2, { tint: true })];
export const record: Glyph = [circle(12, 12, 6, { tint: true })];
/** A loop's braces, with the region between them. */
export const loop: Glyph = [
  path("M8 5H5v14h3M16 5h3v14h-3"),
  rect(9.5, 10, 5, 4, 1.5, { tint: true }),
];

/** Signal in and out. */
export const mic: Glyph = [
  rect(9, 3, 6, 11, 3, { tint: true }),
  path("M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"),
];
export const speaker: Glyph = [
  rect(5, 3, 14, 18, 2, { tint: true }),
  circle(12, 14.5, 3.5, { knock: true }),
  path("M12 7h.01", { knock: true }),
];
export const headphones: Glyph = [
  path("M4 15v-3a8 8 0 0 1 16 0v3"),
  rect(3, 14, 4, 6, 1.5, { tint: true }),
  rect(17, 14, 4, 6, 1.5, { tint: true }),
];
export const midi: Glyph = [
  circle(12, 12, 9, { tint: true }),
  path("M7 12h.01M8.5 8h.01M12 6.5h.01M15.5 8h.01M17 12h.01", { knock: true }),
];

/** A row of steps, two of them lit. */
export const sequencer: Glyph = [
  rect(3, 8, 3, 8, 1, { tint: true }),
  rect(8, 8, 3, 8, 1),
  rect(13, 8, 3, 8, 1, { tint: true }),
  rect(18, 8, 3, 8, 1),
];
/** Notes of a melody, rising. */
export const pianoroll: Glyph = [
  rect(3, 15, 6, 3.5, 1.5, { tint: true }),
  rect(9, 10, 6, 3.5, 1.5, { tint: true }),
  rect(15, 5, 6, 3.5, 1.5, { tint: true }),
];

/** Effects: a transfer curve, an echo, a hall, a clipped wave. */
export const compressor: Glyph = [path("M4 20l8-8c1.5-1.5 2.5-2 4-2h4")];
export const delay: Glyph = [path("M5 6v12M10 8v8M15 10v4M20 11.5v1")];
export const reverb: Glyph = [
  path("M5 20v-9a7 7 0 0 1 14 0v9z", { tint: true }),
  path("M12 15h.01", { knock: true }),
];
export const distortion: Glyph = [path("M3 12l3-6h4l3 12h4l3-6")];

/** Channel strip buttons: a key, and the letter on it. */
export const mute: Glyph = [
  rect(4, 4, 16, 16, 4, { tint: true }),
  path("M7.5 16.5v-9l4.5 5.5 4.5-5.5v9", { knock: true }),
];
export const solo: Glyph = [
  rect(4, 4, 16, 16, 4, { tint: true }),
  path(
    "M15.5 9c0-1.5-1.5-2-3.5-2s-3.5.7-3.5 2.2 1.5 2 3.5 2.8 3.5 1.2 3.5 2.8-1.5 2.2-3.5 2.2-3.5-.5-3.5-2",
    { knock: true }
  ),
];

/** Two channels that overlap. */
export const stereo: Glyph = [
  circle(8.5, 12, 6, { tint: true }),
  circle(15.5, 12, 6, { tint: true }),
];

/** A cassette: two reels in a case. */
export const tape: Glyph = [
  rect(3, 6, 18, 12, 2, { tint: true }),
  circle(8.5, 12, 2, { knock: true }),
  circle(15.5, 12, 2, { knock: true }),
];

/** A record: its label and a groove. */
export const vinyl: Glyph = [
  circle(12, 12, 9, { tint: true }),
  circle(12, 12, 2.5, { knock: true }),
  path("M12 6a6 6 0 0 1 6 6", { knock: true }),
];

/** A clip with its waveform. */
export const clip: Glyph = [
  rect(3, 7, 18, 10, 2, { tint: true }),
  path("M6.5 12h2l1.5-3 3 6 1.5-3h3", { knock: true }),
];

/** A line of automation and its points. */
export const automation: Glyph = [
  path("M3 17 9 9l5 5 7-9"),
  circle(9, 9, 1.8, { tint: true }),
  circle(14, 14, 1.8, { tint: true }),
  circle(21, 5, 1.8, { tint: true }),
];

/** A magnet: snap to the grid. */
export const magnet: Glyph = [
  path("M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4z", { tint: true }),
  path("M5 8h4M15 8h4", { knock: true }),
];
