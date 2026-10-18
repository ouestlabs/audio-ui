import { circle, type Glyph, path, rect } from "./glyph.ts";

/** A metronome: the count before the first note. */
export const metronome: Glyph = [
  path("M8.5 21 10.7 4h2.6l2.2 17z", { tint: true }),
  path("M12 16h.01"),
];

/** A knob with its mark. */
export const knob: Glyph = [
  circle(12, 12, 8, { tint: true }),
  path("M12 8h.01"),
];

/** Clips on tracks. */
export const tracks: Glyph = [
  path("M4 7h9M9 12h11M6 17h8"),
  rect(4, 5.5, 9, 3, 1, { backdrop: true }),
  rect(9, 10.5, 11, 3, 1, { backdrop: true }),
  rect(6, 15.5, 8, 3, 1, { backdrop: true }),
];

/** A unit of a rack, with its indicator. */
export const rack: Glyph = [
  rect(3, 7, 18, 10, 2, { tint: true }),
  path("M7.5 12h.01"),
];

/** The bars of a waveform. */
export const waveform: Glyph = [
  path("M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"),
  rect(3, 4, 18, 16, 3, { backdrop: true }),
];

/** A tuning fork: the reference every sound is set against. */
export const tuningfork: Glyph = [
  path("M8.5 3v6.5a3.5 3.5 0 0 0 7 0V3M12 13v8"),
];

/** A jack plug: connect it. */
export const jack: Glyph = [
  path("M12 3v4"),
  rect(8, 7, 8, 13, 2, { tint: true }),
];

/** A patchbay: a panel with its sockets. */
export const patchbay: Glyph = [
  rect(3, 7, 18, 10, 2, { tint: true }),
  path("M8 12h.01M12 12h.01M16 12h.01"),
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

/** A playhead over its line. */
export const playhead: Glyph = [
  path("M12 8v12"),
  path("M7 3h10l-5 5z", { tint: true }),
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
  path("M9 13.5h.01M15 13.5h.01"),
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

/** What automation draws over a lane. */
export const envelope: Glyph = [path("M2 17h4l5-10h4c3 0 4 10 7 10")];

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
  path("M15.5 8.5h.01"),
];
export const pad: Glyph = [
  rect(4, 4, 16, 16, 4, { tint: true }),
  path("M8.5 15.5h7"),
];
export const piano: Glyph = [
  rect(3, 5, 18, 14, 1.5, { tint: true }),
  rect(7.5, 5, 3, 8, 0.5),
  rect(13.5, 5, 3, 8, 0.5),
  path("M9 13v6M15 13v6"),
];

/** Displays: a level, a needle, a spectrum, a scope, a plot. */
export const meter: Glyph = [
  rect(8, 3, 8, 18, 2, { tint: true }),
  path("M12 17v-5"),
];
export const gauge: Glyph = [
  path("M4 17a8 8 0 0 1 16 0z", { tint: true }),
  path("M12 17l3.5-6.5"),
];
export const spectrum: Glyph = [
  path("M4 20v-7M8 20V8M12 20V4M16 20V10M20 20v-5"),
];
export const scope: Glyph = [
  rect(3, 5, 18, 14, 2, { tint: true }),
  path("M6 12l2-3 3 6 3-6 2 3"),
];
export const plot: Glyph = [path("M4 4v16h16"), path("M7 16c3-9 6-9 12-3")];

/** Transport. */
export const play: Glyph = [path("M8 5.5v13l10.5-6.5z", { tint: true })];
export const pause: Glyph = [
  rect(6.5, 5, 3.5, 14, 1, { tint: true }),
  rect(14, 5, 3.5, 14, 1, { tint: true }),
];
export const stop: Glyph = [rect(6, 6, 12, 12, 2, { tint: true })];
export const record: Glyph = [
  circle(12, 12, 8, { tint: true }),
  circle(12, 12, 2.5),
];
export const loop: Glyph = [
  rect(3, 7, 18, 10, 5, { tint: true }),
  path("M14.5 4.5 17 7l-2.5 2.5"),
];

/** Signal in and out. */
export const mic: Glyph = [
  rect(9, 3, 6, 11, 3, { tint: true }),
  path("M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"),
];
export const speaker: Glyph = [
  rect(5, 3, 14, 18, 2, { tint: true }),
  circle(12, 14.5, 3.5),
  path("M12 7h.01"),
];
export const headphones: Glyph = [
  path("M4 15v-3a8 8 0 0 1 16 0v3"),
  rect(3, 14, 4, 6, 1.5, { tint: true }),
  rect(17, 14, 4, 6, 1.5, { tint: true }),
];
export const midi: Glyph = [
  circle(12, 12, 9, { tint: true }),
  path("M7 12h.01M8.5 8h.01M12 6.5h.01M15.5 8h.01M17 12h.01"),
];

/** Editors. */
export const sequencer: Glyph = [
  rect(3, 6, 4, 4, 1, { tint: true }),
  rect(10, 6, 4, 4, 1),
  rect(17, 6, 4, 4, 1),
  rect(3, 14, 4, 4, 1),
  rect(10, 14, 4, 4, 1, { tint: true }),
  rect(17, 14, 4, 4, 1),
];
export const pianoroll: Glyph = [
  rect(3, 4, 18, 16, 2, { tint: true }),
  path("M6 9h5M10 13h6M8 16.5h4"),
];

/** Effects: a transfer curve, an echo, a room, a clipped wave. */
export const compressor: Glyph = [path("M4 20l8-8c1.5-1.5 2.5-2 4-2h4")];
export const delay: Glyph = [path("M5 6v12M10 8v8M15 10v4M20 11.5v1")];
export const reverb: Glyph = [
  path("M7 12h.01"),
  path("M11 8a5 5 0 0 1 0 8M15 5a9 9 0 0 1 0 14"),
];
export const distortion: Glyph = [path("M3 12l3-6h4l3 12h4l3-6")];
