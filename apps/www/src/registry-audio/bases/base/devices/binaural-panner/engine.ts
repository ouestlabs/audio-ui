import type { EffectEngine } from "@audio-ui/engine/device";
import { createWorkletStage } from "@audio-ui/engine/device";
import {
  BINAURAL_PANNER_WORKLET,
  type BinauralPannerState,
  binauralPannerSettings,
} from "@/registry-audio/bases/base/devices/binaural-panner/device";

const RAMP_SECONDS = 0.02;

export interface BinauralPannerEngine
  extends EffectEngine<BinauralPannerState> {
  /** Resolves once the panner is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A binaural panner on the Web Audio API for a `BinauralPannerState`:
 *
 * ```
 * input → panner (worklet) → processed ───┐
 *       → clean (until it is ready) ─────┴→ output
 * ```
 *
 * The panner is an `AudioWorklet` loaded from a blob, the kernel playing the
 * whole sound. A direction is sent unwrapped, as the angle nearest the last
 * one, so a turn across the back goes the short way round, not through the
 * front. Until it is ready the sound passes clean, then it fades over.
 * Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createBinauralPannerEngine(
  ctx: BaseAudioContext,
  initial: BinauralPannerState
): BinauralPannerEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () =>
      new AudioWorkletNode(ctx, "audioui-binaural-panner", {
        outputChannelCount: [2],
        parameterData: binauralPannerSettings(latest),
      }),
    ramp: RAMP_SECONDS,
    source: BINAURAL_PANNER_WORKLET,
  });
  stage.connect(output);
  let { azimuth } = binauralPannerSettings(initial);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: BinauralPannerState) => {
    const { node } = stage;
    if (!node) {
      return;
    }
    const settings = binauralPannerSettings(state);
    for (const [name, value] of Object.entries(settings)) {
      if (name !== "azimuth") {
        follow(node.parameters.get(name) as AudioParam, value);
      }
    }
    // The nearest turn of the same direction to the last one sent.
    azimuth += ((((settings.azimuth - azimuth) % 360) + 540) % 360) - 180;
    follow(node.parameters.get("azimuth") as AudioParam, azimuth);
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
