import type { DeviceContext } from "@audio-ui/engine/device";
import { DEFAULT_TEMPO } from "@audio-ui/engine/time";
import {
  PHASER_STAGES,
  PHASER_WORKLET,
  type PhaserState,
  phaserSettings,
} from "@/components/audio-ui/devices/phaser/device";

const RAMP_SECONDS = 0.03;
/** How long after the classic phaser fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface PhaserEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the classic phaser is in the graph. Until then it plays the phaser. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: PhaserState, context?: DeviceContext) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the classic phaser into a context once. `false` when the context cannot run worklets. */
function loadClassic(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([PHASER_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A phaser and flanger on the Web Audio API for a `PhaserState`. The phaser
 * and flanger paths are always built and the mode crossfades them; the
 * classic phaser is an `AudioWorklet` loaded from a blob, fed only while it
 * plays:
 *
 * ```
 * input → dry ───────────────────────────────────────────────┐
 *       → all-pass x4 → phaser wet (feedback to the first) ──┤
 *       → delay → flanger wet (feedback to itself) ──────────┤
 *       → classic (worklet) → classic wet ───────────────────┴→ output
 *             ↑ oscillator: cents on each stage, seconds on the delay
 * ```
 *
 * Until the worklet is ready, the classic mode plays the phaser.
 */
export function createPhaserEngine(
  ctx: BaseAudioContext,
  initial: PhaserState,
  context?: DeviceContext
): PhaserEngine {
  let tempo = context?.tempo ?? DEFAULT_TEMPO;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";

  const phaserIn = ctx.createGain();
  const stages = Array.from({ length: PHASER_STAGES }, () => {
    const stage = ctx.createBiquadFilter();
    stage.type = "allpass";
    return stage;
  });
  const phaserFeedback = ctx.createGain();
  const phaserWet = ctx.createGain();
  const phaserSweep = ctx.createGain();
  [phaserIn, ...stages].reduce((from, to) => {
    from.connect(to);
    return to;
  });
  const last = stages.at(-1);
  last?.connect(phaserWet).connect(output);
  last?.connect(phaserFeedback).connect(phaserIn);
  oscillator.connect(phaserSweep);
  for (const stage of stages) {
    phaserSweep.connect(stage.detune);
  }

  const delay = ctx.createDelay(0.05);
  const flangerFeedback = ctx.createGain();
  const flangerWet = ctx.createGain();
  const flangerSweep = ctx.createGain();
  delay.connect(flangerWet).connect(output);
  delay.connect(flangerFeedback).connect(delay);
  oscillator.connect(flangerSweep).connect(delay.delayTime);

  const classicWet = ctx.createGain();
  classicWet.connect(output);

  input.connect(dry).connect(output);
  input.connect(phaserIn);
  input.connect(delay);

  let classic: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  const set = (
    state: PhaserState,
    write: (param: AudioParam, value: number) => void
  ) => {
    const settings = phaserSettings(state, tempo);
    // Until the worklet is ready, the classic mode plays the phaser.
    const playing = state.mode === "classic" && classic !== null;
    oscillator.frequency.value = settings.rate;
    write(dry.gain, settings.dry);
    write(
      phaserWet.gain,
      playing ? settings.phaserWet : settings.phaserWet + settings.classicWet
    );
    write(flangerWet.gain, settings.flangerWet);
    write(classicWet.gain, playing ? settings.classicWet : 0);
    write(phaserFeedback.gain, settings.feedback);
    write(flangerFeedback.gain, settings.feedback);
    write(phaserSweep.gain, settings.phaserSweepCents);
    write(flangerSweep.gain, settings.flangerSweep);
    write(delay.delayTime, settings.delay);
    for (const stage of stages) {
      write(stage.frequency, settings.center);
    }
    if (classic) {
      const param = (name: string) =>
        classic?.parameters.get(name) as AudioParam;
      write(param("rate"), settings.rate);
      write(param("depth"), settings.classicDepth);
      write(param("fc"), settings.center);
      write(param("feedback"), settings.feedback);
      // A count, not a level: it changes at once, and the worklet fades it in.
      param("stages").value = settings.stages;
    }
    clearTimeout(unfeed);
    if (playing && !fed && classic) {
      input.connect(classic);
      fed = true;
    } else if (!playing && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && classic) {
          input.disconnect(classic);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };
  const ramp = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
  set(initial, (param, value) => {
    param.value = value;
  });
  oscillator.start();

  const ready = loadClassic(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = phaserSettings(latest, tempo);
    classic = new AudioWorkletNode(ctx, "audioui-phaser", {
      outputChannelCount: [2],
      parameterData: {
        depth: settings.classicDepth,
        fc: settings.center,
        feedback: settings.feedback,
        rate: settings.rate,
        stages: settings.stages,
      },
    });
    classic.connect(classicWet);
    set(latest, ramp);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      oscillator.stop();
      for (const node of [
        input,
        dry,
        oscillator,
        phaserIn,
        ...stages,
        phaserFeedback,
        phaserWet,
        phaserSweep,
        delay,
        flangerFeedback,
        flangerWet,
        flangerSweep,
        classicWet,
        output,
      ]) {
        node.disconnect();
      }
      classic?.disconnect();
    },
    input,
    output,
    ready,
    update: (state, next) => {
      tempo = next?.tempo ?? tempo;
      latest = state;
      set(state, ramp);
      oscillator.frequency.setTargetAtTime(
        phaserSettings(state, tempo).rate,
        ctx.currentTime,
        RAMP_SECONDS
      );
    },
  };
}