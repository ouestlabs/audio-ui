/**
 * A recording's samples as the clip view reads them for its closest zooms
 * (CLP-024): the middle of its channels, (L + R) / 2 for a stereo one, or each
 * channel alone for a waveform drawn a row a channel, a frame at a time, read
 * from memory or, for a streamed recording, from its cache file, only the
 * frames the view asks for. A streamed recording also gives its leaves, what
 * its waveform is drawn from zoomed out on the GPU: read from beside its cache
 * file, or made from it once and written there, and its spectra, what its
 * spectrogram is drawn from zoomed out: kept beside it the same way, made once
 * in a worker.
 */
import {
  type Bands,
  createBandSplit,
  SPECTRA_SIZE,
  type Spectra,
  spectrogramSpectra,
  splitBands,
} from "@audio-ui/engine/analysis";
import {
  LEAF_FRAMES,
  type WaveformBands,
  waveformLeaves,
} from "@audio-ui/gl/waveform";
import type { ClipSamples } from "@/components/audio-ui/clip-waveform";
import type { RecordingSource, StreamedSource } from "@/lib/clip-player";

const BYTES = Float32Array.BYTES_PER_ELEMENT;

/** A file name's extension. */
const EXTENSION = /\.[^.]+$/;

/** The frames leaves are made of at a time: whole leaves, with a frame of the page between each. */
const LEAF_STEP = 1 << 20;

/** The middle of `channels`, their first `frames` frames. */
function middle(channels: readonly ArrayLike<number>[], frames: number) {
  const mixed = new Float32Array(frames);
  const share = 1 / Math.max(1, channels.length);
  for (const channel of channels) {
    for (let frame = 0; frame < frames; frame += 1) {
      mixed[frame] = (mixed[frame] ?? 0) + (channel[frame] ?? 0) * share;
    }
  }
  return mixed;
}

/** The folder a file of the private storage lies in, from its path: each folder inside the one before. */
export const folderOf = (path: readonly string[]) =>
  path
    .slice(0, -1)
    .reduce<Promise<FileSystemDirectoryHandle>>(
      async (parent, step) => (await parent).getDirectoryHandle(step),
      navigator.storage.getDirectory()
    );

/** Each streamed recording's cache file, opened once and kept: it is never written again. */
const opened = new WeakMap<StreamedSource, Promise<File>>();

export function cacheFile(source: StreamedSource): Promise<File> {
  const kept = opened.get(source);
  if (kept) {
    return kept;
  }
  const file = (async () =>
    (
      await (
        await folderOf(source.path)
      ).getFileHandle(source.path.at(-1) ?? "")
    ).getFile())();
  opened.set(source, file);
  file.catch(() => opened.delete(source));
  return file;
}

/** Frames `from` to `to` of one channel of a streamed recording: its channels lie one after the other, `length` frames each. */
async function readChannel(
  source: StreamedSource,
  channel: number,
  from: number,
  to: number
): Promise<Float32Array<ArrayBuffer>> {
  const file = await cacheFile(source);
  const at = (channel * source.length + from) * BYTES;
  const bytes = await file
    .slice(at, at + Math.max(0, to - from) * BYTES)
    .arrayBuffer();
  return new Float32Array(bytes);
}

/** Frames `from` to `to` of a streamed recording, the middle of its channels. */
export async function readMix(
  source: StreamedSource,
  from: number,
  to: number
): Promise<Float32Array> {
  return middle(
    await Promise.all(
      Array.from({ length: source.channels }, (_, channel) =>
        readChannel(source, channel, from, to)
      )
    ),
    Math.max(0, to - from)
  );
}

/** A streamed recording's spectra, made from its cache file: in a worker, so the page goes on; here when there is none. */
export function makeSpectra(source: StreamedSource): Promise<Spectra> {
  const here = () =>
    spectrogramSpectra({
      frames: source.length,
      read: (from, to) => readMix(source, from, to),
    });
  if (typeof Worker === "undefined") {
    return here();
  }
  return new Promise<Spectra>((resolve) => {
    const worker = new Worker(new URL("./spectra-worker.ts", import.meta.url), {
      type: "module",
    });
    const done = (spectra: Promise<Spectra> | Spectra) => {
      worker.terminate();
      resolve(spectra);
    };
    worker.onmessage = (event: MessageEvent<Spectra>) => done(event.data);
    worker.onerror = () => done(here());
    worker.postMessage(source);
  });
}

