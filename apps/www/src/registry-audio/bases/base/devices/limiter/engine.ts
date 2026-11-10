import type { DeviceReadings } from "@audio-ui/core/device";
import {
  LIMITER_WORKLET,
  type LimiterState,
  limiterSettings,
} from "@/registry-audio/bases/base/devices/limiter/device";

const RAMP_SECONDS = 0.01;
/** How long after the look-ahead model fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the look-ahead model into a context once. `false` when the context cannot run worklets. */
function loadModel(ctx: BaseAudioContext): Promise<boolean> {
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
  /** Resolves once the look-ahead model is in the graph. Until then the clean model plays for it. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB the limiter is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
  update: (state: LimiterState) => void;
}

/**
 * A limiter on the Web Audio API for a `LimiterState`:
 *
 * ```
 * input → gain → compressor (ratio 20, no knee) → trim → clip → wet ──┐
 *            └→ look-ahead model (an AudioWorklet) → model wet ───────┤
 *       → bypass ─────────────────────────────────────────────────────┴→ output
 * ```
 *
 * The clean model is the node. It adds a make-up of its own that cannot be
 * turned off: the trim takes it back out. A ratio of 20 is not a wall: a loud
 * enough signal still gets over the ceiling, so a final hard clip, oversampled
 * 4x, guarantees that no sample is above it. That is a sample peak, not an
 * inter-sample (true) peak. The look-ahead model is the audio.js limiter in
 * an `AudioWorklet` loaded from a blob, fed only while it plays: until it is
 * ready, the clean model plays for it. Off, the signal goes round both.
 */
export function createLimiterEngine(
  ctx: BaseAudioContext,
  initial: LimiterState
): LimiterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const gain = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  const trim = ctx.createGain();
  const scale = ctx.createGain();
  const clip = ctx.createWaveShaper();
  const unscale = ctx.createGain();
  const wet = ctx.createGain();
  const bypass = ctx.createGain();
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0;
  // Two points, the line from -1 to 1: a value past either end is held at it.
  clip.curve = new Float32Array([-1, 1]);
  clip.oversample = "4x";
  input
    .connect(gain)
    .connect(limiter)
    .connect(trim)
    .connect(scale)
    .connect(clip)
    .connect(unscale)
    .connect(wet)
    .connect(output);
  input.connect(bypass).connect(output);
  const modelWet = ctx.createGain();
  modelWet.connect(output);

  const first = limiterSettings(initial);
  gain.gain.value = first.gain;
  limiter.threshold.value = first.threshold;
  limiter.release.value = first.release;
  trim.gain.value = first.trim;
  scale.gain.value = 1 / first.ceiling;
  unscale.gain.value = first.ceiling;
  // Until the model is ready, the node plays for it.
  wet.gain.value = first.wet + first.modelWet;
  bypass.gain.value = 1 - first.wet - first.modelWet;
  modelWet.gain.value = 0;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  let model: AudioWorkletNode | null = null;
  let modelReduction = 0;
  let current = first;
  let latest = initial;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  const update = (state: LimiterState) => {
    const settings = limiterSettings(state);
    current = settings;
    const modeled = model === null ? 0 : settings.modelWet;
    follow(gain.gain, settings.gain);
    follow(limiter.threshold, settings.threshold);
    follow(limiter.release, settings.release);
    follow(trim.gain, settings.trim);
    follow(scale.gain, 1 / settings.ceiling);
    follow(unscale.gain, settings.ceiling);
    follow(wet.gain, settings.wet + settings.modelWet - modeled);
    follow(modelWet.gain, modeled);
    follow(bypass.gain, 1 - settings.wet - settings.modelWet);
    // As values, not glides: every one makes the model again, which fades it in.
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    clearTimeout(unfeed);
    if (modeled > 0 && !fed && model) {
      gain.connect(model);
      fed = true;
    } else if (modeled === 0 && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && model) {
          gain.disconnect(model);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };

  const ready = loadModel(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-limiter", {
      outputChannelCount: [2],
      parameterData: current.modelParams,
      processorOptions: { model: "lookahead" },
    });
    model.port.onmessage = (event: MessageEvent<number>) => {
      modelReduction = event.data;
    };
    model.connect(modelWet);
    update(latest);
    return true;
  });

  const reductionNow = () =>
    model && current.modelWet > 0 ? modelReduction : limiter.reduction;

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      model?.disconnect();
      for (const node of [
        modelWet,
        input,
        gain,
        limiter,
        trim,
        scale,
        clip,
        unscale,
        wet,
        bypass,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return reductionNow();
    },
    readings: (): DeviceReadings => ({ gainReductionDb: reductionNow() }),
    ready,
    update: (state) => {
      latest = state;
      update(state);
    },
  };
}
