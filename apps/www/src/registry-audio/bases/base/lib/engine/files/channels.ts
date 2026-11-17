import resample from "@audio/resample-sinc";

/** The layouts a sound can be mixed to: one channel, two, or the surround layouts of film. */
export const CHANNEL_LAYOUTS = ["mono", "stereo", "5.1", "7.1"] as const;

export type ChannelLayout = (typeof CHANNEL_LAYOUTS)[number];

/** How many channels a layout has. */
export const LAYOUT_CHANNELS: Record<ChannelLayout, number> = {
  "5.1": 6,
  "7.1": 8,
  mono: 1,
  stereo: 2,
};

/** One sound's channels by the speaker they feed, silent where it has none. */
interface Speakers {
  C: Float32Array;
  L: Float32Array;
  Lb: Float32Array;
  LFE: Float32Array;
  Ls: Float32Array;
  R: Float32Array;
  Rb: Float32Array;
  Rs: Float32Array;
}

/** The share a channel gives to a speaker that is not its own: -3 dB. */
const SIDE = Math.SQRT1_2;

/** The share of a side an up-mix gives the surrounds: -6 dB. */
const SURROUND_GAIN = 0.5;

/** A channel's samples times `gain`, a new array. */
const scaled = (channel: Float32Array, gain: number) => {
  const out = new Float32Array(channel.length);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = (channel[index] ?? 0) * gain;
  }
  return out;
};

/** Channels added, each at its own gain, over `length` samples. */
const mixed = (
  length: number,
  parts: readonly [Float32Array, number][]
): Float32Array => {
  const out = new Float32Array(length);
  for (const [channel, gain] of parts) {
    for (let index = 0; index < length; index += 1) {
      out[index] = (out[index] ?? 0) + (channel[index] ?? 0) * gain;
    }
  }
  return out;
};

/** The speakers a sound's channels feed, by their count: 1 is a centre, 2 left and right, 6 a 5.1 and 8 a 7.1. */
function speakersOf(channels: readonly Float32Array[]): Speakers {
  const length = channels[0]?.length ?? 0;
  const silent = () => new Float32Array(length);
  const at = (index: number) => channels[index] ?? silent();
  if (channels.length === 1) {
    return {
      C: at(0),
      L: silent(),
      LFE: silent(),
      Lb: silent(),
      Ls: silent(),
      R: silent(),
      Rb: silent(),
      Rs: silent(),
    };
  }
  if (channels.length <= 2) {
    return {
      C: silent(),
      L: at(0),
      LFE: silent(),
      Lb: silent(),
      Ls: silent(),
      R: at(1),
      Rb: silent(),
      Rs: silent(),
    };
  }
  // 5.1 is L R C LFE Ls Rs; 7.1 adds Lb Rb after them. Any other count reads as far as it goes.
  return {
    C: at(2),
    L: at(0),
    LFE: at(3),
    Lb: at(6),
    Ls: at(4),
    R: at(1),
    Rb: at(7),
    Rs: at(5),
  };
}

/** The two sides of a mix: a lone centre on both, two channels as they are, more folded down. */
function sidesOf(
  count: number,
  speakers: Speakers,
  folded: readonly [Float32Array, Float32Array]
): [Float32Array, Float32Array] {
  if (count === 1) {
    return [speakers.C, speakers.C];
  }
  if (count === 2) {
    return [speakers.L, speakers.R];
  }
  return [folded[0], folded[1]];
}

/**
 * The same sound in another layout: a down-mix folds the centre and the
 * surrounds into the sides at -3 dB and drops the low-frequency channel, and
 * scales so the sum stays at full scale at most; an up-mix keeps the sides
 * where they are, spreads them to the surrounds at -6 dB and leaves the centre
 * and the low-frequency channel silent. A layout the sound already has comes
 * back as it is.
 */
export function mixChannels(
  channels: readonly Float32Array[],
  layout: ChannelLayout
): Float32Array[] {
  if (channels.length === LAYOUT_CHANNELS[layout] || channels.length === 0) {
    return [...channels];
  }
  const speakers = speakersOf(channels);
  const length = channels[0]?.length ?? 0;
  // What the sides hold of the rest, folded in: the weights add up to this, so the gain is its inverse.
  const folded = 1 + SIDE + SIDE + SIDE;
  const left = mixed(length, [
    [speakers.L, 1 / folded],
    [speakers.C, SIDE / folded],
    [speakers.Ls, SIDE / folded],
    [speakers.Lb, SIDE / folded],
  ]);
  const right = mixed(length, [
    [speakers.R, 1 / folded],
    [speakers.C, SIDE / folded],
    [speakers.Rs, SIDE / folded],
    [speakers.Rb, SIDE / folded],
  ]);
  // A sound of one or two channels has nothing to fold in: its sides are as they are, a lone centre on both.
  const sides = sidesOf(channels.length, speakers, [left, right]);
  const [leftOut, rightOut] = sides;
  if (layout === "mono") {
    return [
      mixed(length, [
        [leftOut, 0.5],
        [rightOut, 0.5],
      ]),
    ];
  }
  if (layout === "stereo") {
    return [leftOut, rightOut];
  }
  // Surrounds a sound has not got are its sides at -6 dB; those it has stay.
  const spread = channels.length > 2;
  const six = [
    leftOut,
    rightOut,
    speakers.C,
    speakers.LFE,
    spread ? speakers.Ls : scaled(leftOut, SURROUND_GAIN),
    spread ? speakers.Rs : scaled(rightOut, SURROUND_GAIN),
  ];
  if (layout === "5.1") {
    return six;
  }
  const wide = channels.length > 6;
  return [
    ...six,
    wide ? speakers.Lb : scaled(leftOut, SURROUND_GAIN),
    wide ? speakers.Rb : scaled(rightOut, SURROUND_GAIN),
  ];
}

/**
 * Every channel at another sample rate, by a windowed sinc: the same sound,
 * heard as a converter of that rate would give it, over `channels.length`
 * arrays as long as the new rate needs. The same rate comes back as it is.
 */
export function resampleChannels(
  channels: readonly Float32Array[],
  from: number,
  to: number
): Float32Array[] {
  if (from === to) {
    return [...channels];
  }
  return channels.map((channel) => resample(channel, { from, to }));
}

/** Every channel played backwards: the end first. */
export function reverseChannels(
  channels: readonly Float32Array[]
): Float32Array[] {
  return channels.map((channel) => Float32Array.from(channel).reverse());
}

/** The sound played `times` times in a row, the first included. Fewer than one is one. */
export function repeatChannels(
  channels: readonly Float32Array[],
  times: number
): Float32Array[] {
  const count = Math.max(1, Math.floor(times));
  return channels.map((channel) => {
    const out = new Float32Array(channel.length * count);
    for (let index = 0; index < count; index += 1) {
      out.set(channel, index * channel.length);
    }
    return out;
  });
}

/** Silence, in samples, added before and after the sound. */
export function padChannels(
  channels: readonly Float32Array[],
  { after = 0, before = 0 }: { after?: number; before?: number }
): Float32Array[] {
  const start = Math.max(0, Math.round(before));
  const end = Math.max(0, Math.round(after));
  return channels.map((channel) => {
    const out = new Float32Array(start + channel.length + end);
    out.set(channel, start);
    return out;
  });
}
