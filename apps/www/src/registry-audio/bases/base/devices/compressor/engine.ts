import type { DeviceReadings, EffectEngine } from "@audio-ui/engine/device";
import { loadWorklet } from "@audio-ui/engine/worklet";
import {
  COMPRESSOR_MODELS_WORKLET,
  type CompressorState,
  compressorSettings,
} from "@/registry-audio/bases/base/devices/compressor/device";

/** How fast a parameter follows a change, as a time constant in seconds: fast enough to feel direct, slow enough not to click. */
const RAMP_SECONDS = 0.01;

export interface CompressorEngine extends EffectEngine<CompressorState> {
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the model is in the graph. Until then the signal passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the compressor is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

/**
 * A compressor on the Web Audio API for a `CompressorState`:
 *
 * ```
 * input → dry ──────────────────────────────────────────────┐
 *       → model (an AudioWorklet) → make-up → compressed ───┴→ output
 * ```
 *
 * The model is an `AudioWorklet` of the audio.js processors, the model sent by
 * message, the make-up after it. Until it is ready the signal passes
 * unchanged. Parameters move with `setTargetAtTime`, except the model's own,
 * which are values: a change that makes a model again is faded in by the
 * worklet. What goes on each node comes from `compressorSettings`, which is
 * pure and tested.
 */
export function createCompressorEngine(
  ctx: BaseAudioContext,
  initial: CompressorState
): CompressorEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const modelTrim = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(output);
  modelTrim.connect(wet).connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;

  let model: AudioWorkletNode | null = null;
  let modelReduction = 0;
  let latest = initial;
  let current = compressorSettings(initial);
  let sentModel = initial.model;
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const update = (state: CompressorState) => {
    latest = state;
    current = compressorSettings(state);
    if (!model) {
      return;
    }
    for (const [name, value] of Object.entries(current.modelParams)) {
      model.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    if (state.model !== sentModel) {
      sentModel = state.model;
      model.port.postMessage({ model: state.model });
    }
    follow(modelTrim.gain, 10 ** (current.modelTrimDb / 20));
    follow(wet.gain, current.wet);
    follow(dry.gain, current.dry);
  };

  const ready = loadWorklet(ctx, COMPRESSOR_MODELS_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-compressor-models", {
      outputChannelCount: [2],
      parameterData: current.modelParams,
      processorOptions: { model: sentModel },
    });
    model.port.onmessage = (event: MessageEvent<number>) => {
      modelReduction = event.data;
    };
    input.connect(model);
    model.connect(modelTrim);
    update(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      model?.disconnect();
      for (const node of [input, dry, modelTrim, wet, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return modelReduction;
    },
    readings: (): DeviceReadings => ({ gainReductionDb: modelReduction }),
    ready,
    update,
  };
}
