import type { DeviceBinding } from "@audio-ui/engine/device";
import {
  GATE_WORKLET,
  type GateState,
  gateSettings,
} from "@/components/audio-ui/devices/gate/device";

const RAMP_SECONDS = 0.01;

export interface GateEngine extends DeviceBinding<GateState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the gate is in the graph. Until then the gate stays open. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the gate into a context once. `false` when the context cannot run worklets. */
function loadGate(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([GATE_WORKLET], { type: "text/javascript" })
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
 * A gate on the Web Audio API for a `GateState`. The browser has no gate
 * node: it is the audio.js gate in an `AudioWorklet` loaded from a blob, which
 * looks ahead by as much as the look-ahead says:
 *
 * ```
 * input → gate (an AudioWorklet) → gated ─┐
 * input → bypass (until it is ready) ─────┴→ output
 * ```
 *
 * Until the worklet is ready the gate stays open, then the signal fades over
 * to it. Every parameter is set as a value, not a glide, since each makes the
 * model again, which fades it in.
 */
export function createGateEngine(
  ctx: BaseAudioContext,
  initial: GateState
): GateEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const bypass = ctx.createGain();
  const gated = ctx.createGain();
  input.connect(bypass).connect(output);
  gated.connect(output);
  gated.gain.value = 0;

  let model: AudioWorkletNode | null = null;
  let settings = gateSettings(initial);
  let latest = initial;
  let disposed = false;

  const route = () => {
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
  };

  const ready = loadGate(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    settings = gateSettings(latest);
    model = new AudioWorkletNode(ctx, "audioui-gate", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "noise" },
    });
    input.connect(model);
    model.connect(gated);
    bypass.gain.setTargetAtTime(0, ctx.currentTime, RAMP_SECONDS);
    gated.gain.setTargetAtTime(1, ctx.currentTime, RAMP_SECONDS);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      model?.disconnect();
      for (const node of [input, bypass, gated, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      settings = gateSettings(state);
      route();
    },
  };
}
