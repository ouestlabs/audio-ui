/**
 * Writing sound to a file, through `@audio/encode`: the export (EXP-003), a
 * recorded take, a consolidated stretch. The page loads each format's encoder
 * (WebAssembly for FLAC and MP3) the first time it is asked for, and the
 * server's build leaves them all out.
 */
import encode, { type EncodeOptions } from "@audio/encode";
import { createClientOnlyFn } from "@tanstack/react-start";

/** The formats the arrangement exports to. */
export type ExportFormat = "flac" | "mp3" | "wav";

/** What an export writes: WAV and FLAC at 24 bits, MP3 at 320 kbps. */
export const EXPORT_OPTIONS: Record<ExportFormat, Partial<EncodeOptions>> = {
  flac: { bitDepth: 24 },
  mp3: { bitrate: 320 },
  wav: { bitDepth: 24 },
};

/** How much is encoded between two paints, in seconds of sound: an MP3 encodes about 45 times faster than it plays, so the page stops answering for some 45 ms at a time. */
const CHUNK_SECONDS = 2;

/**
 * Encodes channels as a file of `format`, with `options` (the channels' own
 * `sampleRate`: an MP3 encoder takes the nearest rate MP3 has, 48 kHz for 96
 * kHz). It goes in chunks with a paint between two, saying how far it is
 * through `onProgress`, from 0 to 1. In the browser only.
 */
export const encodeAudio = createClientOnlyFn(
  async (
    channels: readonly Float32Array[],
    format: ExportFormat,
    options: EncodeOptions,
    onProgress?: (done: number) => void
  ): Promise<Blob> => {
    const encoder = await encode[format]({
      ...options,
      channels: channels.length,
    });
    const frames = channels[0]?.length ?? 0;
    const step = CHUNK_SECONDS * options.sampleRate;
    const starts = Array.from(
      { length: Math.ceil(frames / step) },
      (_, index) => index * step
    );
    // One chunk after the other, each once the page has painted since the last.
    const parts = await starts.reduce<Promise<BlobPart[]>>(
      async (encoded, from) => {
        const done = await encoded;
        const chunk = channels.map((channel) =>
          channel.subarray(from, from + step)
        );
        done.push((await encoder(chunk)) as Uint8Array<ArrayBuffer>);
        onProgress?.(Math.min(1, (from + step) / frames));
        await new Promise((resolve) => setTimeout(resolve));
        return done;
      },
      Promise.resolve([])
    );
    parts.push((await encoder()) as Uint8Array<ArrayBuffer>);
    const file = new Blob(parts, { type: encode.mime[format] });
    // The header with what is only known at the end (the length, a checksum), written over the start.
    const head = encoder.head() as Uint8Array<ArrayBuffer> | null;
    return head
      ? new Blob([head, file.slice(head.length)], { type: file.type })
      : file;
  }
);

/** Saves a file through the browser's downloads, named `name`. */
export function downloadFile(file: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  // Let go of it once the browser has read it: revoked in the same task, the download can be cancelled.
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
