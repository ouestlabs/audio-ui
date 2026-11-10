import type { DeviceBinding } from "@audio-ui/core/device";
import {
  UNLIMITER_WORKLET,
  type UnlimiterState,
  unlimiterSettings,
} from "@/registry-audio/bases/base/devices/unlimiter/device";

const RAMP_SECONDS = 0.01;
/** How long after the unlimiter fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface UnlimiterEngine extends DeviceBinding<UnlimiterState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the unlimiter is in the graph. Until then the sound passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the unlimiter into a context once. `false` when the context cannot run worklets. */
function loadUnlimiter(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([UNLIMITER_WORKLET], { type: "text/javascript" })
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
 * An unlimiter on the Web Audio API for an `UnlimiterState`:
 *
 * ```
 * input → dry ──────────────────────────────────┐
 *       → unlimiter (an AudioWorklet) → wet ────┴→ output
 * ```
 *
 * The browser has no unlimiter node: the unlimiter is the audio.js de-limiter in an
 * `AudioWorklet` loaded from a blob, fed only while it plays. Off, or until
 * it is ready, the sound goes round it, unchanged.
 */
export function createUnlimiterEngine(
  ctx: BaseAudioContext,
  initial: UnlimiterState
): UnlimiterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  dry.gain.value = 1;
  wet.gain.value = 0;

  let settings = unlimiterSettings(initial);
  let model: AudioWorkletNode | null = null;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  /** The unlimiter in place of the dry sound while it plays and is loaded, fed only then. */
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

  const ready = loadUnlimiter(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    model = new AudioWorkletNode(ctx, "audioui-unlimiter", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "unlimiter" },
    });
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
    ready,
    update: (state) => {
      settings = unlimiterSettings(state);
      route();
    },
  };
}
