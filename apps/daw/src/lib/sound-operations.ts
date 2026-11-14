import {
  type DitherMethod,
  ditherChannels,
  type FilterType,
  filterChannels,
  type NormalizeTarget,
  normalizeChannels,
  padChannels,
  panChannels,
  repeatChannels,
  reverseChannels,
  type ShiftMethod,
  type StretchMethod,
  shiftChannels,
  speedChannels,
  stretchChannels,
} from "@audio-ui/engine/files";
import {
  formatFrequency,
  formatLevel,
  formatPan,
} from "@audio-ui/engine/format";
import { type Repair, repairChannels } from "@audio-ui/engine/repair";

/** A sound as plain samples: what an operation reads and writes. */
export interface SoundSamples {
  channels: Float32Array[];
  sampleRate: number;
}

/** One change to a sound's samples. */
export type SoundOperation =
  /** The sound played from its end. */
  | { type: "reverse" }
  /** The sound played `times` times in a row. */
  | { times: number; type: "repeat" }
  /** `seconds` of silence added at the end. */
  | { seconds: number; type: "pad" }
  /** One gain on every channel, to a peak in dBFS or a loudness in LUFS. */
  | { target: NormalizeTarget; type: "normalize" }
  /** A stereo sound's balance, from -1 (left) to 1 (right). */
  | { pan: number; type: "pan" }
  /** The sound rounded to `bits` bits, its error made into noise by `method`. */
  | { bits: number; method: DitherMethod; type: "dither" }
  /** A filter of the `filter` kind at `frequency`, in hertz. */
  | { filter: FilterType; frequency: number; type: "filter" }
  /** One defect taken out, by the method made for it. */
  | { repair: Repair; type: "repair" }
  /** The sound `factor` times as long at the same pitch, by `method`. */
  | { factor: number; method: StretchMethod; type: "stretch" }
  /** The pitch `semitones` higher or lower at the same length, by `method`. */
  | { method: ShiftMethod; semitones: number; type: "shift" }
  /** The sound `speed` times as fast, its pitch moving with it. */
  | { speed: number; type: "speed" };

/** What each repair is called. */
export const REPAIR_NAMES: Record<Repair, string> = {
  breaths: "Reduce breaths",
  clean: "Clean automatically",
  clicks: "Remove clicks",
  clipping: "Repair clipping",
  crackle: "Remove crackle",
  hum50: "Remove hum, 50 Hz",
  hum60: "Remove hum, 60 Hz",
  noise: "Remove noise",
  plosives: "Soften plosives",
  reverb: "Reduce reverb",
  speechNoise: "Remove noise from speech",
  wind: "Remove wind",
};

const FILTER_NAMES: Record<FilterType, string> = {
  highpass: "High-pass",
  lowpass: "Low-pass",
  notch: "Notch",
};

/** What an operation is called, as a step of the history: "Repeat ×2", "Pitch -5 st". */
export function soundOperationName(operation: SoundOperation): string {
  switch (operation.type) {
    case "reverse":
      return "Reverse";
    case "repeat":
      return `Repeat ×${operation.times}`;
    case "pad":
      return `Add ${operation.seconds} s of silence`;
    case "normalize": {
      const { target } = operation;
      return `Normalize to ${
        "peak" in target
          ? formatLevel(target.peak, "dBFS")
          : formatLevel(target.lufs, "LUFS")
      }`;
    }
    case "pan":
      return `Pan ${formatPan(operation.pan)}`;
    case "dither":
      return `Dither to ${operation.bits} bits`;
    case "filter":
      return `${FILTER_NAMES[operation.filter]} at ${formatFrequency(operation.frequency)}`;
    case "repair":
      return REPAIR_NAMES[operation.repair];
    case "stretch":
      return `Stretch to ${Math.round(operation.factor * 100)} %`;
    case "shift":
      return `Pitch ${operation.semitones > 0 ? "+" : ""}${operation.semitones} st`;
    default:
      return `Speed ×${operation.speed}`;
  }
}

/** The channels an operation makes of `channels`, at `sampleRate`. */
function changed(
  { channels, sampleRate }: SoundSamples,
  operation: SoundOperation
): Float32Array[] {
  switch (operation.type) {
    case "reverse":
      return reverseChannels(channels);
    case "repeat":
      return repeatChannels(channels, operation.times);
    case "pad":
      return padChannels(channels, { after: operation.seconds * sampleRate });
    case "normalize":
      return normalizeChannels(channels, sampleRate, operation.target);
    case "pan":
      return panChannels(channels, operation.pan);
    case "dither":
      return ditherChannels(channels, operation.bits, operation.method);
    case "filter":
      return filterChannels(channels, sampleRate, {
        frequency: operation.frequency,
        type: operation.filter,
      });
    case "repair":
      return repairChannels(channels, sampleRate, operation.repair);
    case "stretch":
      return stretchChannels(channels, sampleRate, {
        factor: operation.factor,
        method: operation.method,
      });
    case "shift":
      return shiftChannels(channels, sampleRate, {
        method: operation.method,
        semitones: operation.semitones,
      });
    default:
      return speedChannels(channels, sampleRate, operation.speed);
  }
}

/** The sound an operation makes: new channels, at the same rate. */
export function applySoundOperation(
  sound: SoundSamples,
  operation: SoundOperation
): SoundSamples {
  return {
    channels: changed(sound, operation),
    sampleRate: sound.sampleRate,
  };
}

/**
 * How an operation moves the times of a sound: `"scaled"` by how much longer
 * it makes it (Stretch, Speed), `"extended"` at the end (Repeat, Add silence),
 * or `"kept"`.
 */
export function soundOperationTiming(
  operation: SoundOperation
): "extended" | "kept" | "scaled" {
  switch (operation.type) {
    case "stretch":
    case "speed":
      return "scaled";
    case "repeat":
    case "pad":
      return "extended";
    default:
      return "kept";
  }
}
