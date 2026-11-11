import type { DeviceReadings } from "@audio-ui/engine/device";
import {
  LIMITER_WORKLET,
  type LimiterState,
  limiterSettings,
} from "@/components/audio-ui/devices/limiter/device";

const RAMP_SECONDS = 0.01;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the limiter into a context once. `false` when the context cannot run worklets. */
function loadLimiter(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([LIMITER_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

export interface LimiterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What it is taking off right now, in dB. */
  readings: () => DeviceReadings;
  /** Resolves once the limiter is in the graph. Until then the signal passes at the input gain. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the limiter is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  update: (state: LimiterState) => void;
}

/**
 * A limiter on the Web Audio API for a `LimiterState`:
 *
 * ```
 * input → gain → limiter (an AudioWorklet) → limited ─┐
 *            └→ bypass (until it is ready, or off) ───┴→ output
 * ```
 *
 * The limiter is the audio.js one, loaded from a blob. Until it is ready the
 * signal passes at the input gain, then it fades over to the limiter. Off, the
 * signal goes round it. Every parameter is set as a value, not a glide, since
 * each makes the model again, which fades it in.
 */
export function createLimiterEngine(
  ctx: BaseAudioContext,
  initial: LimiterState
): LimiterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const gain = ctx.createGain();
  const bypass = ctx.createGain();
  const limited = ctx.createGain();
  input.connect(gain).connect(bypass).connect(output);
  limited.connect(output);

  let current = limiterSettings(initial);
  let latest = initial;
  gain.gain.value = current.gain;
  limited.gain.value = 0;

  let model: AudioWorkletNode | null = null;
  let modelReduction = 0;
  let disposed = false;

  const update = (state: LimiterState) => {
    current = limiterSettings(state);
    gain.gain.setTargetAtTime(current.gain, ctx.currentTime, RAMP_SECONDS);
    // Off, the signal goes round the limiter.
    const active = model === null ? 0 : current.wet;
    bypass.gain.setTargetAtTime(1 - active, ctx.currentTime, RAMP_SECONDS);
    limited.gain.setTargetAtTime(active, ctx.currentTime, RAMP_SECONDS);
    for (const [name, value] of Object.entries(current.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
  };

  const ready = loadLimiter(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-limiter", {
      outputChannelCount: [2],
      parameterData: current.modelParams,
      processorOptions: { model: "brickwall" },
    });
    model.port.onmessage = (event: MessageEvent<number>) => {
      modelReduction = event.data;
    };
    gain.connect(model);
    model.connect(limited);
    update(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      model?.disconnect();
      for (const node of [input, gain, bypass, limited, output]) {
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
    update: (state) => {
      latest = state;
      update(state);
    },
  };
}
