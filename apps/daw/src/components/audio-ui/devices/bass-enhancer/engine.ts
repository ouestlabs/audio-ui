import {
  BASS_ENHANCER_WORKLET,
  type BassEnhancerState,
  bassEnhancerSettings,
} from "@/components/audio-ui/devices/bass-enhancer/device";

const RAMP_SECONDS = 0.02;

export interface BassEnhancerEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the bass enhancer is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: BassEnhancerState) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the bass enhancer into a context once. `false` when the context cannot run worklets. */
function loadBassEnhancer(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([BASS_ENHANCER_WORKLET], { type: "text/javascript" })
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
 * A bass enhancer on the Web Audio API for a `BassEnhancerState`:
 *
 * ```
 * input → bass enhancer (worklet) → processed ──┐
 *       → clean (until it is ready) ─────┴→ output
 * ```
 *
 * The bass enhancer is an `AudioWorklet` loaded from a blob, the kernel playing the
 * whole sound, the harmonics of its lows added in. Until it is ready the sound passes clean, then it fades
 * over. Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createBassEnhancerEngine(
  ctx: BaseAudioContext,
  initial: BassEnhancerState
): BassEnhancerEngine {
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

  const apply = (state: BassEnhancerState) => {
    if (!node) {
      return;
    }
    const settings = bassEnhancerSettings(state);
    for (const [name, value] of Object.entries(settings)) {
      follow(node.parameters.get(name) as AudioParam, value);
    }
  };

  const ready = loadBassEnhancer(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    node = new AudioWorkletNode(ctx, "audioui-bass-enhancer", {
      outputChannelCount: [2],
      parameterData: bassEnhancerSettings(latest),
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
