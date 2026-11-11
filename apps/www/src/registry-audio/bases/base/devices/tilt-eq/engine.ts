import type { EffectEngine } from "@audio-ui/engine/device";
import { createWorkletStage } from "@audio-ui/engine/device";
import {
  TILT_EQ_WORKLET,
  type TiltEqState,
  tiltEqSettings,
} from "@/registry-audio/bases/base/devices/tilt-eq/device";

const RAMP_SECONDS = 0.02;

export interface TiltEqEngine extends EffectEngine<TiltEqState> {
  /** Resolves once the tilt is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A tilt EQ on the Web Audio API for a `TiltEqState`:
 *
 * ```
 * input → tilt (worklet) → tilted ──┐
 *       → clean ────────────────────┴→ output level → output
 * ```
 *
 * The tilt is an `AudioWorklet` loaded from a blob. Until it is ready the
 * sound passes clean, then it fades over to the tilt. Parameters move with
 * `setTargetAtTime`, never `.value =`.
 */
export function createTiltEqEngine(
  ctx: BaseAudioContext,
  initial: TiltEqState
): TiltEqEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () => {
      const settings = tiltEqSettings(latest);
      return new AudioWorkletNode(ctx, "audioui-tilt-eq", {
        outputChannelCount: [2],
        parameterData: { gain: settings.gain, pivot: settings.pivot },
      });
    },
    ramp: RAMP_SECONDS,
    source: TILT_EQ_WORKLET,
  });
  const level = ctx.createGain();
  stage.connect(level);
  level.connect(output);
  level.gain.value = tiltEqSettings(initial).output;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: TiltEqState) => {
    const settings = tiltEqSettings(state);
    follow(level.gain, settings.output);
    const tilt = stage.node;
    if (tilt) {
      follow(tilt.parameters.get("gain") as AudioParam, settings.gain);
      follow(tilt.parameters.get("pivot") as AudioParam, settings.pivot);
    }
  };

  // In the graph, the tilt plays the state as it is by then.
  const ready = stage.ready.then((ok) => {
    if (ok) {
      apply(latest);
    }
    return ok;
  });

  return {
    dispose: () => {
      stage.dispose();
      for (const node of [input, level, output]) {
        node.disconnect();
      }
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
