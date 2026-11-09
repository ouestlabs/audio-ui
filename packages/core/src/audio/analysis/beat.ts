/**
 * Where a recording's notes and beats begin, and the tempo they keep: what a
 * DAW reads off a file it is given, to play it in time (CLP-018, CLP-019).
 */
import type { WarpMarker } from "../time/warp.ts";

/** How often the level is read, in seconds: fine enough to tell sixteenths apart at 200 BPM. */
const HOP_SECONDS = 0.005;
/** How long a stretch each reading of the level spans, in seconds: longer than the beating of notes held together (a chord's beat near 55 Hz), which would read as a slow pulse, and short enough to tell sixteenths apart. */
const WINDOW_SECONDS = 0.04;
/** How much of the level before it a rise must add to count: a held note's wavering stays under it. */
const RISE_SHARE = 0.25;
/** The slowest and fastest beat a tempo is looked for at. */
const MIN_BPM = 60;
const MAX_BPM = 200;
/** The tempo two that fit are told apart by: the one nearer this, an octave weighing as much as the beat's support. */
const CENTER_BPM = 120;
/** How sure a tempo must be, as how much of the rises the beat explains, to be given. */
const MIN_CONFIDENCE = 0.2;
/** Two transients are this far apart at least, in seconds. */
const MIN_GAP_SECONDS = 0.05;
/** How far around a rise its local level is read, in seconds. */
const LOCAL_SECONDS = 0.25;

/** A recording's tempo, as `estimateTempo` reads it. */
export interface TempoEstimate {
  bpm: number;
  /** How much of the recording's rises fall on that beat, from 0 to 1. */
  confidence: number;
  /** Where its first beat falls, in seconds. */
  firstBeat: number;
}

/** How the level rises, read every `hop` frames over `window` frames: the rise of its RMS where it is a sound starting, so a loud hit counts for more than a soft one, and 0 elsewhere. */
function rises(
  channels: readonly Float32Array[],
  hop: number,
  window: number
): Float32Array {
  const length = channels[0]?.length ?? 0;
  const count = Math.max(0, Math.floor(length / hop));
  const squares = (from: number, to: number) => {
    let sum = 0;
    for (const channel of channels) {
      for (let index = from; index < to; index += 1) {
        sum += (channel[index] as number) ** 2;
      }
    }
    return sum;
  };
  // Each hop's squares, summed once: a window is the hops it covers, and the part of one where it starts. Read
  // afresh each time, a window's sum never carries the rounding of the windows before it, as a running one would.
  const hops = Float64Array.from({ length: count }, (_, index) =>
    squares(index * hop, (index + 1) * hop)
  );
  const level = new Float32Array(count);
  for (let frame = 0; frame < count; frame += 1) {
    // The stretch just before the reading: a sound that starts rises the level where it starts, not a window early.
    const to = (frame + 1) * hop;
    const from = Math.max(0, to - window);
    const whole = Math.ceil(from / hop);
    let sum = squares(from, whole * hop);
    for (let index = whole; index <= frame; index += 1) {
      sum += hops[index] as number;
    }
    level[frame] = Math.sqrt(sum / ((to - from) * channels.length || 1));
  }
  const strength = new Float32Array(count);
  for (let frame = 1; frame < count; frame += 1) {
    const before = level[frame - 1] as number;
    const rise = (level[frame] as number) - before;
    // A held sound wavers a little; only a rise of a share of the level before it is a sound starting.
    strength[frame] = rise > RISE_SHARE * before ? rise : 0;
  }
  return strength;
}

const hopOf = (sampleRate: number) =>
  Math.max(1, Math.round(sampleRate * HOP_SECONDS));

/**
 * Where `channels` have their transients, in seconds: each frame where the
 * level rises sharply above what it does around it, found to the sample
 * where the slope first reaches half its height there.
 */
