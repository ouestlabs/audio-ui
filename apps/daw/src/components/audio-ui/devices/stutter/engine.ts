import type { DeviceContext } from "@audio-ui/core/device";
import { DEFAULT_TEMPO } from "@audio-ui/core/time";
import {
  STUTTER_WORKLET,
  type StutterState,
  stutterSettings,
} from "@/components/audio-ui/devices/stutter/device";

const RAMP_SECONDS = 0.01;

export interface StutterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the stutter is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: StutterState, context?: DeviceContext) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the stutter into a context once. `false` when the context cannot run worklets. */
function loadStutter(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([STUTTER_WORKLET], { type: "text/javascript" })
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
 * A stutter on the Web Audio API for a `StutterState`:
 *
 * ```
 * input → stutter (worklet) → processed ──┐
 *       → clean (until it is ready) ──────┴→ output
 * ```
 *
 * The stutter is an `AudioWorklet` loaded from a blob, the kernel playing the
 * whole sound, its lengths read against the host's tempo. Turning it on starts
 * a fresh cycle, catching a slice at once. Until it is ready the sound passes
 * clean. Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createStutterEngine(
  ctx: BaseAudioContext,
  initial: StutterState,
  context?: DeviceContext
): StutterEngine {
  let tempo = context?.tempo ?? DEFAULT_TEMPO;
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

  const apply = (state: StutterState) => {
    if (!node) {
      return;
    }
    const settings = stutterSettings(state, tempo);
    follow(node.parameters.get("decay") as AudioParam, settings.decay);
    follow(node.parameters.get("mix") as AudioParam, settings.mix);
    // Lengths, not levels: they change at once, and the worklet fades a new cycle in.
    (node.parameters.get("interval") as AudioParam).value = settings.interval;
    (node.parameters.get("slice") as AudioParam).value = settings.slice;
  };

  const ready = loadStutter(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    node = new AudioWorkletNode(ctx, "audioui-stutter", {
      outputChannelCount: [2],
      parameterData: stutterSettings(latest, tempo),
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
    update: (state, next) => {
      tempo = next?.tempo ?? tempo;
      // Turned on: catch a slice from now.
      if (state.enabled && !latest.enabled) {
        node?.port.postMessage("trigger");
      }
      latest = state;
      apply(state);
    },
  };
}