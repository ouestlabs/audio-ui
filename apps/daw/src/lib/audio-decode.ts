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