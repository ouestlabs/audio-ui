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

/** Shapes one hit: `tune` in semitones from the voice's own pitch, `decay` in seconds. */
export interface DrumOptions {
  decay?: number;
  tune?: number;
}

const ratio = (tune = 0) => 2 ** (tune / 12);

function createNoiseBuffer(
  ctx: BaseAudioContext,
  duration: number
): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const noise = Float32Array.from({ length }, () => Math.random() * 2 - 1);
  buffer.copyToChannel(noise, 0);
  return buffer;
}

/** Sine oscillator with a fast pitch sweep (150Hz→40Hz) and exponential amplitude decay, a classic 808-style kick. */
export function triggerKick(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { decay = KICK_AMP_DECAY, tune }: DrumOptions = {}
): void {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(KICK_START_FREQ * ratio(tune), time);
  oscillator.frequency.exponentialRampToValueAtTime(
    KICK_END_FREQ * ratio(tune),
    time + Math.min(KICK_PITCH_DECAY, decay)
  );

  gainNode.gain.setValueAtTime(1, time);
  gainNode.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + decay);

  oscillator.connect(gainNode);
  gainNode.connect(destination);

  oscillator.start(time);
  oscillator.stop(time + decay);
}

/** Band-passed noise burst for body plus a short triangle "click" for attack transient. */
export function triggerSnare(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { decay = SNARE_NOISE_DECAY, tune }: DrumOptions = {}
): void {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(
    ctx,
    Math.max(SNARE_NOISE_DURATION, decay)
  );

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = SNARE_NOISE_FREQ * ratio(tune);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1, time);
  noiseGain.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + decay);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(destination);

  const oscillator = ctx.createOscillator();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(SNARE_TONE_FREQ * ratio(tune), time);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.7, time);
  oscGain.gain.exponentialRampToValueAtTime(
    SILENCE_FLOOR,
    time + SNARE_TONE_DECAY
  );

  oscillator.connect(oscGain);
  oscGain.connect(destination);

  noiseSource.start(time);
  noiseSource.stop(time + decay);
  oscillator.start(time);
  oscillator.stop(time + SNARE_TONE_DECAY);
}

/** High-passed noise burst, a closed-hihat-style tick by default; a longer `decay`, such as 0.5 seconds, rings like an open hihat. */
export function triggerHihat(
  ctx: BaseAudioContext,
  destination: AudioNode,
  time: number,
  { decay = HIHAT_DECAY, tune }: DrumOptions = {}
): void {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(
    ctx,
    Math.max(HIHAT_NOISE_DURATION, decay)
  );

  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = HIHAT_HIGHPASS_FREQ * ratio(tune);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.6, time);
  gainNode.gain.exponentialRampToValueAtTime(SILENCE_FLOOR, time + decay);

  noiseSource.connect(highpass);
  highpass.connect(gainNode);
  gainNode.connect(destination);

  noiseSource.start(time);
  noiseSource.stop(time + decay);
}
