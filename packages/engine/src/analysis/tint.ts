import {
  cascade,
  process as filterSection,
  highpass,
  lowpass,
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

/**
 * The sound's channels mixed to one and split in three by a Linkwitz-Riley
 * crossover (`@audio/eq-crossover`, 24 dB an octave) at 250 Hz and 2.5 kHz:
 * the three bands add back to the mix, level and phase. Draw each as a
 * waveform of its own to colour a sound by its frequencies, as DJ software
 * does; `bandShares` is the same split read as shares per slice. It holds
 * three copies of the mix, so call it when a view asks for it.
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
  const [lowBand, midBand, highBand] = crossover(
    [LOW_UNDER, HIGH_OVER],
    4,
    sampleRate
  );
  const through = (sections: Parameters<typeof cascade>[1]) => {
    const out = Float32Array.from(mix);
    cascade(out, sections);
    return out;
  };
  const high = through(highBand ?? []);
  const low = through(lowBand ?? []);
  const mid = through(midBand ?? []);
  const loudest = (values: Float32Array) =>
    values.reduce((top, value) => Math.max(top, Math.abs(value)), 0);
  return {
    high,
    low,
    mid,
    peaks: { high: loudest(high), low: loudest(low), mid: loudest(mid) },
  };
}
