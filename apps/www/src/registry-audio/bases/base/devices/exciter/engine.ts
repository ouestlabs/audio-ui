import {
  EXCITER_WORKLET,
  type ExciterState,
  exciterSettings,
} from "@/registry-audio/bases/base/devices/exciter/device";
import { createWorkletStage } from "@/registry-audio/bases/base/lib/device-engine";

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
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () =>
      new AudioWorkletNode(ctx, "audioui-exciter", {
        outputChannelCount: [2],
        parameterData: exciterSettings(latest),
      }),
    ramp: RAMP_SECONDS,
    source: EXCITER_WORKLET,
  });
  stage.connect(output);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: ExciterState) => {
    const { node } = stage;
    if (!node) {
      return;
    }
    const settings = exciterSettings(state);
    for (const [name, value] of Object.entries(settings)) {
      follow(node.parameters.get(name) as AudioParam, value);
    }
  };

  return {
    dispose: () => {
      stage.dispose();
      input.disconnect();
      output.disconnect();
    },
    input,
    output,
    ready: stage.ready,
    update: (state) => {
      latest = state;
      apply(state);
    },
  };
}