export function detectTransients(
  channels: readonly Float32Array[],
  sampleRate: number
): number[] {
  const hop = hopOf(sampleRate);
  const strength = rises(
    channels,
    hop,
    Math.round(sampleRate * WINDOW_SECONDS)
  );
  const count = strength.length;
  let highest = 0;
  for (const value of strength) {
    highest = Math.max(highest, value);
  }
  if (highest <= 0) {
    return [];
  }
  const reach = Math.max(1, Math.round(LOCAL_SECONDS / HOP_SECONDS));
  const peakReach = Math.max(1, Math.round(MIN_GAP_SECONDS / HOP_SECONDS));
  const found: number[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (let frame = 1; frame < count; frame += 1) {
    const value = strength[frame] as number;
    let sum = 0;
    let isPeak = value > 0;
    const from = Math.max(0, frame - reach);
    const to = Math.min(count, frame + reach + 1);
    for (let other = from; other < to; other += 1) {
      sum += strength[other] as number;
      if (
        Math.abs(other - frame) <= peakReach &&
        (strength[other] as number) > value
      ) {
        isPeak = false;
      }
    }
    const threshold = (1.5 * sum) / (to - from) + 0.1 * highest;
    if (isPeak && value > threshold && frame - last >= peakReach) {
      found.push(sampleOf(channels, frame, hop) / sampleRate);
      last = frame;
    }
  }
  return found;
}

/** The first frame around rise `frame` where the slope reaches half its height there. */
function sampleOf(
  channels: readonly Float32Array[],
  frame: number,
  hop: number
): number {
  const length = channels[0]?.length ?? 0;
  const from = Math.max(1, (frame - 1) * hop);
  const to = Math.min(length, (frame + 2) * hop);
  const slopeAt = (index: number) => {
    let most = 0;
    for (const channel of channels) {
      most = Math.max(
        most,
        Math.abs((channel[index] as number) - (channel[index - 1] as number))
      );
    }
    return most;
  };
  let peak = 0;
  for (let index = from; index < to; index += 1) {
    peak = Math.max(peak, slopeAt(index));
  }
  for (let index = from; index < to; index += 1) {
    if (slopeAt(index) >= peak / 2) {
      return index;
    }
  }
  return frame * hop;
}

/** How strongly the rises fall on a beat of `period` frames from `phase`, the rises read between whole frames. */
function combAt(strength: Float32Array, period: number, phase: number) {
  let sum = 0;
  let beats = 0;
  for (let at = phase; at < strength.length - 1; at += period) {
    const index = Math.floor(at);
    const t = at - index;
    sum +=
      (strength[index] as number) * (1 - t) +
      (strength[index + 1] as number) * t;
    beats += 1;
  }
  return beats > 0 ? sum / beats : 0;
}

/** The weight of a tempo by how far it lies from `CENTER_BPM`, an octave away weighing a little over half. */
const octaveWeight = (bpm: number) =>
  Math.exp(-0.5 * Math.log2(bpm / CENTER_BPM) ** 2);

/**
 * The tempo of `channels`: the beat period their rises repeat at most, in
 * 60 to 200 BPM, weighed toward 120 when two octaves fit, then tuned and
 * placed where its beats meet the most rises. `null` when no beat explains
 * enough of them: noise, a single hit.
 */
export function estimateTempo(
  channels: readonly Float32Array[],
  sampleRate: number
): TempoEstimate | null {
  const hop = hopOf(sampleRate);
  const hopSeconds = hop / sampleRate;
  const strength = rises(
    channels,
    hop,
    Math.round(sampleRate * WINDOW_SECONDS)
  );
  const count = strength.length;
  const shortest = Math.floor(60 / MAX_BPM / hopSeconds);
  const longest = Math.ceil(60 / MIN_BPM / hopSeconds);
  if (count < longest * 2) {
    return null;
  }
  let mean = 0;
  for (const value of strength) {
    mean += value;
  }
  mean /= count;
  if (mean <= 0) {
    return null;
  }
  const centered = Float32Array.from(strength, (value) => value - mean);
  const correlation = (lag: number) => {
    let sum = 0;
    for (let index = lag; index < count; index += 1) {
      sum += (centered[index] as number) * (centered[index - lag] as number);
    }
    return sum / (count - lag);
  };
  const energy = correlation(0);
  if (energy <= 0) {
    return null;
  }
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let lag = shortest; lag <= longest; lag += 1) {
    const score = correlation(lag) * octaveWeight(60 / (lag * hopSeconds));
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  const confidence = correlation(best) / energy;
  if (confidence < MIN_CONFIDENCE) {
    return null;
  }
  // Tuned over the whole recording: the period and the phase whose beats meet the most rises.
  let period = best;
  let phase = 0;
  let most = Number.NEGATIVE_INFINITY;
  for (let tried = best * 0.98; tried <= best * 1.02; tried += best * 0.0005) {
    for (let start = 0; start < tried; start += 1) {
      const score = combAt(strength, tried, start);
      if (score > most) {
        most = score;
        period = tried;
        phase = start;
      }
    }
  }
  const beat = period * hopSeconds;
  const transients = detectTransients(channels, sampleRate);
  // The first beat that has a sound on it: not one in the silence before the music starts.
  const [first = 0] = transients;
  const skipped = Math.max(
    0,
    Math.ceil((first - phase * hopSeconds - beat / 4) / beat)
  );
  const firstBeat = phase * hopSeconds + skipped * beat;
  const near = transients.find(
    (time) => Math.abs(time - firstBeat) <= hopSeconds * 2
  );
  return {
    bpm: 60 / beat,
    confidence: Math.min(1, confidence),
    firstBeat: near ?? firstBeat,
  };
}

/** How a file plays in time at an arrangement's tempo, as `autoWarp` works it out. */
export interface AutoWarp {
  /** The tempo it is taken to be at. */
  bpm: number;
  /** Where the clip starts in its own time: on the first beat. */
  offset: number;
  warp: WarpMarker[];
}

/** The bar counts a short file is taken to be a loop of. */
const LOOP_BARS = [1, 2, 4, 8, 16] as const;
/** How near the tempo a loop's length gives must be to the estimate, or to its double or half. */
const LOOP_TOLERANCE = 0.04;

/** How far apart two tempos are, as a share, once one is moved by octaves to the nearest of the other. */
function octaveDistance(a: number, b: number) {
  const octaves = Math.log2(a / b);
  return Math.abs(2 ** (octaves - Math.round(octaves)) - 1);
}

/**
 * The warp that plays a recording of `duration` seconds in time at `tempo`
 * BPM (CLP-019): a short one that a whole number of 1, 2, 4, 8 or 16 bars
 * fits at its estimated tempo, as that loop, marked at its start and end;
 * any other on a marker at the first beat of each bar, moved onto the
 * transient within an eighth of a beat. `null` when it has no tempo.
 */
export function autoWarp({
  beatsPerBar = 4,
  duration,
  estimate,
  tempo,
  transients = [],
}: {
  beatsPerBar?: number;
  duration: number;
  estimate: TempoEstimate | null;
  tempo: number;
  transients?: readonly number[];
}): AutoWarp | null {
  if (!estimate || duration <= 0 || tempo <= 0) {
    return null;
  }
  const loops = LOOP_BARS.map((bars) => (60 * beatsPerBar * bars) / duration)
    .filter(
      (loopBpm) =>
        loopBpm >= MIN_BPM / 2 &&
        loopBpm <= MAX_BPM * 2 &&
        octaveDistance(loopBpm, estimate.bpm) <= LOOP_TOLERANCE
    )
    .sort(
      (a, b) =>
        Math.abs(Math.log2(a / estimate.bpm)) -
        Math.abs(Math.log2(b / estimate.bpm))
    );
  const [loop] = loops;
  if (loop !== undefined) {
    return {
      bpm: loop,
      offset: 0,
      warp: [
        { source: 0, target: 0 },
        { source: duration, target: (duration * loop) / tempo },
      ],
    };
  }
  const { bpm, firstBeat } = estimate;
  const beat = 60 / bpm;
  const bar = beat * beatsPerBar;
  const targetBar = (60 * beatsPerBar) / tempo;
  const start = (firstBeat * bpm) / tempo;
  const warp: WarpMarker[] = [];
  for (let index = 0; firstBeat + index * bar < duration; index += 1) {
    const at = firstBeat + index * bar;
    const near = transients.reduce<number | null>(
      (closest, time) =>
        Math.abs(time - at) <= beat / 8 &&
        (closest === null || Math.abs(time - at) < Math.abs(closest - at))
          ? time
          : closest,
      null
    );
    warp.push({ source: near ?? at, target: start + index * targetBar });
  }
  if (warp.length === 1) {
    warp.push({
      source: duration,
      target: start + (duration - firstBeat) * (bpm / tempo),
    });
  }
  return { bpm, offset: start, warp };
}
