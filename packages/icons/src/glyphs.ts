import { circle, curve, type Glyph, path, rect } from "./glyph.ts";

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

/** Tracks: three lanes, each cut where a clip begins. */
export const tracks: Glyph = [
  path("M3 6h7M13 6h8M3 12h12M18 12h3M3 18h4M10 18h11"),
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
export const sine: Glyph = [...curve("M2 12C4.5 5 7.5 5 12 12S19.5 19 22 12")];
export const square: Glyph = [...curve("M2 18h4V6h6v12h4V6h6")];
export const sawtooth: Glyph = [...curve("M3 18l9-12v12l9-12")];
export const triangle: Glyph = [...curve("M2 12l5-6 5 12 5-12 5 6")];

/** The response of a filter, gain up the page and frequency across. */
export const lowpass: Glyph = [...curve("M2 7h9c6 0 8 3 11 12")];
export const highpass: Glyph = [...curve("M2 19c3-9 5-12 11-12h9")];
export const bandpass: Glyph = [...curve("M2 19c5 0 5-13 10-13s5 13 10 13")];
export const notch: Glyph = [...curve("M2 7c5 0 5 12 10 12s5-12 10-12")];
export const lowshelf: Glyph = [...curve("M2 8h7c3 0 4 9 7 9h6")];
export const highshelf: Glyph = [...curve("M2 17h8c3 0 4-9 7-9h5")];
export const peak: Glyph = [...curve("M2 17h6c3 0 3-10 4-10s1 10 4 10h6")];

/** An envelope: attack, decay, sustain and release as one smooth line. */
export const envelope: Glyph = [
  ...curve("M2 19C4 19 5 5 8 5c2 0 2 6 4 6h5c2 0 3 8 5 8"),
];

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
/** A drum pad: a rubber surface, and the gloss on it. */
export const pad: Glyph = [
  rect(3, 3, 18, 18, 5, { tint: true }),
  path("M7.5 12A4.5 4.5 0 0 1 12 7.5", { knock: true }),
];
/** A keyboard: three white keys, the two black keys between them. */
export const piano: Glyph = [
  rect(3, 3, 18, 18, 3, { tint: true }),
  rect(7.5, 3, 3, 9, 1, { knock: true }),
  rect(13.5, 3, 3, 9, 1, { knock: true }),
  path("M9 12v9M15 12v9", { knock: true }),
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
/** A spectrum: the level at each frequency, as one line. */
export const spectrum: Glyph = [
  ...curve(
    "M2 18c1.5 0 2-5 3.5-5s1.5 3 3 3S10 4 12 4s1.5 10 3 10 1.5-4 3-4 1.5 8 4 8"
  ),
];
/** An oscilloscope's trace, and the trigger marker at its edge. */
export const scope: Glyph = [
  path("M7 12c1.2-5 2.4-5 3.6 0s2.4 5 3.6 0 2.4-5 3.6 0 2.4 5 3.6 0"),
  path("M2 9.5 5 12l-3 2.5z", { tint: true }),
];
/** A curve with the point you drag on it. */
export const plot: Glyph = [
  path("M2 17c4 0 5-11 9-11s5 11 11 11"),
  circle(11, 6, 2, { over: true }),
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
/** A monitor: its cabinet and its woofer. */
export const speaker: Glyph = [
  rect(5, 3, 14, 18, 2.5, { tint: true }),
  circle(12, 14, 4, { knock: true }),
];
export const headphones: Glyph = [
  path("M4 14v-2a8 8 0 0 1 16 0v2"),
  rect(3, 14, 4, 6, 1.5, { tint: true }),
  rect(17, 14, 4, 6, 1.5, { tint: true }),
];
export const midi: Glyph = [
  circle(12, 12, 9, { tint: true }),
  path("M7 12h.01M8.5 8h.01M12 6.5h.01M15.5 8h.01M17 12h.01", { knock: true }),
];

/** A row of steps, two of them lit. */
export const sequencer: Glyph = [
  rect(3, 8, 4, 8, 1, { tint: true }),
  rect(10.5, 8, 4, 8, 1),
  rect(18, 8, 4, 8, 1, { tint: true }),
];
/** A piano roll: notes climbing. */
export const pianoroll: Glyph = [
  rect(3, 16, 5, 3.5, 1.5, { tint: true }),
  rect(9.5, 10, 5, 3.5, 1.5, { tint: true }),
  rect(16, 4, 5, 3.5, 1.5, { tint: true }),
];

/** The curve of a compressor: the level it lets through. */
export const compressor: Glyph = [...curve("M3 20C9 14 11 11 14 10s5-1 7-1")];
/** An echo: the same hit, softer each time. */
export const delay: Glyph = [
  path("M2 20h3l1.5-15 1.5 15h3l1.2-10 1.2 10h3l.9-5 .9 5H22"),
];
/** A hit and the tail it leaves in the room. */
export const reverb: Glyph = [
  ...curve("M2 20h3.5L7 4c.5 8 3 13 7 14.5 2.5.9 5 1.5 8 1.5"),
];
/** A wave pushed until it clips. */
export const distortion: Glyph = [
  ...curve(
    "M2 12c.8-4 1.5-6 3-6h4c1.5 0 2.2 2 3 6s1.5 6 3 6h4c1.5 0 2.2-2 3-6"
  ),
];

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

/** Two speakers, left and right. */
export const stereo: Glyph = [
  rect(2.5, 5, 8, 14, 2, { tint: true }),
  circle(6.5, 14, 2, { knock: true }),
  rect(13.5, 5, 8, 14, 2, { tint: true }),
  circle(17.5, 14, 2, { knock: true }),
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

/** A clip: a block with its waveform. */
export const clip: Glyph = [
  rect(3, 6, 18, 12, 3, { tint: true }),
  path("M6.5 12c1-4 2-4 3 0s2 4 3 0 2-4 3 0 2 4 3 0", { knock: true }),
];

/** A value that moves: its first point, the curve, and its last point. */
export const automation: Glyph = [
  circle(5, 17, 2.2, { tint: true }),
  path("M7.2 17c5 0 4-10 9.6-10"),
  circle(19, 7, 2.2, { tint: true }),
];

/** A magnet: snap to the grid. */
export const magnet: Glyph = [
  path("M5 4v8a7 7 0 0 0 14 0V4h-4v8a3 3 0 0 1-6 0V4z", { tint: true }),
  path("M5 8h4M15 8h4", { knock: true }),
];

/** One speaker, in the middle: the mono of the stereo pair. */
export const mono: Glyph = [
  rect(7, 5, 10, 14, 2, { tint: true }),
  circle(12, 14, 2.5, { knock: true }),
];
