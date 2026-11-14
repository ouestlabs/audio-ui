import {
  debreath,
  declick,
  declip,
  decrackle,
  dehum,
  denoise,
  deplosive,
  dereverb,
  dewind,
  omlsa,
  wiener,
} from "@audio/denoise";

/**
 * The defects of a recording that can be taken out of it, each by the
 * method made for it: `clean` finds what the sound carries and picks the
 * method itself; `clicks` and `crackle` rebuild impulses from the sound
 * around them (vinyl ticks, mouth clicks, shellac); `hum50` and `hum60` take
 * out the mains hum and its harmonics; `noise` and `speechNoise` take out
 * steady broadband noise, and noise that changes under a voice; `clipping`
 * rebuilds peaks cut at full scale; `wind` and `plosives` take out low
 * rumble and the bursts of p and b; `breaths` and `reverb` take down the
 * breaths between phrases and a room's late reverb.
 */
export const REPAIRS = [
  "clean",
  "clicks",
  "crackle",
  "hum50",
  "hum60",
  "noise",
  "speechNoise",
  "clipping",
  "wind",
  "plosives",
  "breaths",
  "reverb",
] as const;

export type Repair = (typeof REPAIRS)[number];

type Mono = (data: Float32Array, fs: number) => Float32Array;

/** Each repair's method, as a map: a name it does not hold finds nothing, not a function every object inherits. */
const METHODS = new Map<string, Mono>(
  Object.entries({
    breaths: (data, fs) => debreath(data, { fs }),
    clean: (data, fs) => denoise(data, { fs }),
    clicks: (data, fs) => declick(data, { fs }),
    clipping: (data, fs) => declip(data, { fs }),
    crackle: (data, fs) => decrackle(data, { fs }),
    hum50: (data, fs) => dehum(data, { freq: 50, fs }),
    hum60: (data, fs) => dehum(data, { freq: 60, fs }),
    noise: (data, fs) => wiener(data, { fs }),
    plosives: (data, fs) => deplosive(data, { fs }),
    reverb: (data, fs) => dereverb(data, { fs }),
    speechNoise: (data, fs) => omlsa(data, { fs }),
    wind: (data, fs) => dewind(data, { fs }),
  } satisfies Record<Repair, Mono>)
);

/**
 * Every channel with one defect taken out, by the method made for it, each
 * channel on its own. The source is left as it is, and a sound with no such
 * defect comes back as it was. A name not in `REPAIRS` throws a `RangeError`.
 */
export function repairChannels(
  channels: readonly Float32Array[],
  sampleRate: number,
  repair: Repair
): Float32Array[] {
  const method = METHODS.get(repair);
  if (!method) {
    throw new RangeError(`There is no repair called "${repair}".`);
  }
  return channels.map((channel) =>
    method(Float32Array.from(channel), sampleRate)
  );
}
