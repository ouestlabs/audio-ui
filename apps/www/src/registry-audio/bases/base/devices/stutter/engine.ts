import type { DeviceContext, EffectEngine } from "@audio-ui/engine/device";
import { createWorkletStage } from "@audio-ui/engine/device";
import { DEFAULT_TEMPO } from "@audio-ui/engine/time";
import {
  STUTTER_WORKLET,
  type StutterState,
  stutterSettings,
} from "@/registry-audio/bases/base/devices/stutter/device";

const RAMP_SECONDS = 0.01;

export interface StutterEngine extends EffectEngine<StutterState> {
  /** Resolves once the stutter is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
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
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () =>
      new AudioWorkletNode(ctx, "audioui-stutter", {
        outputChannelCount: [2],
        parameterData: stutterSettings(latest, tempo),
      }),
    ramp: RAMP_SECONDS,
    source: STUTTER_WORKLET,
  });
  stage.connect(output);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: StutterState) => {
    const { node } = stage;
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

  return {
    dispose: () => {
      stage.dispose();
      input.disconnect();
      output.disconnect();
    },
    input,
    output,
    ready: stage.ready,
    update: (state, next) => {
      tempo = next?.tempo ?? tempo;
      // Turned on: catch a slice from now.
      if (state.enabled && !latest.enabled) {
        stage.node?.port.postMessage("trigger");
      }
      latest = state;
      apply(state);
    },
  };
}
