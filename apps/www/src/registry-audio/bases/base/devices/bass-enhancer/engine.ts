import {
  BASS_ENHANCER_WORKLET,
  type BassEnhancerState,
  bassEnhancerSettings,
} from "@/registry-audio/bases/base/devices/bass-enhancer/device";
import { createWorkletStage } from "@/registry-audio/bases/base/lib/device-engine";

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
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () =>
      new AudioWorkletNode(ctx, "audioui-bass-enhancer", {
        outputChannelCount: [2],
        parameterData: bassEnhancerSettings(latest),
      }),
    ramp: RAMP_SECONDS,
    source: BASS_ENHANCER_WORKLET,
  });
  stage.connect(output);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: BassEnhancerState) => {
    const { node } = stage;
    if (!node) {
      return;
    }
    const settings = bassEnhancerSettings(state);
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
