import type { DeviceBinding, DeviceReadings } from "@audio-ui/engine/device";
import {
  DEESSER_WORKLET,
  type DeesserState,
  deesserSettings,
} from "@/components/audio-ui/devices/deesser/device";

const RAMP_SECONDS = 0.01;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the de-esser into a context once. `false` when the context cannot run worklets. */
function loadDeesser(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([DEESSER_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

export interface DeesserEngine extends DeviceBinding<DeesserState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
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
  const bypass = ctx.createGain();
  const deessed = ctx.createGain();
  input.connect(bypass).connect(output);
  deessed.connect(output);
  deessed.gain.value = 0;

  let settings = deesserSettings(initial);
  let model: AudioWorkletNode | null = null;
  let reduction = 0;
  let disposed = false;
  let latest = initial;

  const route = () => {
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
  };
  const ready = loadDeesser(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    settings = deesserSettings(latest);
    model = new AudioWorkletNode(ctx, "audioui-deesser", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "deesser" },
    });
    model.port.onmessage = (event: MessageEvent<number>) => {
      reduction = event.data;
    };
    input.connect(model);
    model.connect(deessed);
    bypass.gain.setTargetAtTime(0, ctx.currentTime, RAMP_SECONDS);
    deessed.gain.setTargetAtTime(1, ctx.currentTime, RAMP_SECONDS);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      model?.disconnect();
      for (const node of [input, bypass, deessed, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return reduction;
    },
    readings: (): DeviceReadings => ({ gainReductionDb: reduction }),
    ready,
    update: (state) => {
      latest = state;
      settings = deesserSettings(state);
      route();
    },
  };
}
