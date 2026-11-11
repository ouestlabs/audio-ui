import {
  ROTARY_WORKLET,
  type RotaryState,
  rotarySettings,
} from "@/registry-audio/bases/base/devices/rotary/device";
import { createWorkletStage } from "@/registry-audio/bases/base/lib/device-engine";

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
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () =>
      new AudioWorkletNode(ctx, "audioui-rotary", {
        outputChannelCount: [2],
        parameterData: rotarySettings(latest),
      }),
    ramp: RAMP_SECONDS,
    source: ROTARY_WORKLET,
  });
  stage.connect(output);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: RotaryState) => {
    const { node } = stage;
    if (!node) {
      return;
    }
    const settings = rotarySettings(state);
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
