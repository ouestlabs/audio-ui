import type { EffectEngine } from "@audio-ui/engine/device";
import { createWorkletStage } from "@audio-ui/engine/device";
import {
  TRANSIENT_WORKLET,
  type TransientState,
  transientSettings,
} from "@/registry-audio/bases/base/devices/transient/device";

const RAMP_SECONDS = 0.01;

export interface TransientEngine extends EffectEngine<TransientState> {
  /** Resolves once the shaper is in the graph. Until then the signal passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A transient shaper on the Web Audio API for a `TransientState`:
 *
 * ```
 * input → shaper (an AudioWorklet) → shaped → output gain → output
 *       → bypass (until it is ready) ─────────┘
 * ```
 *
 * The shaper is the audio.js transient shaper, loaded from a blob. Until it
 * is ready the signal passes unchanged, then it fades over to the shaper.
 */
export function createTransientEngine(
  ctx: BaseAudioContext,
  initial: TransientState
): TransientEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();

  let settings = transientSettings(initial);
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () => {
      settings = transientSettings(latest);
      return new AudioWorkletNode(ctx, "audioui-transient", {
        outputChannelCount: [2],
        parameterData: settings.modelParams,
        processorOptions: { model: "shaper" },
      });
    },
    ramp: RAMP_SECONDS,
    source: TRANSIENT_WORKLET,
  });
  const master = ctx.createGain();
  stage.connect(master);
  master.connect(output);
  master.gain.value = settings.output;

  const route = () => {
    for (const [name, value] of Object.entries(settings.modelParams)) {
      stage.node?.parameters
        .get(name)
        ?.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
    }
    master.gain.setTargetAtTime(settings.output, ctx.currentTime, RAMP_SECONDS);
  };

  return {
    dispose: () => {
      stage.dispose();
      for (const node of [input, master, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready: stage.ready,
    update: (state) => {
      latest = state;
      settings = transientSettings(state);
      route();
    },
  };
}
