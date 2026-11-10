import {
  BINAURAL_PANNER_WORKLET,
  type BinauralPannerState,
  binauralPannerSettings,
} from "@/components/audio-ui/devices/binaural-panner/device";

const RAMP_SECONDS = 0.02;

export interface BinauralPannerEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the panner is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: BinauralPannerState) => void;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the binaural panner into a context once. `false` when the context cannot run worklets. */
function loadBinauralPanner(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([BINAURAL_PANNER_WORKLET], { type: "text/javascript" })
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
 * A binaural panner on the Web Audio API for a `BinauralPannerState`:
 *
 * ```
 * input → panner (worklet) → processed ───┐
 *       → clean (until it is ready) ─────┴→ output
 * ```
 *
 * The panner is an `AudioWorklet` loaded from a blob, the kernel playing the
 * whole sound. A direction is sent unwrapped, as the angle nearest the last
 * one, so a turn across the back goes the short way round, not through the
 * front. Until it is ready the sound passes clean, then it fades over.
 * Parameters move with `setTargetAtTime`, never `.value =`.
 */
export function createBinauralPannerEngine(
  ctx: BaseAudioContext,
  initial: BinauralPannerState
): BinauralPannerEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const processed = ctx.createGain();
  const clean = ctx.createGain();
  input.connect(clean).connect(output);
  processed.connect(output);
  processed.gain.value = 0;
  clean.gain.value = 1;

  let node: AudioWorkletNode | null = null;
  let latest = initial;
  let { azimuth } = binauralPannerSettings(initial);
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: BinauralPannerState) => {
    if (!node) {
      return;
    }
    const settings = binauralPannerSettings(state);
    for (const [name, value] of Object.entries(settings)) {
      if (name !== "azimuth") {
        follow(node.parameters.get(name) as AudioParam, value);
      }
    }
    // The nearest turn of the same direction to the last one sent.
    azimuth += ((((settings.azimuth - azimuth) % 360) + 540) % 360) - 180;
    follow(node.parameters.get("azimuth") as AudioParam, azimuth);
  };

  const ready = loadBinauralPanner(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    node = new AudioWorkletNode(ctx, "audioui-binaural-panner", {
      outputChannelCount: [2],
      parameterData: binauralPannerSettings(latest),
    });
    input.connect(node).connect(processed);
    follow(processed.gain, 1);
    follow(clean.gain, 0);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      for (const each of [input, processed, clean, output]) {
        each.disconnect();
      }
      node?.disconnect();
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      apply(state);
    },
  };
}