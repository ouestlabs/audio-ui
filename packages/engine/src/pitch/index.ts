/** The note nearest a frequency and how far off it is: `{ midi, name, hz, cents }`, `cents` positive when sharp. */
/** A pitch's frequency, A4 at 440 Hz unless told. */
export { cents, midiToHz } from "@audio/note";
export { detectKeys, type KeyNote } from "./key.ts";
export {
  inScale,
  nearestInScale,
  rollScale,
  SCALES,
  type Scale,
  type ScaleName,
  scalePitchClasses,
} from "./scale.ts";
