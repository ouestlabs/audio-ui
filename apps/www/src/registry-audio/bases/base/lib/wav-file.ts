/** How many bits each sample of a WAV file takes: 16 plays anywhere, 24 keeps more headroom in a larger file. */
export type WavBitDepth = 16 | 24;

export interface WavOptions {
  /** @default 16 */
  bitDepth?: WavBitDepth;
  /** Scales the sound so its loudest sample sits at full scale. It changes the level of the whole file. @default false */
  normalize?: boolean;
}

/** The bytes before the samples: the RIFF header, the format chunk and the head of the data chunk. */
const HEADER_BYTES = 44;

/**
 * Encodes channels of samples, from -1 to 1, as a WAV file of PCM: what an
 * `OfflineAudioContext` renders, through `downloadWavFile`. A sample past full
 * scale is clipped to it, and the channels are interleaved, as WAV wants.
 */
export function encodeWav(
  channels: readonly Float32Array[],
  sampleRate: number,
  { bitDepth = 16, normalize = false }: WavOptions = {}
): Uint8Array {
  const frames = Math.max(0, ...channels.map((channel) => channel.length));
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels.length * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const bytes = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => {
    for (const [index, char] of [...value].entries()) {
      view.setUint8(at + index, char.charCodeAt(0));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, HEADER_BYTES - 8 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  // Format 1, PCM, at a whole number of bytes per sample.
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);

  let loudest = 0;
  if (normalize) {
    for (const channel of channels) {
      for (const sample of channel) {
        loudest = Math.max(loudest, Math.abs(sample));
      }
    }
  }
  const gain = normalize && loudest > 0 ? 1 / loudest : 1;
  const full = 2 ** (bitDepth - 1);
  let offset = HEADER_BYTES;
  for (let frame = 0; frame < frames; frame += 1) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, (channel[frame] ?? 0) * gain));
      // Full scale is one step short of the top on the positive side, where the range has one value fewer.
      const value = Math.round(
        sample < 0 ? sample * full : sample * (full - 1)
      );
      if (bitDepth === 16) {
        view.setInt16(offset, value, true);
      } else {
        view.setUint8(offset, value & 0xff);
        view.setUint8(offset + 1, (value >> 8) & 0xff);
        view.setUint8(offset + 2, (value >> 16) & 0xff);
      }
      offset += bytesPerSample;
    }
  }
  return bytes;
}

/** Saves rendered sound as a `.wav` file, named `filename`. */
export function downloadWavFile(
  audio: AudioBuffer,
  {
    filename = "audio.wav",
    ...options
  }: WavOptions & { filename?: string } = {}
) {
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index)
  );
  const bytes = encodeWav(channels, audio.sampleRate, options);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Let go of it once the browser has read it: revoked in the same task, the download can be cancelled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