/** Each streamed recording's spectra, read or made once. */
const spectraMade = new WeakMap<StreamedSource, Promise<Spectra>>();

/** A streamed recording's spectra: read from beside its cache file, `<id>.spectra`, or made from it and written there. */
function spectraOf(source: StreamedSource): Promise<Spectra> {
  const kept = spectraMade.get(source);
  if (kept) {
    return kept;
  }
  const made = (async () => {
    const folder = await folderOf(source.path);
    const name = (source.path.at(-1) ?? "").replace(EXTENSION, ".spectra");
    const size =
      Math.ceil(source.length / SPECTRA_SIZE) * (SPECTRA_SIZE / 2 + 1);
    const stored = await folder
      .getFileHandle(name)
      .then((handle) => handle.getFile())
      .catch(() => null);
    if (stored && stored.size === size) {
      return {
        hop: SPECTRA_SIZE,
        levels: new Uint8Array(await stored.arrayBuffer()),
        size: SPECTRA_SIZE,
      };
    }
    const spectra = await makeSpectra(source);
    await folder
      .getFileHandle(name, { create: true })
      .then(async (handle) => {
        const writable = await handle.createWritable();
        await writable.write(spectra.levels as Uint8Array<ArrayBuffer>);
        await writable.close();
      })
      .catch(() => undefined);
    return spectra;
  })();
  spectraMade.set(source, made);
  made.catch(() => spectraMade.delete(source));
  return made;
}

/** The bands of a sound, low to high, in the order their leaves are kept. */
const BANDS = ["low", "mid", "high"] as const;

/** How many sets of leaves a recording of `channels` keeps: its mix's, each channel's for one of several, then its three bands'. */
export const setsOf = (channels: number) =>
  (channels > 1 ? channels + 1 : 1) + BANDS.length;

/** Which set of a recording's leaves is a band's. */
const bandSet = (channels: number, band: (typeof BANDS)[number]) =>
  setsOf(channels) - BANDS.length + BANDS.indexOf(band);

/**
 * A recording's leaves (`waveformLeaves`), one set after the other: its mix's,
 * each channel's for one of several, then those of its three bands
 * (`createBandSplit`, carried from stretch to stretch). Made `LEAF_STEP`
 * frames at a time from `read`, which gives every channel's frames between two
 * frames, with a frame of the page between each.
 */
export async function makeLeaves(
  channels: number,
  length: number,
  sampleRate: number,
  read: (
    from: number,
    to: number
  ) => readonly ArrayLike<number>[] | Promise<readonly ArrayLike<number>[]>
): Promise<Float32Array<ArrayBuffer>> {
  const size = Math.ceil(length / LEAF_FRAMES) * 4;
  const out = new Float32Array(size * setsOf(channels));
  const split = createBandSplit(sampleRate);
  const step = async (from: number): Promise<void> => {
    if (from >= length) {
      return;
    }
    const to = Math.min(length, from + LEAF_STEP);
    const parts = await read(from, to);
    const at = (from / LEAF_FRAMES) * 4;
    const mix = middle(parts, to - from);
    out.set(waveformLeaves(mix), at);
    if (channels > 1) {
      for (const [index, part] of parts.entries()) {
        out.set(waveformLeaves(part), size * (index + 1) + at);
      }
    }
    const bands = split(mix);
    for (const band of BANDS) {
      out.set(waveformLeaves(bands[band]), size * bandSet(channels, band) + at);
    }
    await new Promise((resolve) => setTimeout(resolve));
    await step(to);
  };
  await step(0);
  return out;
}

/** The name of the file a streamed recording's leaves are kept in, beside its samples: `<id>.leaves`. */
export const leavesName = (samplesName: string) =>
  samplesName.replace(EXTENSION, ".leaves");

/** Each streamed recording's leaves, read or made once. */
const leavesMade = new WeakMap<StreamedSource, Promise<Float32Array[]>>();

