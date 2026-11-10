import type { DeviceBinding } from "@audio-ui/core/device";
import {
  LOOKAHEAD_SECONDS,
  TRANSIENT_FOLLOWER_WORKLET,
  TRANSIENT_WORKLET,
  type TransientState,
  transientSettings,
} from "@/components/audio-ui/devices/transient/device";

const RAMP_SECONDS = 0.01;
/** How long after the follower model fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface TransientEngine extends DeviceBinding<TransientState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the detector and the follower model are in the graph. Until then the signal passes unchanged, and the clean model plays for the other. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the detector and the follower model into a context once. `false` when the context cannot run worklets. */
function loadDetector(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([TRANSIENT_WORKLET, TRANSIENT_FOLLOWER_WORKLET], {
      type: "text/javascript",
    })
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
 * A transient shaper on the Web Audio API for a `TransientState`:
 *
 * ```
 * input → detector (an AudioWorklet) → the shaping gain's own gain
 *       → delay (the look-ahead) → shaping gain → clean ───────────────────┐
 *                              → follower model (an AudioWorklet) → model wet ┴→ output gain → output
 * ```
 *
 * The clean model's detector reads the signal as it arrives and the audio
 * waits a millisecond, so the gain is up by the time a hit has gone through
 * the delay. Until the detector is ready the signal passes. The follower
 * model is the audio.js transient shaper, fed from the delay so the latency
 * is the same for both, and only while it plays: until it is ready, the
 * clean model plays for it.
 */
export function createTransientEngine(
  ctx: BaseAudioContext,
  initial: TransientState
): TransientEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const delay = ctx.createDelay(LOOKAHEAD_SECONDS * 4);
  const shaping = ctx.createGain();
  const master = ctx.createGain();
  delay.delayTime.value = LOOKAHEAD_SECONDS;
  const clean = ctx.createGain();
  const modelWet = ctx.createGain();
  input.connect(delay).connect(shaping).connect(clean).connect(master);
  master.connect(output);
  modelWet.connect(master);

  let settings = transientSettings(initial);
  master.gain.value = settings.output;
  shaping.gain.value = 1;
  modelWet.gain.value = 0;

  let detector: AudioWorkletNode | null = null;
  let model: AudioWorkletNode | null = null;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;
  let latest = initial;

  /** The follower model in place of the clean one while it plays and is loaded, fed only then. */
  const route = () => {
    const modeled = model === null ? 0 : settings.modelWet;
    clean.gain.setTargetAtTime(1 - modeled, ctx.currentTime, RAMP_SECONDS);
    modelWet.gain.setTargetAtTime(modeled, ctx.currentTime, RAMP_SECONDS);
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters
        .get(name)
        ?.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
    }
    clearTimeout(unfeed);
    if (modeled > 0 && !fed && model) {
      delay.connect(model);
      fed = true;
    } else if (modeled === 0 && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && model) {
          delay.disconnect(model);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };
  const setDetector = (time: number) => {
    detector?.parameters.get("attack")?.setValueAtTime(settings.attack, time);
    detector?.parameters.get("sustain")?.setValueAtTime(settings.sustain, time);
  };
  const ready = loadDetector(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    detector = new AudioWorkletNode(ctx, "audioui-transient", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    setDetector(0);
    input.connect(detector);
    shaping.gain.value = 0;
    detector.connect(shaping.gain);
    model = new AudioWorkletNode(ctx, "audioui-transient-follower", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "follower" },
    });
    model.connect(modelWet);
    settings = transientSettings(latest);
    route();
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      detector?.disconnect();
      model?.disconnect();
      for (const node of [
        input,
        delay,
        shaping,
        clean,
        modelWet,
        master,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      settings = transientSettings(state);
      route();
      master.gain.setTargetAtTime(
        settings.output,
        ctx.currentTime,
        RAMP_SECONDS
      );
      setDetector(ctx.currentTime);
    },
  };
}