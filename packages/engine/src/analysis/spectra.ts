import { stftAnalyse } from "@audio/stft";

/**
 * A recording summed up as spectra, for a spectrogram drawn on the GPU that
 * does not hold the recording: a column every `hop` frames, each bin's level
 * from DC to Nyquist over windows of `size` frames, a byte each. This is the
 * form `gl-spectrogram` takes them in, and `LaneSamples.spectra` of
 * `@audio-ui/gl/lane`.
 */
export interface Spectra {
  hop: number;
  /** A byte a bin, `size / 2 + 1` a column, column after column: (dB + 150) · 1.6, 0 dB a full-scale sine on its bin, 0 silence. */
  levels: Uint8Array;
  size: number;
}

/** The frames of a window of the spectra, and of one of their columns: 2048, some 43 ms at 48 kHz, the window a spectrogram fits a view with. */
export const SPECTRA_SIZE = 2048;

/** A level as the spectra keep it: a byte, (dB + 150) · 1.6, 0 for silence. */
const LEVEL_SCALE = 1.6;
const LEVEL_FLOOR = 150;

/** The frames read at a time while the spectra are made: whole columns, with a frame of the page between each read. */
const SPECTRA_READ = 1 << 20;

/** A mean power, a full-scale sine on its bin being 1, as the byte the spectra keep. */
const levelByte = (power: number) =>
  power > 0
    ? Math.min(
        255,
        Math.max(
          0,
          Math.round((10 * Math.log10(power) + LEVEL_FLOOR) * LEVEL_SCALE)
        )
      )
    : 0;

/** A reader of a recording, mixed to one: how many frames it holds, and its frames from `from` to `to`, at once or later. */
export interface SpectraSource {
  frames: number;
  read: (
    from: number,
    to: number
  ) => ArrayLike<number> | Promise<ArrayLike<number>>;
}

/**
 * The spectra of a recording (`Spectra`): a column every `hop` frames, each
 * bin's power over the Hann windows of `size` frames centred in the column
 * every `size / 2` frames (the short-time transform of `@audio/stft`), their
 * mean, as a byte. Silence lies before and after the recording. Read from
 * `source` a stretch at a time, with a frame of the page between each, so it
 * can run on the page or, for a long recording, in a worker; made once, as the
 * recording is written, and kept beside it. `size` is a power of two and
 * `hop` a multiple of `size / 2`.
 */
export async function spectrogramSpectra(
  source: SpectraSource,
  {
    hop = SPECTRA_SIZE,
    size = SPECTRA_SIZE,
  }: { hop?: number; size?: number } = {}
): Promise<Spectra> {
  const bins = size / 2 + 1;
  const half = size / 2;
  const columns = Math.ceil(source.frames / hop);
  const levels = new Uint8Array(columns * bins);
  const windows = Math.max(1, hop / half);
  // A full-scale sine on its bin: |X| is a quarter of the window, squared.
  const full = windows * (size / 4) ** 2;
  const each = Math.max(1, Math.floor(SPECTRA_READ / hop));
  // The power of the columns of one read, summed over their windows.
  const power = new Float64Array(each * bins);
  const readFrom = async (first: number): Promise<void> => {
    if (first >= columns) {
      return;
    }
    const last = Math.min(columns, first + each);
    // The first window of a column starts a quarter of a window before it, the windows half a window apart.
    const from = first * hop - half / 2;
    const to = last * hop + half / 2;
    // What lies inside the recording is read; before and after it is silence.
    const start = Math.max(0, from);
    const end = Math.min(source.frames, to);
    const read = await source.read(start, end);
    const frames = new Float32Array(to - from);
    power.fill(0);
    for (let at = start; at < end; at += 1) {
      frames[at - from] = (read[at - start] as number | undefined) ?? 0;
    }
    stftAnalyse(
      frames,
      (magnitude, _phase, position) => {
        const column = Math.floor((from + position + half) / hop);
        if (column < first || column >= last) {
          return;
        }
        for (let bin = 0; bin < bins; bin += 1) {
          const at = (column - first) * bins + bin;
          power[at] = (power[at] as number) + (magnitude[bin] as number) ** 2;
        }
      },
      { frameSize: size, hopSize: half }
    );
    for (let at = 0; at < (last - first) * bins; at += 1) {
      levels[first * bins + at] = levelByte((power[at] as number) / full);
    }
    await new Promise((resolve) => setTimeout(resolve));
    await readFrom(last);
  };
  await readFrom(0);
  return { hop, levels, size };
}
