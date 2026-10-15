/**
 * Decoding an audio file into samples: the Web Audio step before the waveform
 * maths of `@audio-ui/core/analysis` (`computePeaks`, `downsampleWaveform`).
 * Both take the caller's context rather than making one: decoding is the
 * caller's concern.
 */

/** Decodes raw audio bytes (e.g. from `file.arrayBuffer()`) into one channel's PCM samples, ready for `downsampleWaveform`. Takes an existing `AudioContext`/`OfflineAudioContext` rather than creating its own, decoding is the caller's concern, this is just the audio-specific step. `decodeAudioData` can detach the buffer it's given in some browsers, hence the defensive copy. */
export async function decodeAudioSamples(
  context: BaseAudioContext,
  buffer: ArrayBuffer,
  channel = 0
): Promise<Float32Array> {
  const audioBuffer = await context.decodeAudioData(buffer.slice(0));
  const channelIndex = Math.min(channel, audioBuffer.numberOfChannels - 1);
  return audioBuffer.getChannelData(channelIndex);
}

/** Decodes raw audio bytes into every channel's PCM samples, ready for `computePeaks`. Like `decodeAudioSamples`, it takes the caller's context and decodes a copy of the bytes. */
export async function decodeAudioChannels(
  context: BaseAudioContext,
  buffer: ArrayBuffer
): Promise<Float32Array[]> {
  const audioBuffer = await context.decodeAudioData(buffer.slice(0));
  return Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) =>
    audioBuffer.getChannelData(channel)
  );
}
