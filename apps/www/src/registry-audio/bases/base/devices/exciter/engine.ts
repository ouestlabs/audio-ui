import {
  EXCITER_WORKLET,
  type ExciterState,
  exciterSettings,
} from "@/registry-audio/bases/base/devices/exciter/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";

const RAMP_SECONDS = 0.02;

export interface ExciterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the exciter is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: ExciterState) => void;
}

/**
 * An exciter on the Web Audio API for a `ExciterState`:
 *
 * ```
 * input → exciter (worklet) → processed ──┐
 *       → clean (until it is ready) ─────┴→ output
 * ```
 *
 * The exciter is an `AudioWorklet` loaded from a blob, the kernel playing the
 * whole sound, its new harmonics added in. Until it is ready the sound passes clean, then it fades
 * over. Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createExciterEngine(
  ctx: BaseAudioContext,
  initial: ExciterState
): ExciterEngine {
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

  const apply = (state: ExciterState) => {
    if (!node) {
      return;
    }
    const settings = exciterSettings(state);
    for (const [name, value] of Object.entries(settings)) {
      follow(node.parameters.get(name) as AudioParam, value);
    }
  };

  const ready = loadWorklet(ctx, EXCITER_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    node = new AudioWorkletNode(ctx, "audioui-exciter", {
      outputChannelCount: [2],
      parameterData: exciterSettings(latest),
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
