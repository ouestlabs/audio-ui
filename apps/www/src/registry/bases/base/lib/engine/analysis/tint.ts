import {
  cascade,
  process as filterSection,
  highpass,
  lowpass,
  state,
} from "@audio/biquad";
import crossover from "@audio/eq-crossover";

/** What each slice of a sound is made of: the share of its lows, mids and highs, the loudest of the three being 1. */
export interface BandShares {
  high: Float32Array;
  low: Float32Array;
  mid: Float32Array;
}

/** Where the lows end and the highs begin, in hertz. */
const LOW_UNDER = 250;
const HIGH_OVER = 2500;

/**
 * Reads a sound as `count` slices of equal length, each by how its energy is
 * spread over three bands: the lows under 250 Hz, the highs over 2.5 kHz and
 * the mids between. It is what colours a waveform by its frequencies, a drum
 * low and a hat high. Channels are mixed to one; silence is all zeros. It
 * reads every sample once for each band.
 */
export function bandShares(
  channels: readonly Float32Array[],
  sampleRate: number,
  count: number
): BandShares {
  const length = channels[0]?.length ?? 0;
  const mix = new Float32Array(length);
  for (const channel of channels) {
    for (let index = 0; index < length; index += 1) {
      mix[index] =
        (mix[index] as number) + (channel[index] as number) / channels.length;
    }
  }
  const low = Float32Array.from(mix);
  filterSection(low, lowpass(LOW_UNDER, Math.SQRT1_2, sampleRate));
  const high = Float32Array.from(mix);
  filterSection(high, highpass(HIGH_OVER, Math.SQRT1_2, sampleRate));
  const shares: BandShares = {
    high: new Float32Array(count),
    low: new Float32Array(count),
    mid: new Float32Array(count),
  };
  for (let slice = 0; slice < count; slice += 1) {
    const from = Math.floor((slice * length) / count);
    const to = Math.max(from + 1, Math.floor(((slice + 1) * length) / count));
    let l = 0;
    let m = 0;
    let h = 0;
    for (let index = from; index < to && index < length; index += 1) {
      const lo = low[index] as number;
      const hi = high[index] as number;
      const mi = (mix[index] as number) - lo - hi;
      l += lo * lo;
      m += mi * mi;
      h += hi * hi;
    }
    const top = Math.max(l, m, h);
    if (top > 1e-12) {
      shares.low[slice] = Math.sqrt(l / top);
      shares.mid[slice] = Math.sqrt(m / top);
      shares.high[slice] = Math.sqrt(h / top);
    }
  }
  return shares;
}

/** A sound as three signals: what it has under 250 Hz, between, and over 2.5 kHz. */
export interface SplitBands {
  high: Float32Array;
  low: Float32Array;
  mid: Float32Array;
  /** The loudest sample of each band, 0 to 1: draw each as tall as its own loudest reaches, so a band that is quiet in the mix still shows. */
  peaks: { high: number; low: number; mid: number };
}

/** The three bands of a stretch of sound: its lows under 250 Hz, its highs over 2.5 kHz, and the mids between. */
export interface Bands {
  high: Float32Array;
  low: Float32Array;
  mid: Float32Array;
}

/**
 * Splits a sound in three a stretch at a time, as `splitBands` does: each call
 * takes the stretch that follows the one before and carries the crossover's
 * state over, so stretches split in order are the sound split whole. Start
 * another for another sound, or to read from somewhere else: a stretch read on
 * its own settles once some tens of milliseconds have gone through.
 */
export function createBandSplit(
  sampleRate: number
): (stretch: ArrayLike<number>) => Bands {
  const bands = crossover([LOW_UNDER, HIGH_OVER], 4, sampleRate);
  const [lowBand = [], midBand = [], highBand = []] = bands;
  const kept = [lowBand, midBand, highBand].map((sections) =>
    sections.map(() => state())
  );
  const through = (
    stretch: ArrayLike<number>,
    sections: Parameters<typeof cascade>[1],
    states: ReturnType<typeof state>[] | undefined
  ) => {
    const out = Float32Array.from(stretch);
    cascade(out, sections, states);
    return out;
  };
  return (stretch) => ({
    high: through(stretch, highBand, kept[2]),
    low: through(stretch, lowBand, kept[0]),
    mid: through(stretch, midBand, kept[1]),
  });
}

/**
 * The sound's channels mixed to one and split in three by a Linkwitz-Riley
 * crossover (`@audio/eq-crossover`, 24 dB an octave) at 250 Hz and 2.5 kHz:
 * the three bands add back to the mix, level and phase. Draw each as a
 * waveform of its own to colour a sound by its frequencies, as DJ software
 * does; `bandShares` is the same split read as shares per slice. It holds
 * three copies of the mix, so call it when a view asks for it; a sound too
 * long to hold is split a stretch at a time by `createBandSplit`.
 */
export function splitBands(
  channels: readonly Float32Array[],
  sampleRate: number
): SplitBands {
  const length = channels[0]?.length ?? 0;
  const mix = new Float32Array(length);
  for (const channel of channels) {
    for (let index = 0; index < length; index += 1) {
      mix[index] =
        (mix[index] as number) + (channel[index] as number) / channels.length;
    }
  }
  const { high, low, mid } = createBandSplit(sampleRate)(mix);
  const loudest = (values: Float32Array) =>
    values.reduce((top, value) => Math.max(top, Math.abs(value)), 0);
  return {
    high,
    low,
    mid,
    peaks: { high: loudest(high), low: loudest(low), mid: loudest(mid) },
  };
}
