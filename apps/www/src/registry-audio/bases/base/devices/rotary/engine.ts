import {
  ROTARY_WORKLET,
  type RotaryState,
  rotarySettings,
} from "@/registry-audio/bases/base/devices/rotary/device";

const RAMP_SECONDS = 0.02;

export interface RotaryEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the rotary is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: RotaryState) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the rotary into a context once. `false` when the context cannot run worklets. */
function loadRotary(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([ROTARY_WORKLET], { type: "text/javascript" })
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
 * A rotary speaker on the Web Audio API for a `RotaryState`:
 *
 * ```
 * input → rotary (worklet) → processed ───┐
 *       → clean (until it is ready) ─────┴→ output
 * ```
 *
 * The rotary is an `AudioWorklet` loaded from a blob, the kernel playing the
 * whole sound, its two rotors heard in stereo. Until it is ready the sound
 * passes clean, then it fades over. Parameters move with `setTargetAtTime`,
 * never `.value =`.
 */
export function createRotaryEngine(
  ctx: BaseAudioContext,
  initial: RotaryState
): RotaryEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const processed = ctx.createGain();
  const clean = ctx.createGain();
  input.connect(clean).connect(output);
  processed.connect(output);
  processed.gain.value = 0;
  clean.gain.value = 1;

  let node: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: RotaryState) => {
    if (!node) {
      return;
    }
    const settings = rotarySettings(state);
    for (const [name, value] of Object.entries(settings)) {
      follow(node.parameters.get(name) as AudioParam, value);
    }
  };

  const ready = loadRotary(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    node = new AudioWorkletNode(ctx, "audioui-rotary", {
      outputChannelCount: [2],
      parameterData: rotarySettings(latest),
    });
    input.connect(node).connect(processed);
    follow(processed.gain, 1);
    follow(clean.gain, 0);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      for (const each of [input, processed, clean, output]) {
        each.disconnect();
      }
      node?.disconnect();
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      apply(state);
    },
  };
}
