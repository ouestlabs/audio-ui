import type { DeviceReadings } from "@audio-ui/core/device";
import {
  DEESSER_WORKLET,
  type DeesserState,
  deesserSettings,
} from "@/registry-audio/bases/base/devices/deesser/device";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";
import { createWorkletStage } from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.01;

export interface DeesserEngine extends EffectEngine<DeesserState> {
  /** What the highs are taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the de-esser is in the graph. Until then the highs pass unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the highs are taken down by right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

/**
 * A de-esser on the Web Audio API for a `DeesserState`:
 *
 * ```
 * input → de-esser (an AudioWorklet) → de-essed ─┐
 *       → bypass (until it is ready) ────────────┴→ output
 * ```
 *
 * The de-esser is the audio.js one, loaded from a blob. Until it is ready the
 * highs pass, then the signal fades over to it. Every parameter is set as a
 * value, not a glide, since each makes the model again, which fades it in.
 */
export function createDeesserEngine(
  ctx: BaseAudioContext,
  initial: DeesserState
): DeesserEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();

  let settings = deesserSettings(initial);
  let reduction = 0;
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () => {
      settings = deesserSettings(latest);
      const model = new AudioWorkletNode(ctx, "audioui-deesser", {
        outputChannelCount: [2],
        parameterData: settings.modelParams,
        processorOptions: { model: "deesser" },
      });
      model.port.onmessage = (event: MessageEvent<number>) => {
        reduction = event.data;
      };
      return model;
    },
    ramp: RAMP_SECONDS,
    source: DEESSER_WORKLET,
  });
  stage.connect(output);

  const route = () => {
    for (const [name, value] of Object.entries(settings.modelParams)) {
      stage.node?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
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
    get reduction() {
      return reduction;
    },
    readings: (): DeviceReadings => ({ gainReductionDb: reduction }),
    ready: stage.ready,
    update: (state) => {
      latest = state;
      settings = deesserSettings(state);
      route();
    },
  };
}
