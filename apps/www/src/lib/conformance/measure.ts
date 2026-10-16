/** Rendering and measuring helpers for the conformance checks: everything runs in an `OfflineAudioContext`, so a check hears exactly what the engine makes, with no clock and no speakers. */

export const SAMPLE_RATE = 48_000;

/** What the checks need of an engine: the shape every device engine has. */
export interface MeasuredEngine {
  dispose: () => void;
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Present on an engine that loads something asynchronously, such as a worklet. */
  readonly ready?: Promise<boolean>;
}

export type EngineFactory<State> = (
  ctx: BaseAudioContext,
  state: State
) => MeasuredEngine;

/** One channel of a signal, as a function of the sample index. */
export type Signal = (index: number, channel: number) => number;

export const sine =
  (hertz: number, amplitude = 1): Signal =>
  (index) =>
    amplitude * Math.sin((2 * Math.PI * hertz * index) / SAMPLE_RATE);

export const impulse =
  (at = 0): Signal =>
  (index) =>
    index === at ? 1 : 0;

export const toLinear = (db: number) => 10 ** (db / 20);
export const toDb = (linear: number) =>
  20 * Math.log10(Math.max(linear, 1e-12));

/** Plays `signal` through an engine for `seconds` and returns what comes out, one array per channel. */
export async function render<State>(
  create: EngineFactory<State>,
  state: State,
  signal: Signal,
  seconds: number,
  channels = 1
): Promise<Float32Array[]> {
  const length = Math.round(seconds * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(channels, length, SAMPLE_RATE);
  const buffer = ctx.createBuffer(channels, length, SAMPLE_RATE);
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] = signal(index, channel);
    }
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const engine = create(ctx, state);
  if (engine.ready) {
    await engine.ready;
  }
  source.connect(engine.input);
  engine.output.connect(ctx.destination);
  source.start();
  const rendered = await ctx.startRendering();
  engine.dispose();
  return Array.from({ length: channels }, (_, channel) =>
    rendered.getChannelData(channel)
  );
}

/** The highest absolute value in `data` between two times, in dB. */
export function peakDb(
  data: Float32Array,
  fromSeconds: number,
  toSeconds: number
) {
  let peak = 0;
  const end = Math.min(data.length, Math.round(toSeconds * SAMPLE_RATE));
  for (
    let index = Math.round(fromSeconds * SAMPLE_RATE);
    index < end;
    index += 1
  ) {
    peak = Math.max(peak, Math.abs(data[index] ?? 0));
  }
  return toDb(peak);
}

/** The gain of a filter at `hertz` read from its impulse response, in dB: the discrete Fourier transform at one frequency. */
export function magnitudeDb(response: Float32Array, hertz: number) {
  let real = 0;
  let imaginary = 0;
  const step = (2 * Math.PI * hertz) / SAMPLE_RATE;
  for (let index = 0; index < response.length; index += 1) {
    const value = response[index] ?? 0;
    real += value * Math.cos(step * index);
    imaginary -= value * Math.sin(step * index);
  }
  return toDb(Math.hypot(real, imaginary));
}

/** Where the highest sample of `data` is, in samples. */
export function peakIndex(data: Float32Array, from = 0) {
  let best = from;
  for (let index = from; index < data.length; index += 1) {
    if (Math.abs(data[index] ?? 0) > Math.abs(data[best] ?? 0)) {
      best = index;
    }
  }
  return best;
}

/**
 * The time a level takes to fall by 60 dB in an impulse response, by Schroeder's
 * backward integration (the method of ISO 3382): the energy left after each
 * instant, read from -5 dB to -35 dB and extended to -60 dB.
 */
export function reverberationTime(response: Float32Array) {
  const energy = new Float64Array(response.length);
  let sum = 0;
  for (let index = response.length - 1; index >= 0; index -= 1) {
    const value = response[index] ?? 0;
    sum += value * value;
    energy[index] = sum;
  }
  const total = energy[0] ?? 1;
  const at = (db: number) => {
    const wanted = total * 10 ** (db / 10);
    const index = energy.findIndex((value) => value <= wanted);
    return index < 0 ? response.length : index;
  };
  const from = at(-5);
  const to = at(-35);
  return (((to - from) / SAMPLE_RATE) * 60) / 30;
}
