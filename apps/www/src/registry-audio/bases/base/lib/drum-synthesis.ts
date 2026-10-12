const KICK_START_FREQ = 150;
const KICK_END_FREQ = 40;
const KICK_PITCH_DECAY = 0.15;
const KICK_AMP_DECAY = 0.2;

const SNARE_NOISE_DURATION = 0.2;
const SNARE_NOISE_FREQ = 1800;
const SNARE_NOISE_DECAY = 0.15;
const SNARE_TONE_FREQ = 180;
const SNARE_TONE_DECAY = 0.05;

const HIHAT_NOISE_DURATION = 0.05;
const HIHAT_HIGHPASS_FREQ = 7000;
const HIHAT_DECAY = 0.05;

const SILENCE_FLOOR = 0.001;

function createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const noise = Float32Array.from({ length }, () => Math.random() * 2 - 1);
  buffer.copyToChannel(noise, 0);
  return buffer;
}

/** Sine oscillator with a fast pitch sweep (150Hz→40Hz) and exponential amplitude decay, a classic 808-style kick. */
export function triggerKick(
  ctx: AudioContext,
  destination: AudioNode,
  time: number
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(KICK_START_FREQ, time);
  oscillator.frequency.exponentialRampToValueAtTime(
    KICK_END_FREQ,
    time + KICK_PITCH_DECAY
  );

  gainNode.gain.setValueAtTime(1, time);
  gainNode.gain.exponentialRampToValueAtTime(
    SILENCE_FLOOR,
    time + KICK_AMP_DECAY
  );

  oscillator.connect(gainNode);
  gainNode.connect(destination);

  oscillator.start(time);
  oscillator.stop(time + KICK_AMP_DECAY);
}

/** Band-passed noise burst for body plus a short triangle "click" for attack transient. */
export function triggerSnare(
  ctx: AudioContext,
  destination: AudioNode,
  time: number
): void {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx, SNARE_NOISE_DURATION);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = SNARE_NOISE_FREQ;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1, time);
  noiseGain.gain.exponentialRampToValueAtTime(
    SILENCE_FLOOR,
    time + SNARE_NOISE_DECAY
  );

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(destination);

  const oscillator = ctx.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(SNARE_TONE_FREQ, time);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.7, time);
  oscGain.gain.exponentialRampToValueAtTime(
    SILENCE_FLOOR,
    time + SNARE_TONE_DECAY
  );

  oscillator.connect(oscGain);
  oscGain.connect(destination);

  noiseSource.start(time);
  noiseSource.stop(time + SNARE_NOISE_DECAY);
  oscillator.start(time);
  oscillator.stop(time + SNARE_TONE_DECAY);
}

/** High-passed noise burst, very short, a closed-hihat-style tick. */
export function triggerHihat(
  ctx: AudioContext,
  destination: AudioNode,
  time: number
): void {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx, HIHAT_NOISE_DURATION);

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = HIHAT_HIGHPASS_FREQ;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.6, time);
  gainNode.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + HIHAT_DECAY);

  noiseSource.connect(highpass);
  highpass.connect(gainNode);
  gainNode.connect(destination);

  noiseSource.start(time);
  noiseSource.stop(time + HIHAT_DECAY);
}
