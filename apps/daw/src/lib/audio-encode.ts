export type AudioFileFormat = "flac" | "mp3" | "wav";

export interface EncodeAudioOptions {
  /** Bits a sample, for WAV and FLAC: 16 or 24, or 32 for a WAV of floats, which keeps what goes past full scale. @default 16 */
  bitDepth?: 16 | 24 | 32;
  /** An MP3's bitrate, in kbps. @default 128 */
  bitrate?: number;
  format: AudioFileFormat;
  /** How far the encoding is, from 0 to 1, after each chunk. */
  onProgress?: (done: number) => void;
  /** The channels' sample rate. An MP3 comes out at the nearest rate MP3 has: 48 kHz for 96 kHz. */
  sampleRate: number;
}

/** How much is encoded between two paints, in seconds of sound: an MP3 encodes about 45 times faster than it plays, so the page stops answering for some 45 ms at a time. */
const CHUNK_SECONDS = 2;

/**
 * Encodes channels of samples, from -1 to 1, as a file. A sample past full
 * scale is clipped to it, except in a WAV of 32-bit floats. The work goes in
 * chunks with a paint between two, so a long file never freezes the page.
 */
export async function encodeAudio(
  channels: readonly Float32Array[],
  { format, onProgress, ...options }: EncodeAudioOptions
): Promise<Blob> {
  const { default: encode } = await import("@audio/encode");
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

/** Saves a file through the browser's downloads, named `name`. */
export function downloadFile(file: Blob, name: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = name;
  link.click();
  // Let go of it once the browser has read it: revoked in the same task, the download can be cancelled.
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}