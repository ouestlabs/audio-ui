import type { DeviceBinding, DeviceReadings } from "@audio-ui/core/device";
import {
  COMPANDER_WORKLET,
  type CompanderState,
  companderSettings,
} from "@/registry-audio/bases/base/devices/compander/device";

const RAMP_SECONDS = 0.01;
/** How long after the compander fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface CompanderEngine extends DeviceBinding<CompanderState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** What it is taking off right now, in dB: where its curve is under the straight line of a clean sound. */
  readings: () => DeviceReadings;
  /** Resolves once the compander is in the graph. Until then the sound passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** How many dB it is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the compander into a context once. `false` when the context cannot run worklets. */
function loadCompander(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([COMPANDER_WORKLET], { type: "text/javascript" })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A compander on the Web Audio API for a `CompanderState`:
 *
 * ```
 * input → dry ──────────────────────────────────┐
 *       → compander (an AudioWorklet) → wet ────┴→ output
 * ```
 *
 * The browser has no compander node: the compander is the audio.js one in an
 * `AudioWorklet` loaded from a blob, fed only while it plays. Off, or until
 * it is ready, the sound goes round it, unchanged.
 */
export function createCompanderEngine(
  ctx: BaseAudioContext,
  initial: CompanderState
): CompanderEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;

  let settings = companderSettings(initial);
  let model: AudioWorkletNode | null = null;
  let reduction = 0;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  /** The compander in place of the dry sound while it plays and is loaded, fed only then. */
  const route = () => {
    const playing = model === null ? 0 : settings.wet;
    dry.gain.setTargetAtTime(1 - playing, ctx.currentTime, RAMP_SECONDS);
    wet.gain.setTargetAtTime(playing, ctx.currentTime, RAMP_SECONDS);
    // As values: the ones it reads as it plays change at once, the others make it again, which fades it in.
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    clearTimeout(unfeed);
    if (playing > 0 && !fed && model) {
      input.connect(model);
      fed = true;
    } else if (playing === 0 && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && model) {
          input.disconnect(model);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };

  const ready = loadCompander(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-compander", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "compander" },
    });
    model.port.onmessage = (event: MessageEvent<number>) => {
      reduction = event.data;
    };
    model.connect(wet);
    route();
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      model?.disconnect();
      for (const node of [input, dry, wet, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return settings.wet > 0 ? reduction : 0;
    },
    readings: (): DeviceReadings => ({
      gainReductionDb: settings.wet > 0 ? reduction : 0,
    }),
    ready,
    update: (state) => {
      settings = companderSettings(state);
      route();
    },
  };
}
