import type { DeviceBinding } from "@audio-ui/core/device";
import {
  TRANSIENT_WORKLET,
  type TransientState,
  transientSettings,
} from "@/registry-audio/bases/base/devices/transient/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";

const RAMP_SECONDS = 0.01;

export interface TransientEngine extends DeviceBinding<TransientState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the shaper is in the graph. Until then the signal passes unchanged. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A transient shaper on the Web Audio API for a `TransientState`:
 *
 * ```
 * input → shaper (an AudioWorklet) → shaped → output gain → output
 *       → bypass (until it is ready) ─────────┘
 * ```
 *
 * The shaper is the audio.js transient shaper, loaded from a blob. Until it
 * is ready the signal passes unchanged, then it fades over to the shaper.
 */
export function createTransientEngine(
  ctx: BaseAudioContext,
  initial: TransientState
): TransientEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const bypass = ctx.createGain();
  const shaped = ctx.createGain();
  const master = ctx.createGain();
  input.connect(bypass).connect(master);
  shaped.connect(master);
  master.connect(output);

  let settings = transientSettings(initial);
  master.gain.value = settings.output;
  shaped.gain.value = 0;

  let shaper: AudioWorkletNode | null = null;
  let disposed = false;

  const route = () => {
    for (const [name, value] of Object.entries(settings.modelParams)) {
      shaper?.parameters
        .get(name)
        ?.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
    }
    master.gain.setTargetAtTime(settings.output, ctx.currentTime, RAMP_SECONDS);
  };
  let latest = initial;
  const ready = loadWorklet(ctx, TRANSIENT_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    settings = transientSettings(latest);
    shaper = new AudioWorkletNode(ctx, "audioui-transient", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "shaper" },
    });
    input.connect(shaper);
    shaper.connect(shaped);
    bypass.gain.setTargetAtTime(0, ctx.currentTime, RAMP_SECONDS);
    shaped.gain.setTargetAtTime(1, ctx.currentTime, RAMP_SECONDS);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      shaper?.disconnect();
      for (const node of [input, bypass, shaped, master, output]) {
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
    },
  };
}
