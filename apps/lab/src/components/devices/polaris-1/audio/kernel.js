// The sound of Polaris-1: a drive. Plain JavaScript in the subset jz compiles
// (https://jz.js.org): `bun run wasm:build` turns this file into kernel.wasm,
// and the same file still runs as JavaScript. Only numbers cross the boundary,
// so a host calls the module with no glue: `set` once the values change, then
// `tick` for every sample of each channel.
//
// The gain pushes the sound into a soft clip (tanh), brought back to the same
// peak; a one-pole low-pass after it is the tone; the mix blends it with the
// dry sound.

/** Each channel's low-pass, left and right. */
const low = new Float64Array(2);
let gain = 1;
let norm = Math.tanh(1);
let pole = 0;
let wet = 1;

/** The parameters as the description states them, in its order, then the sample rate. */
export function set(drive, tone, mix, sampleRate) {
  gain = Math.exp(drive * (Math.LN10 / 20));
  norm = Math.tanh(gain);
  pole = Math.exp((-2 * Math.PI * tone) / sampleRate);
  wet = mix / 100;
}

/** One sample of a channel, 0 or 1, through the drive. */
export function tick(x, channel) {
  const shaped = Math.tanh(x * gain) / norm;
  low[channel] = (1 - pole) * shaped + pole * low[channel];
  return x + (low[channel] - x) * wet;
}
