import type { EffectEngine, SidechainBinding } from "@/lib/engine/device";
import { createWorkletStage } from "@/lib/engine/device";
import {
  GATE_WORKLET,
  type GateState,
  gateSettings,
} from "@/components/audio-ui/devices/gate/device";

const RAMP_SECONDS = 0.01;

export interface GateEngine
  extends EffectEngine<GateState>,
    SidechainBinding<GateState, AudioNode> {
  /** Resolves once the gate is in the graph. Until then the gate stays open. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** Connect the key here: it opens and closes the gate in place of the signal. It is only listened to, never heard. With nothing connected, the gate follows the signal itself. */
  readonly sidechain: AudioNode;
}

/**
 * A gate on the Web Audio API for a `GateState`. The browser has no gate
 * node: it is the audio.js gate in an `AudioWorklet` loaded from a blob, which
 * looks ahead by as much as the look-ahead says:
 *
 * ```
 * input → gate (an AudioWorklet) → gated ─┐
 * input → bypass (until it is ready) ─────┴→ output
 * sidechain ↗ (its second input)
 * ```
 *
 * Until the worklet is ready the gate stays open, then the signal fades over
 * to it. Every parameter is set as a value: the gate reads them as it plays,
 * and a new look-ahead makes it again, which fades it in.
 */
export function createGateEngine(
  ctx: BaseAudioContext,
  initial: GateState
): GateEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sidechain = ctx.createGain();

  let settings = gateSettings(initial);
  let latest = initial;
  const stage = createWorkletStage(ctx, {
    input,
    make: () => {
      settings = gateSettings(latest);
      return new AudioWorkletNode(ctx, "audioui-gate", {
        numberOfInputs: 2,
        outputChannelCount: [2],
        parameterData: settings.modelParams,
        processorOptions: { model: "noise" },
      });
    },
    ramp: RAMP_SECONDS,
    source: GATE_WORKLET,
  });
  stage.connect(output);
  const ready = stage.ready.then((ok) => {
    if (ok && stage.node) {
      sidechain.connect(stage.node, 0, 1);
    }
    return ok;
  });

  const route = () => {
    for (const [name, value] of Object.entries(settings.modelParams)) {
      stage.node?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
  };

  return {
    dispose: () => {
      stage.dispose();
      for (const node of [input, sidechain, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready,
    sidechain,
    update: (state) => {
      latest = state;
      settings = gateSettings(state);
      route();
    },
  };
}