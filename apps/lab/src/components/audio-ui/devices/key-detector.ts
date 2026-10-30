import { COMPRESSOR_KEY_WORKLET } from "@/components/audio-ui/devices/compressor/device";

/** The parameters of the detector, by name: each is set with `setValueAtTime` on the node's `parameters`. */
export const KEY_DETECTOR_PARAMETERS = [
  "attack",
  "knee",
  "ratio",
  "release",
  "threshold",
] as const;

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/**
 * Loads the detector of the key into a context once: an `AudioWorklet`
 * registered as `audioui-compressor-key`, which reads a signal and writes the
 * gain a compressor would apply to it. `false` when the context cannot run
 * worklets.
 */
export function loadKeyDetector(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([COMPRESSOR_KEY_WORKLET], { type: "text/javascript" })
  );
  const done = worklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}
