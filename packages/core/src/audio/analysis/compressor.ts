/**
 * The transfer curve of a compressor: the output level in dB for each input
 * level in dB. `compressorOutput` is the textbook curve, a knee centred on the
 * threshold, what a plug-in draws. `webAudioCompressorOutput` is the curve of
 * the browser's `DynamicsCompressorNode`, which is not the same: its knee runs
 * from the threshold up, and it adds a make-up gain of its own that grows
 * with the threshold and the ratio. Draw the second when the curve is meant to
 * be the response you hear from that node.
 */

export interface CompressorSettings {
  /** Width in dB of the soft bend around the threshold. @default 0 */
  kneeDb?: number;
  /** Gain added after compressing, in dB. @default 0 */
  makeupDb?: number;
  /** Input to output ratio above the threshold: 4 is 4:1. */
  ratio: number;
  thresholdDb: number;
}

/**
 * A compressor's transfer curve: the output level in dB for each input level
 * in dB. Below the threshold the level passes unchanged; above it, every
 * `ratio` dB in comes out as one, with a quadratic bend across the knee.
 */
export function compressorOutput({
  kneeDb = 0,
  makeupDb = 0,
  ratio,
  thresholdDb,
}: CompressorSettings): (inputDb: number) => number {
  const slope = 1 / Math.max(ratio, 1) - 1;
  const half = Math.max(kneeDb, 0) / 2;
  return (inputDb) => {
    const over = inputDb - thresholdDb;
    let reduction = 0;
    if (half > 0 && Math.abs(over) <= half) {
      reduction = (slope * (over + half) ** 2) / (4 * half);
    } else if (over > half) {
      reduction = slope * over;
    }
    return inputDb + reduction + makeupDb;
  };
}

const SLOPE_STEPS = 15;
const MIN_K = 0.1;
const MAX_K = 10_000;
const MAKEUP_EXPONENT = 0.6;

const toLinear = (db: number) => 10 ** (db / 20);
const toDb = (linear: number) => 20 * Math.log10(Math.max(linear, 1e-12));

/**
 * The transfer curve of the browser's `DynamicsCompressorNode`, as its
 * specification describes it: below the threshold the level passes; from the
 * threshold to `threshold + knee` an exponential knee eases in; above it the
 * ratio holds. The node then adds a make-up gain it works out for itself,
 * `0.6` of the gain the curve takes off at full scale, so a compressed signal
 * is not left quieter: at a threshold of -24 dB and a ratio of 4 that is
 * +10.8 dB. Checked against Chrome's node in steady state, to a few tenths of
 * a dB (the node's attack and release move it around the curve a little, and
 * the make-up is not a setting of yours). `makeupDb` is ignored: the node has
 * none of its own.
 */
export function webAudioCompressorOutput({
  kneeDb = 30,
  ratio,
  thresholdDb,
}: Omit<CompressorSettings, "makeupDb">): (inputDb: number) => number {
  const slope = 1 / Math.max(ratio, 1);
  const knee = Math.max(kneeDb, 0);
  const linearThreshold = toLinear(thresholdDb);
  const kneeStart = linearThreshold;
  const kneeEndDb = thresholdDb + knee;
  const kneeEnd = toLinear(kneeEndDb);

  const kneeCurve = (x: number, k: number) =>
    x < linearThreshold
      ? x
      : linearThreshold + (1 - Math.exp(-k * (x - linearThreshold))) / k;
  const slopeAt = (x: number, k: number) => {
    if (x < linearThreshold) {
      return 1;
    }
    const x2 = x * 1.001;
    return (
      (toDb(kneeCurve(x2, k)) - toDb(kneeCurve(x, k))) / (toDb(x2) - toDb(x))
    );
  };
  // The knee's steepness: the one that makes its slope at the end of the knee
  // the ratio's, found by bisection as the node does.
  let steepness = 5;
  if (knee > 0) {
    let low = MIN_K;
    let high = MAX_K;
    for (let step = 0; step < SLOPE_STEPS; step += 1) {
      if (slopeAt(kneeEnd, steepness) < slope) {
        high = steepness;
      } else {
        low = steepness;
      }
      steepness = Math.sqrt(low * high);
    }
  }
  const kneeEndOutDb =
    knee > 0 ? toDb(kneeCurve(kneeEnd, steepness)) : thresholdDb;

  const saturateDb = (inputDb: number) => {
    const x = toLinear(inputDb);
    if (x < kneeStart) {
      return inputDb;
    }
    if (knee > 0 && x < kneeEnd) {
      return toDb(kneeCurve(x, steepness));
    }
    return kneeEndOutDb + slope * (inputDb - kneeEndDb);
  };
  const makeupDb = -saturateDb(0) * MAKEUP_EXPONENT;
  return (inputDb) => saturateDb(inputDb) + makeupDb;
}
