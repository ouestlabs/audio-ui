import {
  lampCycle,
  speedHertz,
  sweepCents,
  VIBE_STAGES,
  type VibeState,
  vibeMix,
  volumeGain,
} from "@/registry-audio/bases/base/devices/vibe/device";

/** A stage's all-pass: a broad one, close to the single pole of the circuit. */
const STAGE_Q = 0.5;
const SMOOTHING = 0.03;
const HARMONICS = 48;

export interface VibeEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: VibeState) => void;
}

/** The lamp's light as an oscillator's wave, from -1 to 1, by its Fourier series. */
function lampWave(ctx: BaseAudioContext) {
  const light = lampCycle();
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const value of light) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let n = 1; n < HARMONICS; n += 1) {
    let cos = 0;
    let sin = 0;
    for (const [index, value] of light.entries()) {
      const centered = ((value - low) / (high - low)) * 2 - 1;
      const angle = (2 * Math.PI * n * index) / light.length;
      cos += centered * Math.cos(angle);
      sin += centered * Math.sin(angle);
    }
    real[n] = (2 * cos) / light.length;
    imag[n] = (2 * sin) / light.length;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

/** The preamp's warmth: a soft curve that rounds the peaks a little. */
function preampCurve() {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * 1.4) / Math.tanh(1.4);
  }
  return curve;
}

/**
 * A photocell vibe on the Web Audio API for a `VibeState`:
 *
 * ```
 * input → preamp → all-pass x4 (spread wide) → wet ─┐
 *               └──────────────────────────→ dry ──┼→ volume → output
 *       → bypass (when off) ───────────────────────┼──────────→ output
 *                 ↑ the lamp: cents on every stage │
 * ```
 *
 * The lamp is an oscillator of its own wave, which rises fast and falls back
 * slowly as a filament and its cells do; its depth is how far it moves the
 * stages. Chorus is half dry and half shifted, vibrato is shifted alone, and
 * off, the sound passes untouched. Every control moves with a ramp.
 */
export function createVibeEngine(
  ctx: BaseAudioContext,
  initial: VibeState
): VibeEngine {
  const smooth = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);

  const input = ctx.createGain();
  const preamp = ctx.createWaveShaper();
  preamp.curve = preampCurve();
  preamp.oversample = "2x";
  input.connect(preamp);

  const lamp = ctx.createOscillator();
  lamp.setPeriodicWave(lampWave(ctx));
  lamp.frequency.value = speedHertz(initial.speed);
  const depth = ctx.createGain();
  depth.gain.value = sweepCents(initial.intensity) / 2;
  lamp.connect(depth);

  // Four stages in a row, each one's centre set by its cell: half the sweep above the dark lamp's place, on average.
  const stages = VIBE_STAGES.map((hertz) => {
    const stage = ctx.createBiquadFilter();
    stage.type = "allpass";
    stage.Q.value = STAGE_Q;
    stage.frequency.value = hertz;
    stage.detune.value = sweepCents(initial.intensity) / 2;
    depth.connect(stage.detune);
    return stage;
  });
  stages.reduce<AudioNode>((from, stage) => from.connect(stage), preamp);

  const mix = vibeMix(initial);
  const wet = ctx.createGain();
  wet.gain.value = mix.wet;
  const dry = ctx.createGain();
  dry.gain.value = mix.dry;
  const bypass = ctx.createGain();
  bypass.gain.value = mix.bypass;
  const volume = ctx.createGain();
  volume.gain.value = volumeGain(initial.volume);
  const output = ctx.createGain();
  stages.at(-1)?.connect(wet).connect(volume);
  preamp.connect(dry).connect(volume);
  volume.connect(output);
  input.connect(bypass).connect(output);
  lamp.start();

  return {
    dispose: () => {
      lamp.stop();
      for (const node of [
        input,
        preamp,
        lamp,
        depth,
        ...stages,
        wet,
        dry,
        bypass,
        volume,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      const next = vibeMix(state);
      smooth(wet.gain, next.wet);
      smooth(dry.gain, next.dry);
      smooth(bypass.gain, next.bypass);
      smooth(volume.gain, volumeGain(state.volume));
      smooth(lamp.frequency, speedHertz(state.speed));
      smooth(depth.gain, sweepCents(state.intensity) / 2);
      for (const stage of stages) {
        smooth(stage.detune, sweepCents(state.intensity) / 2);
      }
    },
  };
}
