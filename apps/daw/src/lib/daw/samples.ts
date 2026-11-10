/**
 * A recording's samples as the clip view reads them for its closest zooms
 * (CLP-024): the middle of its channels, (L + R) / 2 for a stereo one, a
 * frame at a time, read from memory or, for a streamed recording, from its
 * cache file, only the frames the view asks for.
 */
import type { ClipSamples } from "@/components/audio-ui/clip-waveform";
import type { RecordingSource, StreamedSource } from "@/lib/clip-player";

const BYTES = Float32Array.BYTES_PER_ELEMENT;

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

/** A streamed recording's cache file, opened once and kept: it is never written again. */
function cacheFile(source: StreamedSource): () => Promise<File> {
  let file: Promise<File> | null = null;
  return () => {
    file ??= (async () => {
      const folders = source.path.slice(0, -1);
      const name = source.path.at(-1) ?? "";
      // Each folder lies inside the one before.
      const folder = await folders.reduce(
        async (parent, step) => (await parent).getDirectoryHandle(step),
        navigator.storage.getDirectory()
      );
      return (await folder.getFileHandle(name)).getFile();
    })();
    return file;
  };
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
    const open = cacheFile(source);
    return {
      frames: source.length,
      read: async (from, to) => {
        const file = await open();
        const frames = Math.max(0, to - from);
        // Its channels lie one after the other, `length` frames each.
        const channels = await Promise.all(
          Array.from({ length: source.channels }, async (_, channel) => {
            const at = (channel * source.length + from) * BYTES;
            const bytes = await file
              .slice(at, at + frames * BYTES)
              .arrayBuffer();
            return new Float32Array(bytes);
          })
        );
        return middle(channels, frames);
      },
    };
  }
  const channels =
    "getChannelData" in source
      ? Array.from({ length: source.numberOfChannels }, (_, channel) =>
          source.getChannelData(channel)
        )
      : source.channels;
  return {
    frames: channels[0]?.length ?? 0,
    read: (from, to) =>
      middle(
        channels.map((channel) => channel.subarray(from, to)),
        Math.max(0, to - from)
      ),
  };
}
