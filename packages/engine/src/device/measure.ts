/**
 * Measure an engine against what its device claims. Everything runs in an
 * `OfflineAudioContext`, so a measurement hears exactly what the engine makes,
 * with no clock and no speakers; the measuring itself is audio.js's
 * (`@audio/measure-response`, `@audio/measure-latency`).
 *
 * It is made for the host that brings its own engine: give `measureResponse`
 * your engine's factory, a state and the curve of the device (such as
 * `equalizerCurve(state)`), and it says how far what your engine does is from
 * what the panel draws. A measurement, not a certification: the curve is the
 * device's own, and the tolerance is yours to choose.
 */

import latency from "@audio/measure-latency";
import response from "@audio/measure-response";
import type { EffectEngine, EngineFactory } from "./engine.ts";

const SAMPLE_RATE = 48_000;
/** How long an impulse response is listened to for a frequency response, and for a latency, in seconds. */
const RESPONSE_SECONDS = 0.5;
const LATENCY_SECONDS = 0.3;
const RESPONSE_FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 12_000, 16_000,
];
/** A level under this is below what a 24-bit signal can show, so it is not compared. */
const AUDIBLE_FLOOR_DB = -50;

/** What a measurement needs of an engine: an effect's input and output, and what it loads. */
type MeasuredEngine = Pick<
  EffectEngine<unknown>,
  "dispose" | "input" | "output" | "ready"
>;

/** A unit impulse `seconds` long, at the measuring rate. */
const impulseOf = (seconds: number) => {
  const signal = new Float32Array(Math.round(seconds * SAMPLE_RATE));
  signal[0] = 1;
  return signal;
};

/** What comes out of an engine for `signal`, once what it loads is in: its impulse response for an impulse. */
async function renderThrough<State>(
  create: EngineFactory<State, MeasuredEngine>,
  state: State,
  signal: Float32Array
): Promise<Float32Array> {
  const ctx = new OfflineAudioContext(1, signal.length, SAMPLE_RATE);
  const buffer = ctx.createBuffer(1, signal.length, SAMPLE_RATE);
  buffer.getChannelData(0).set(signal);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const engine = create(ctx, state);
  await engine.ready;
  source.connect(engine.input);
  engine.output.connect(ctx.destination);
  source.start();
  const rendered = await ctx.startRendering();
  engine.dispose();
  return rendered.getChannelData(0);
}

/** The level of a response at `hertz`, between the two bins around it. */
function levelAt(
  { db, freqs }: { db: Float32Array; freqs: Float32Array },
  hertz: number
) {
  const step = freqs[1] ?? 1;
  const below = Math.min(freqs.length - 2, Math.floor(hertz / step));
  const share = hertz / step - below;
  return (db[below] ?? 0) * (1 - share) + (db[below + 1] ?? 0) * share;
}

/** What a measurement of a frequency response found. */
export interface ResponseMeasurement {
  /** The frequency, in hertz, where the engine is furthest from the curve. */
  at: number;
  /** How far, in dB. 0 when no tested frequency had a curve audible enough to compare. */
  worstDb: number;
}

/**
 * How far an engine's frequency response is from `curve`, the gain in dB the
 * device draws at each frequency. The response is read from the engine's
 * impulse response, at 11 frequencies from 31 Hz to 16 kHz.
 */
export async function measureResponse<State>(
  create: EngineFactory<State, MeasuredEngine>,
  state: State,
  curve: (hertz: number) => number,
  frequencies: readonly number[] = RESPONSE_FREQUENCIES
): Promise<ResponseMeasurement> {
  const measured = response(
    await renderThrough(create, state, impulseOf(RESPONSE_SECONDS)),
    { fs: SAMPLE_RATE }
  );
  let worstDb = 0;
  let at = 0;
  for (const hertz of frequencies) {
    const wanted = curve(hertz);
    if (wanted < AUDIBLE_FLOOR_DB) {
      continue;
    }
    const gap = Math.abs(levelAt(measured, hertz) - wanted);
    if (gap > worstDb) {
      worstDb = gap;
      at = hertz;
    }
  }
  return { at, worstDb };
}

/** How long an engine delays a signal, in milliseconds: where what comes out of an impulse lines up with it. A host reports this to compensate it. */
export async function measureLatency<State>(
  create: EngineFactory<State, MeasuredEngine>,
  state: State
): Promise<number> {
  const reference = impulseOf(LATENCY_SECONDS);
  const recorded = await renderThrough(create, state, reference);
  return latency(recorded, reference, { fs: SAMPLE_RATE }).seconds * 1000;
}
