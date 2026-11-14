/**
 * The operations that change a sound's samples, as data: what the Process
 * menu and an audio editor's edits offer, what `applySoundOperation` runs on
 * plain channels, the whole sound or a stretch of it, and what
 * `soundOperationName` writes as a step of the history. Each process is an
 * operation of `@audio-ui/engine/files` or `@audio-ui/engine/repair`.
 */

import { type FadeShape, fadeGain } from "@audio-ui/core/timeline";
import { dbToGain } from "@audio-ui/engine/analysis";
import {
  type DitherMethod,
  ditherChannels,
  type FilterType,
  filterChannels,
  gainChannels,
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

/** A stretch of a sound, from where it starts to where it ends, in seconds. */
export type SoundRange = readonly [number, number];

/** One change to a sound's samples. */
export type SoundOperation =
  /** The stretch taken out, what follows it closing the gap. */
  | { type: "delete" }
  /** The stretch alone kept. */
  | { type: "crop" }
  /** The stretch replaced by `channels`, laid down at its start: at a point, they are inserted there. */
  | { channels: readonly Float32Array[]; type: "paste" }
  /** One gain on every channel, `db` decibels up or down. */
  | { db: number; type: "gain" }
  /** Fades at its two ends, `fadeIn` and `fadeOut` seconds long along their curves, and one level over it, `gain` in dB. */
  | {
      fadeIn: number;
      fadeInShape: FadeShape;
      fadeOut: number;
      fadeOutShape: FadeShape;
      gain: number;
      type: "shape";
    }
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
    case "delete":
      return "Delete";
    case "crop":
      return "Crop";
    case "paste":
      return "Paste";
    case "gain":
      return operation.db > 0 ? "Louder" : "Quieter";
    case "shape":
      return operation.fadeIn > 0 || operation.fadeOut > 0 ? "Fade" : "Level";
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

/** Every channel faded in and out along its curves and brought to one level. */
function shapedChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  shape: Extract<SoundOperation, { type: "shape" }>
): Float32Array[] {
  const level = dbToGain(shape.gain);
  return channels.map((channel) => {
    const frames = channel.length;
    const rise = Math.min(frames, Math.round(shape.fadeIn * sampleRate));
    const fall = Math.min(frames, Math.round(shape.fadeOut * sampleRate));
    return channel.map((sample, index) => {
      const into = index < rise ? fadeGain(shape.fadeInShape, index / rise) : 1;
      const outOf =
        index >= frames - fall
          ? fadeGain(shape.fadeOutShape, (frames - index) / fall)
          : 1;
      return sample * level * into * outOf;
    });
  });
}

/** The channels an operation makes of `channels`, at `sampleRate`. */
function changed(
  { channels, sampleRate }: SoundSamples,
  operation: SoundOperation
): Float32Array[] {
  switch (operation.type) {
    case "delete":
      return channels.map(() => new Float32Array(0));
    case "crop":
      return channels;
    case "paste":
      // As many channels as the sound has: a mono clipboard on every one.
      return channels.map((_, index) =>
        Float32Array.from(
          operation.channels[index] ?? operation.channels[0] ?? []
        )
      );
    case "gain":
      return gainChannels(channels, operation.db);
    case "shape":
      return shapedChannels(channels, sampleRate, operation);
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

/** How long the seam between what an operation made and what it left is crossfaded, in seconds: no click at either end. */
export const SEAM = 0.005;

/**
 * `channel` with frames `from` to `to` replaced by `middle`, each seam
 * crossfaded over `fade` frames into the sound as it ran on, so a cut, an
 * insert or a stretch processed alone makes no click.
 */
function spliced(
  channel: Float32Array,
  from: number,
  to: number,
  middle: Float32Array,
  fade: number
): Float32Array {
  const out = new Float32Array(from + middle.length + channel.length - to);
  out.set(channel.subarray(0, from));
  out.set(middle, from);
  out.set(channel.subarray(to), from + middle.length);
  // Into what was made: from the sound as it ran on past `from`.
  const into =
    from > 0 ? Math.min(fade, out.length - from, channel.length - from) : 0;
  for (let index = 0; index < into; index += 1) {
    const share = (index + 1) / (into + 1);
    const at = from + index;
    out[at] =
      (out[at] ?? 0) * share + (channel[from + index] ?? 0) * (1 - share);
  }
  // Out of it: into the sound as it ran up to `to`.
  const end = from + middle.length;
  const leave = Math.min(fade, middle.length, to, channel.length - to);
  for (let index = 0; index < leave; index += 1) {
    const share = (index + 1) / (leave + 1);
    const at = end - leave + index;
    out[at] =
      (out[at] ?? 0) * (1 - share) + (channel[to - leave + index] ?? 0) * share;
  }
  return out;
}

/**
 * The sound an operation makes, at the same rate: of the whole sound, or of
 * `range` alone, spliced back in with its seams crossfaded. Delete takes the
 * range out, Crop keeps it alone, and Paste puts its channels in its place.
 */
export function applySoundOperation(
  sound: SoundSamples,
  operation: SoundOperation,
  range?: SoundRange
): SoundSamples {
  const { channels, sampleRate } = sound;
  const frames = channels[0]?.length ?? 0;
  if (!range) {
    return {
      channels:
        operation.type === "delete"
          ? channels.map(() => new Float32Array(0))
          : changed(sound, operation),
      sampleRate,
    };
  }
  const [from, to] = [
    Math.max(0, Math.min(frames, Math.round(range[0] * sampleRate))),
    Math.max(0, Math.min(frames, Math.round(range[1] * sampleRate))),
  ].sort((a, b) => a - b) as [number, number];
  const stretch = channels.map((channel) => channel.slice(from, to));
  if (operation.type === "crop") {
    return { channels: stretch, sampleRate };
  }
  const made = changed({ channels: stretch, sampleRate }, operation);
  const fade = Math.round(SEAM * sampleRate);
  return {
    channels: channels.map((channel, index) =>
      spliced(channel, from, to, made[index] ?? new Float32Array(0), fade)
    ),
    sampleRate,
  };
}

/**
 * How an operation moves the times in the stretch it changes: `"scaled"` by
 * how much longer it makes it (Stretch, Speed), `"cropped"` to it alone
 * (Crop), or `"spliced"`, where what it made starts where the stretch did and
 * what follows moves by as much as it grew or shrank (Delete, Paste, Repeat,
 * Add silence, and the rest, which keep its length).
 */
export function soundOperationTiming(
  operation: SoundOperation
): "cropped" | "scaled" | "spliced" {
  switch (operation.type) {
    case "stretch":
    case "speed":
      return "scaled";
    case "crop":
      return "cropped";
    default:
      return "spliced";
  }
}
