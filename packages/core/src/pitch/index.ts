export { isBlackKey, pitchClassName, pitchName } from "../shared/pitch.ts";
export {
  detectPitch,
  type PitchDetectionOptions,
  type PitchEstimate,
} from "./detect.ts";
export {
  CONCERT_PITCH_HZ,
  frequencyToNote,
  type Note,
  nearestNote,
  noteToFrequency,
} from "./note.ts";