/** A streamed recording's leaves, its mix's and then each channel's: read from beside its cache file, or made from it and written there. */
function leavesOf(source: StreamedSource): Promise<Float32Array[]> {
  const kept = leavesMade.get(source);
  if (kept) {
    return kept;
  }
  const made = (async () => {
    const folder = await folderOf(source.path);
    const name = leavesName(source.path.at(-1) ?? "");
    const size = Math.ceil(source.length / LEAF_FRAMES) * 4;
    const sets = setsOf(source.channels);
    const stored = await folder
      .getFileHandle(name)
      .then((handle) => handle.getFile())
      .catch(() => null);
    let leaves =
      stored && stored.size === size * sets * BYTES
        ? new Float32Array(await stored.arrayBuffer())
        : null;
    if (!leaves) {
      // A cache made before its leaves, or its bands' leaves, were: made once from its samples, and kept beside them.
      leaves = await makeLeaves(
        source.channels,
        source.length,
        source.sampleRate,
        (from, to) =>
          Promise.all(
            Array.from({ length: source.channels }, (_, channel) =>
              readChannel(source, channel, from, to)
            )
          )
      );
      const written = leaves;
      await folder
        .getFileHandle(name, { create: true })
        .then(async (handle) => {
          const writable = await handle.createWritable();
          await writable.write(written);
          await writable.close();
        })
        .catch(() => undefined);
    }
    const all = leaves;
    return Array.from({ length: sets }, (_, set) =>
      all.subarray(set * size, (set + 1) * size)
    );
  })();
  leavesMade.set(source, made);
  made.catch(() => leavesMade.delete(source));
  return made;
}

/** A recording held in memory, its channels. */
const channelsIn = (source: Exclude<RecordingSource, StreamedSource>) =>
  "getChannelData" in source
    ? Array.from({ length: source.numberOfChannels }, (_, channel) =>
        source.getChannelData(channel)
      )
    : source.channels;

/** The memory under `channels`, each piece once: what can be handed over without a copy. */
export const transferable = (channels: readonly Float32Array[]) => [
  ...new Set(
    channels
      .map((channel) => channel.buffer)
      .filter((buffer) => buffer instanceof ArrayBuffer)
  ),
];

/** Frames `from` to `to` of each channel of a recording, copied: read from its cache file for a streamed one. */
export function readChannels(
  source: RecordingSource,
  from: number,
  to: number
): Promise<Float32Array[]> {
  if ("path" in source) {
    return Promise.all(
      Array.from({ length: source.channels }, (_, channel) =>
        readChannel(source, channel, from, to)
      )
    );
  }
  return Promise.resolve(
    channelsIn(source).map((channel) => channel.slice(from, to))
  );
}

/** The readers made so far, one per source, so a view keeps the same one across renders. */
const made = new WeakMap<RecordingSource, ClipSamples>();

/** The samples of a recording, whichever way the engine holds it: the same reader for the same source. */
export function recordingSamples(source: RecordingSource): ClipSamples {
  const kept = made.get(source);
  if (kept) {
    return kept;
  }
  const samples = readerOf(source);
  made.set(source, samples);
  return samples;
}

function readerOf(source: RecordingSource): ClipSamples {
  if ("path" in source) {
    return {
      frames: source.length,
      leaves: async () => (await leavesOf(source))[0] ?? new Float32Array(0),
      read: (from, to) => readMix(source, from, to),
      spectra: () => spectraOf(source),
    };
  }
  const channels = channelsIn(source);
  return {
    frames: channels[0]?.length ?? 0,
    read: (from, to) =>
      middle(
        channels.map((channel) => channel.subarray(from, to)),
        Math.max(0, to - from)
      ),
  };
}

/** The channel readers made so far, one list per source. */
const madeChannels = new WeakMap<RecordingSource, readonly ClipSamples[]>();

/**
 * Each channel of a recording alone, a reader each, for a waveform drawn a row
 * a channel: the same readers for the same source. Undefined for a mono one.
 */
