import type { DeviceBinding } from "@audio-ui/core/device";
import {
  LOOKAHEAD_SECONDS,
  TRANSIENT_WORKLET,
  type TransientState,
  transientSettings,
} from "@/registry-audio/bases/base/lib/transient-device";

const RAMP_SECONDS = 0.01;

export interface TransientEngine extends DeviceBinding<TransientState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the detector is in the graph. Until then the signal passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the detector into a context once. `false` when the context cannot run worklets. */
function loadDetector(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([TRANSIENT_WORKLET], { type: "text/javascript" })
  );
  const done = worklet
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
 *       → delay (the look-ahead) → shaping gain → output gain → output
 * ```
 *
 * The detector reads the signal as it arrives and the audio waits a
 * millisecond, so the gain is up by the time a hit has gone through the delay.
 * Until the detector is ready the signal passes.
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
  input.connect(delay).connect(shaping).connect(master).connect(output);

  let settings = transientSettings(initial);
  master.gain.value = settings.output;
  shaping.gain.value = 1;

  let detector: AudioWorkletNode | null = null;
  let disposed = false;
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
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      detector?.disconnect();
      for (const node of [input, delay, shaping, master, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready,
    update: (state) => {
      settings = transientSettings(state);
      master.gain.setTargetAtTime(
        settings.output,
        ctx.currentTime,
        RAMP_SECONDS
      );
      setDetector(ctx.currentTime);
    },
  };
}
