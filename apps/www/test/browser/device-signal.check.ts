import { defineDevice } from "@/engine/device";
import { compressorDevice } from "@/registry/bases/base/devices/compressor/device";
import { createCompressorEngine } from "@/registry/bases/base/devices/compressor/engine";
import {
  createDeviceSignal,
  type SignalTarget,
} from "@/registry/bases/base/lib/device-signal";
import type { Source } from "@/registry/bases/base/primitives/primitive";
import { assert, check } from "./harness.ts";

const effect = defineDevice({
  description: "Passes the sound.",
  id: "check.effect",
  name: "Effect",
  parameters: [{ default: true, id: "enabled", kind: "toggle", label: "On" }],
  signals: ["modulator"],
});
const instrument = defineDevice({
  description: "Makes a tone.",
  id: "check.instrument",
  kind: "instrument",
  name: "Instrument",
  parameters: [{ default: true, id: "enabled", kind: "toggle", label: "On" }],
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Watches a source for `ms` and returns its last value, as a meter on screen would read it. */
async function watch<T>(source: Source<T>, ms: number): Promise<T> {
  const stop = source.subscribe(() => undefined);
  await wait(ms);
  const value = source.getSnapshot();
  stop();
  return value;
}

/** A sine on a running context, through a gain that stands for an engine: what goes in is the sine, what comes out is it at `gain`. */
async function sineEngine(frequency: number, amplitude: number, gain = 1) {
  const ctx = new AudioContext();
  await ctx.resume();
  const oscillator = ctx.createOscillator();
  oscillator.frequency.value = frequency;
  const level = ctx.createGain();
  level.gain.value = amplitude;
  const input = ctx.createGain();
  const output = ctx.createGain();
  output.gain.value = gain;
  oscillator.connect(level).connect(input).connect(output);
  output.connect(ctx.destination);
  // Heard at no level: the engine plays, the page stays quiet.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  output.disconnect();
  output.connect(mute).connect(ctx.destination);
  oscillator.start();
  await running(ctx);
  return { ctx, input, oscillator, output };
}

/** Waits until the context's clock has run a tenth of a second: the first context of a page can take a moment to start rendering after it resumes. */
async function running(
  ctx: BaseAudioContext,
  from = ctx.currentTime
): Promise<void> {
  if (ctx.currentTime - from >= 0.1) {
    return;
  }
  await wait(20);
  return running(ctx, from);
}

const near = (actual: number, expected: number, tolerance: number) =>
  Math.abs(actual - expected) <= tolerance;

check("a sine's levels read as its RMS and its peak, in and out", async () => {
  const { ctx, input, output } = await sineEngine(441, 0.5, 0.5);
  const signal = createDeviceSignal(() => ({ input, output }), effect);
  const [into, out] = await Promise.all([
    watch(
      signal.input?.levels as Source<{
        levels: readonly number[];
        peaks?: readonly number[];
      }>,
      400
    ),
    watch(signal.output.levels, 400),
  ]);
  await ctx.close();
  // A sine at 0.5 is -9.03 dB RMS and -6.02 dB at its peak; at 0.25, 6 dB lower.
  for (const db of into.levels) {
    assert(near(db, -9.03, 0.5), `in RMS ${db}`);
  }
  for (const db of into.peaks ?? []) {
    assert(near(db, -6.02, 0.5), `in peak ${db}`);
  }
  for (const db of out.levels) {
    assert(near(db, -15.05, 0.5), `out RMS ${db}`);
  }
});

check("a scope starts where the wave rises through zero", async () => {
  const { ctx, output } = await sineEngine(441, 0.8);
  const signal = createDeviceSignal(() => ({ output }), instrument);
  const samples = await watch(signal.output.scope({ length: 512 }), 300);
  await ctx.close();
  assert(near(samples[0] as number, 0, 0.05), `first sample ${samples[0]}`);
  assert((samples[3] as number) > 0, "the wave rises after it");
});

check("a spectrum peaks at the sine's frequency", async () => {
  const { ctx, output } = await sineEngine(1000, 0.5);
  const signal = createDeviceSignal(() => ({ output }), instrument);
  const points = 200;
  const spectrum = await watch(
    signal.output.spectrum({ maxHz: 20_000, minHz: 20, points }),
    400
  );
  await ctx.close();
  let loudest = 0;
  spectrum.forEach((db, index) => {
    if (db > (spectrum[loudest] as number)) {
      loudest = index;
    }
  });
  // The point of 1 kHz on a log axis from 20 Hz to 20 kHz.
  const expected = (Math.log(1000 / 20) / Math.log(20_000 / 20)) * (points - 1);
  assert(
    Math.abs(loudest - expected) <= 2,
    `peak at ${loudest}, not ${expected}`
  );
});

check(
  "a modulator's history holds its real swing over the window",
  async () => {
    const ctx = new AudioContext();
    await ctx.resume();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2;
    const output = ctx.createGain();
    lfo.start();
    const signal = createDeviceSignal(
      () => ({ input: output, output, taps: { modulator: lfo } }),
      effect
    );
    const history = await watch(
      signal.modulator?.history({
        points: 200,
        seconds: 1,
      }) as Source<Float32Array>,
      1300
    );
    await ctx.close();
    assert(Math.max(...history) > 0.9, `top ${Math.max(...history)}`);
    assert(Math.min(...history) < -0.9, `bottom ${Math.min(...history)}`);
    // Two cycles a second: it changes direction about four times in the window.
    let turns = 0;
    for (let index = 2; index < history.length; index += 1) {
      const a = (history[index - 1] as number) - (history[index - 2] as number);
      const b = (history[index] as number) - (history[index - 1] as number);
      if (a * b < 0) {
        turns += 1;
      }
    }
    assert(turns >= 3 && turns <= 6, `${turns} turns`);
  }
);

check("silence reads silent and inactive, and so does no engine", async () => {
  const ctx = new AudioContext();
  await ctx.resume();
  const node = ctx.createGain();
  const quiet = createDeviceSignal(
    () => ({ input: node, output: node }),
    effect
  );
  const none = createDeviceSignal(() => null, effect);
  const [levels, active, nothing, nothingActive] = await Promise.all([
    watch(quiet.output.levels, 300),
    watch(quiet.output.active, 300),
    watch(none.output.levels, 300),
    watch(none.input?.active as Source<boolean>, 300),
  ]);
  await ctx.close();
  assert(
    levels.levels.every((db) => db <= -99),
    `levels ${levels.levels}`
  );
  assert(active === false, "silence is not active");
  assert(
    nothing.levels.every((db) => db <= -99),
    "no engine is silent"
  );
  assert(nothingActive === false, "no engine is not active");
});

check("a signal follows a new engine and lets go of the old one", async () => {
  const first = await sineEngine(441, 0.5);
  const { ctx } = first;
  const second = ctx.createGain();
  second.gain.value = 0.1;
  first.oscillator.connect(second);
  let target: SignalTarget = { output: first.output };
  const signal = createDeviceSignal(() => target, instrument);
  const stop = signal.output.levels.subscribe(() => undefined);
  await wait(300);
  const before = signal.output.levels.getSnapshot().levels[0] as number;
  target = { output: second };
  await wait(600);
  const after = signal.output.levels.getSnapshot().levels[0] as number;
  stop();
  await ctx.close();
  // The sine at 0.5, then at 0.1: 14 dB lower.
  assert(near(before, -9.03, 0.5), `before ${before}`);
  assert(near(after, -23.01, 1), `after ${after}`);
});

check("the analysers come off once nothing watches", async () => {
  const { ctx, output } = await sineEngine(441, 0.5);
  const connected: AudioNode[] = [];
  const connect = output.connect.bind(output) as (node: AudioNode) => AudioNode;
  const disconnect = output.disconnect.bind(output) as (
    node?: AudioNode
  ) => void;
  output.connect = ((node: AudioNode) => {
    connected.push(node);
    return connect(node);
  }) as typeof output.connect;
  output.disconnect = ((node?: AudioNode) => {
    const at = connected.indexOf(node as AudioNode);
    if (at !== -1) {
      connected.splice(at, 1);
    }
    disconnect(node);
  }) as typeof output.disconnect;
  const taps = () => connected.length;
  const signal = createDeviceSignal(() => ({ output }), instrument);
  const levels = signal.output.levels.subscribe(() => undefined);
  const scope = signal.output.scope().subscribe(() => undefined);
  await wait(200);
  // One tap per kind of read: a stereo one for the levels, a mono one for the scope.
  assert(taps() === 2, `${taps()} taps while watched`);
  levels();
  await wait(50);
  assert(taps() === 1, `${taps()} taps with the scope alone`);
  scope();
  await wait(50);
  assert(taps() === 0, `${taps()} taps once nothing watches`);
  await ctx.close();
});

check("a compressor's readings and levels come from its engine", async () => {
  const ctx = new AudioContext();
  await ctx.resume();
  const engine = createCompressorEngine(ctx, {
    ...compressorDevice.defaults(),
    ratio: 8,
    thresholdDb: -30,
  });
  assert(await engine.ready, "the compressor's worklet loads");
  const oscillator = ctx.createOscillator();
  const level = ctx.createGain();
  level.gain.value = 0.7;
  oscillator.connect(level).connect(engine.input);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  engine.output.connect(mute).connect(ctx.destination);
  oscillator.start();
  const signal = createDeviceSignal(() => engine, compressorDevice);
  const [readings, into, out] = await Promise.all([
    watch(signal.readings, 800),
    watch(signal.input?.levels as Source<{ levels: readonly number[] }>, 800),
    watch(signal.output.levels, 800),
  ]);
  engine.dispose();
  await ctx.close();
  // A sine at 0.7 is -6 dB RMS, 24 dB over the threshold: at 8:1 about 21 dB come off.
  const reduction = readings.gainReductionDb ?? 0;
  assert(reduction < -12, `reduction ${reduction}`);
  assert(
    (into.levels[0] as number) - (out.levels[0] as number) > 12,
    `in ${into.levels[0]}, out ${out.levels[0]}`
  );
});

check(
  "forty-eight devices watched at once each read their own sound",
  async () => {
    const ctx = new AudioContext();
    await ctx.resume();
    const mute = ctx.createGain();
    mute.gain.value = 0;
    mute.connect(ctx.destination);
    const engines = Array.from({ length: 48 }, (_, index) => {
      const oscillator = ctx.createOscillator();
      const output = ctx.createGain();
      // From 1 down to about 0.004: each 0.5 dB lower than the last.
      output.gain.value = 10 ** (-(index * 0.5) / 20);
      oscillator.connect(output).connect(mute);
      oscillator.start();
      return { output };
    });
    const signals = engines.map((engine) =>
      createDeviceSignal(() => ({ input: engine.output, ...engine }), effect)
    );
    const stops = signals.flatMap((signal) => [
      signal.input?.levels.subscribe(() => undefined) ?? (() => undefined),
      signal.output.levels.subscribe(() => undefined),
      signal.output.spectrum().subscribe(() => undefined),
    ]);
    let frames = 0;
    let longest = 0;
    let last = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        longest = Math.max(longest, now - last);
        last = now;
        frames += 1;
        if (frames < 60) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
    const levels = signals.map(
      (signal) => signal.output.levels.getSnapshot().levels[0] as number
    );
    for (const stop of stops) {
      stop();
    }
    await ctx.close();
    levels.forEach((db, index) => {
      assert(near(db, -3.01 - index * 0.5, 0.3), `device ${index} at ${db}`);
    });
    console.log(`48 devices: longest frame ${longest.toFixed(1)} ms`);
  }
);
