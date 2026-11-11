import {
  TILT_EQ_WORKLET,
  type TiltEqState,
  tiltEqSettings,
} from "@/registry-audio/bases/base/devices/tilt-eq/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";

const RAMP_SECONDS = 0.02;

export interface TiltEqEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the tilt is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  update: (state: TiltEqState) => void;
}

/**
 * A tilt EQ on the Web Audio API for a `TiltEqState`:
 *
 * ```
 * input → tilt (worklet) → tilted ──┐
 *       → clean ────────────────────┴→ output level → output
 * ```
 *
 * The tilt is an `AudioWorklet` loaded from a blob. Until it is ready the
 * sound passes clean, then it fades over to the tilt. Parameters move with
 * `setTargetAtTime`, never `.value =`.
 */
export function createTiltEqEngine(
  ctx: BaseAudioContext,
  initial: TiltEqState
): TiltEqEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const tilted = ctx.createGain();
  const clean = ctx.createGain();
  const level = ctx.createGain();
  input.connect(clean).connect(level);
  tilted.connect(level);
  level.connect(output);
  tilted.gain.value = 0;
  clean.gain.value = 1;
  level.gain.value = tiltEqSettings(initial).output;

  let tilt: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: TiltEqState) => {
    const settings = tiltEqSettings(state);
    follow(level.gain, settings.output);
    if (tilt) {
      follow(tilt.parameters.get("gain") as AudioParam, settings.gain);
      follow(tilt.parameters.get("pivot") as AudioParam, settings.pivot);
    }
  };

  const ready = loadWorklet(ctx, TILT_EQ_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = tiltEqSettings(latest);
    tilt = new AudioWorkletNode(ctx, "audioui-tilt-eq", {
      outputChannelCount: [2],
      parameterData: { gain: settings.gain, pivot: settings.pivot },
    });
    input.connect(tilt).connect(tilted);
    follow(tilted.gain, 1);
    follow(clean.gain, 0);
    apply(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      for (const node of [input, tilted, clean, level, output]) {
        node.disconnect();
      }
      tilt?.disconnect();
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
