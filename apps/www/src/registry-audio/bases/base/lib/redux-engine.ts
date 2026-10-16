import {
  REDUX_WORKLET,
  type ReduxState,
  reduxSettings,
  reduxTable,
} from "@/registry-audio/bases/base/lib/redux-device";

const RAMP_SECONDS = 0.015;

export interface ReduxEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the sample hold is in the graph. Until then the bits are crushed and the rate is not reduced. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: ReduxState) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the sample hold into a context once. `false` when the context cannot run worklets. */
function loadHold(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([REDUX_WORKLET], { type: "text/javascript" })
  );
  const done = worklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A redux on the Web Audio API for a `ReduxState`:
 *
 * ```
 * input → sample hold → quantizer (table) → wet ──┐
 *       → dry ────────────────────────────────────┴→ output
 * ```
 *
 * The bits are a `WaveShaperNode` table, rebuilt only when they change. The
 * sample hold is an `AudioWorklet` loaded from a blob: until it is ready the
 * signal goes straight to the quantizer.
 */
export function createReduxEngine(
  ctx: BaseAudioContext,
  initial: ReduxState
): ReduxEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const pre = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  let { bits } = initial;
  shaper.curve = reduxTable(bits);
  input.connect(pre).connect(shaper).connect(wet).connect(output);
  input.connect(dry).connect(output);

  const first = reduxSettings(initial);
  wet.gain.value = first.wet;
  dry.gain.value = first.dry;

  let hold: AudioWorkletNode | null = null;
  let held = first.hold;
  let disposed = false;
  const ready = loadHold(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    hold = new AudioWorkletNode(ctx, "audioui-redux", {
      parameterData: { hold: held },
    });
    pre.disconnect(shaper);
    pre.connect(hold).connect(shaper);
    return true;
  });

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      disposed = true;
      for (const node of [input, pre, shaper, wet, dry, output]) {
        node.disconnect();
      }
      hold?.disconnect();
    },
    input,
    output,
    ready,
    update: (state) => {
      if (state.bits !== bits) {
        ({ bits } = state);
        shaper.curve = reduxTable(bits);
      }
      const settings = reduxSettings(state);
      held = settings.hold;
      hold?.parameters.get("hold")?.setValueAtTime(held, ctx.currentTime);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
    },
  };
}
