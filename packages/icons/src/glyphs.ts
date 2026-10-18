import { circle, type Glyph, path, rect } from "./glyph.ts";

/** Where to begin: a flag. */
export const start: Glyph = [
  path("M6 20V4"),
  path("M6 5h11l-2.5 4 2.5 4H6", { tint: true }),
];

/** The pieces of any interface: a knob with its mark. */
export const elements: Glyph = [
  circle(12, 12, 8, { tint: true }),
  path("M12 8h.01"),
];

/** The surfaces of a DAW: clips on tracks. */
export const workstation: Glyph = [
  path("M4 7h9M9 12h11M6 17h8"),
  rect(4, 5.5, 9, 3, 1, { backdrop: true }),
  rect(9, 10.5, 11, 3, 1, { backdrop: true }),
  rect(6, 15.5, 8, 3, 1, { backdrop: true }),
];

/** Effects and instruments: a unit of a rack with its knob. */
export const devices: Glyph = [
  rect(3, 7, 18, 10, 2, { tint: true }),
  path("M7.5 12h.01"),
];

/** What makes the sound: bars of a waveform. */
export const engine: Glyph = [
  path("M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"),
  rect(3, 4, 18, 16, 3, { backdrop: true }),
];

export const introduction: Glyph = [
  circle(12, 12, 9, { tint: true }),
  path("M12 8h.01M11 12h1v4"),
];

export const installation: Glyph = [
  path("M12 4v11M8 11l4 4 4-4M5 19h14"),
  rect(5, 15, 14, 4, 1, { backdrop: true }),
];

export const registry: Glyph = [
  path("m12 3-8 4.5v9L12 21l8-4.5v-9z", { tint: true }),
  path("m4 7.5 8 4.5 8-4.5M12 12v9"),
];

export const primitives: Glyph = [
  circle(8, 8, 4, { tint: true }),
  rect(12, 12, 8, 8, 1, { tint: true }),
];

export const headless: Glyph = [
  path(
    "M9 5H8a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h1M15 5h1a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a2 2 0 0 1-2 2h-1"
  ),
];

export const tokens: Glyph = [
  path("M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z", { tint: true }),
];

export const roadmap: Glyph = [
  circle(6, 18, 2, { tint: true }),
  circle(18, 6, 2, { tint: true }),
  path("M6 16v-5a4 4 0 0 1 4-4h6"),
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
