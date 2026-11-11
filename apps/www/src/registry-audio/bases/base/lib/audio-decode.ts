/**
 * Decoding an audio file into samples at a context's rate: the Web Audio step
 * before the waveform maths of `@audio-ui/core/analysis` (`computePeaks`,
 * `downsampleWaveform`). The browser's own decoder reads the file first; an
 * AIFF, a CAF or an Apple Lossless file it refuses, as Chrome does, goes
 * through a decoder of its format, then `@audio/resample-sinc` to the
 * context's rate, each loaded the first time a file needs it. Both take the
 * caller's context rather than making one: decoding is the caller's concern.
 */

/** The decoder of a format a browser may refuse, told by the file's first bytes: AIFF ("FORM"), CAF ("caff"), or MP4 for Apple Lossless ("ftyp" at byte 4). `null` for any other. */
function decoderFor(bytes: Uint8Array) {
  const tag = (at: number) =>
    String.fromCharCode(...bytes.subarray(at, at + 4));
  if (tag(0) === "FORM") {
    return import("@audio/decode-aiff");
  }
  if (tag(0) === "caff") {
    return import("@audio/decode-caf");
  }
  if (tag(4) === "ftyp") {
    return import("@audio/decode-mp4");
  }
  return null;
}

/** Decodes raw audio bytes, such as `file.arrayBuffer()`, into every channel's PCM samples at the context's sample rate, ready for `computePeaks`. Bytes that no decoder reads as sound reject with the browser's own error. `decodeAudioData` can detach the buffer it's given in some browsers, hence the defensive copy. */
export async function decodeAudioChannels(
  context: BaseAudioContext,
  buffer: ArrayBuffer
): Promise<Float32Array[]> {
  try {
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    return Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) =>
      audioBuffer.getChannelData(channel)
    );
  } catch (refused) {
    const bytes = new Uint8Array(buffer);
    const decoder = decoderFor(bytes);
    if (!decoder) {
      throw refused;
    }
    const [{ default: decode }, { default: resample }] = await Promise.all([
      decoder,
      import("@audio/resample-sinc"),
    ]);
    const decoded = await Promise.resolve()
      .then(() => decode(bytes))
      .catch(() => {
        throw refused;
      });
    if (decoded.channelData.length === 0) {
      throw refused;
    }
    const to = context.sampleRate;
    return decoded.sampleRate === to
      ? decoded.channelData
      : decoded.channelData.map((channel) =>
          resample(channel, { from: decoded.sampleRate, to })
        );
  }
}

/** Decodes raw audio bytes into one channel's PCM samples, ready for `downsampleWaveform`: `decodeAudioChannels`, then the channel asked for, or the last there is. */
export async function decodeAudioSamples(
  context: BaseAudioContext,
  buffer: ArrayBuffer,
  channel = 0
): Promise<Float32Array> {
  const channels = await decodeAudioChannels(context, buffer);
  return channels[Math.min(channel, channels.length - 1)] as Float32Array;
}
