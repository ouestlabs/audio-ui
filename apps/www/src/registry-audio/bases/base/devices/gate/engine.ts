import {
  GATE_WORKLET,
  type GateState,
  gateSettings,
} from "@/registry-audio/bases/base/devices/gate/device";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";
import { createWorkletStage } from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.01;

export interface GateEngine extends EffectEngine<GateState> {
  /** Resolves once the gate is in the graph. Until then the gate stays open. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A gate on the Web Audio API for a `GateState`. The browser has no gate
 * node: it is the audio.js gate in an `AudioWorklet` loaded from a blob, which
 * looks ahead by as much as the look-ahead says:
 *
 * ```
 * input → gate (an AudioWorklet) → gated ─┐
 * input → bypass (until it is ready) ─────┴→ output
 * ```
 *
 * Until the worklet is ready the gate stays open, then the signal fades over
 * to it. Every parameter is set as a value, not a glide, since each makes the
 * model again, which fades it in.
 */
export function createGateEngine(
  ctx: BaseAudioContext,
  initial: GateState
): GateEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();

  let settings = gateSettings(initial);
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () => {
      settings = gateSettings(latest);
      return new AudioWorkletNode(ctx, "audioui-gate", {
        outputChannelCount: [2],
        parameterData: settings.modelParams,
        processorOptions: { model: "noise" },
      });
    },
    ramp: RAMP_SECONDS,
    source: GATE_WORKLET,
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
    ready: stage.ready,
    update: (state) => {
      latest = state;
      settings = gateSettings(state);
      route();
    },
  };
}
