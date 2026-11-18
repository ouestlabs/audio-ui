/**
 * The transfer curve of a compressor: the output level in dB for each input
 * level in dB, the textbook curve with a knee centred on the threshold, what
 * a plug-in draws.
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