export function recordingChannels(
  source: RecordingSource
): readonly ClipSamples[] | undefined {
  const kept = madeChannels.get(source);
  if (kept) {
    return kept.length > 1 ? kept : undefined;
  }
  const readers: ClipSamples[] =
    "path" in source
      ? Array.from({ length: source.channels }, (_, channel) => ({
          frames: source.length,
          leaves: async () =>
            (await leavesOf(source))[channel + 1] ?? new Float32Array(0),
          read: (from, to) => readChannel(source, channel, from, to),
        }))
      : channelsIn(source).map((channel) => ({
          frames: channel.length,
          read: (from, to) => channel.subarray(from, to),
        }));
  madeChannels.set(source, readers);
  return readers.length > 1 ? readers : undefined;
}

/** The frames read before a band's stretch, through the crossover, so it has settled where the stretch begins: some 170 ms at 48 kHz. */
const PREROLL = 8192;

/** The bands of the stretches of streamed recordings read last, so a stretch is split once for its three rows. */
const bandReads = new WeakMap<StreamedSource, Map<string, Promise<Bands>>>();

/** Frames `from` to `to` of a streamed recording as its three bands, split with `PREROLL` frames before them. */
function readBands(
  source: StreamedSource,
  from: number,
  to: number
): Promise<Bands> {
  const reads = bandReads.get(source) ?? new Map<string, Promise<Bands>>();
  bandReads.set(source, reads);
  const key = `${from}:${to}`;
  const kept = reads.get(key);
  if (kept) {
    return kept;
  }
  const read = (async () => {
    const start = Math.max(0, from - PREROLL);
    const bands = createBandSplit(source.sampleRate)(
      await readMix(source, start, to)
    );
    const skip = from - start;
    return {
      high: bands.high.subarray(skip),
      low: bands.low.subarray(skip),
      mid: bands.mid.subarray(skip),
    };
  })();
  reads.set(key, read);
  read.catch(() => reads.delete(key));
  // A few stretches are kept: the rows read the same ones at once, then move on.
  const oldest = reads.keys().next().value;
  if (reads.size > 6 && oldest !== undefined) {
    reads.delete(oldest);
  }
  return read;
}

/** A streamed recording's three bands, a reader each with its leaves: they draw it by band without reading it whole. */
function streamedBands(source: StreamedSource): WaveformBands {
  const reader = (band: (typeof BANDS)[number]) => ({
    frames: source.length,
    leaves: async () =>
      (await leavesOf(source))[bandSet(source.channels, band)] ??
      new Float32Array(0),
    read: async (from: number, to: number) =>
      (await readBands(source, from, to))[band],
  });
  return { high: reader("high"), low: reader("low"), mid: reader("mid") };
}

/** The band splits made so far, one per source. */
const madeBands = new WeakMap<RecordingSource, () => WaveformBands>();

/**
 * A recording as its three bands, for the waveform by band. One held in
 * memory is split once, the first time it is asked for; a streamed one is
 * read as bands, its leaves kept with the others and its stretches split as
 * the view reads them.
 */
export function recordingBands(source: RecordingSource): () => WaveformBands {
  const kept = madeBands.get(source);
  if (kept) {
    return kept;
  }
  if ("path" in source) {
    const streamed = streamedBands(source);
    const bands = () => streamed;
    madeBands.set(source, bands);
    return bands;
  }
  let split: WaveformBands | null = null;
  const bands = () => {
    split ??= splitBands(
      channelsIn(source),
      "sampleRate" in source ? source.sampleRate : 48_000
    );
    return split;
  };
  madeBands.set(source, bands);
  return bands;
}

/** What an arranged clip reads of its recording, one per source, so a clip is not drawn again for nothing. */
const madeSources = new WeakMap<
  RecordingSource,
  {
    channels?: readonly ClipSamples[];
    sampleRate: number;
    samples: ClipSamples;
  }
>();

/** A recording as an arranged clip draws it on the GPU: its mix, its channels and its rate, the same for the same source. */
export function recordingSource(source: RecordingSource) {
  const kept = madeSources.get(source);
  if (kept) {
    return kept;
  }
  const read = {
    channels: recordingChannels(source),
    sampleRate: source.sampleRate,
    samples: recordingSamples(source),
  };
  madeSources.set(source, read);
  return read;
}
