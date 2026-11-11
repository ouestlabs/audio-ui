import {
  LOFI_WORKLET,
  type LofiState,
  lofiSettings,
} from "@/registry-audio/bases/base/devices/lofi/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.02;

export interface LofiEngine extends EffectEngine<LofiState> {
  /** Resolves once the lo-fi is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A lo-fi on the Web Audio API for a `LofiState`:
 *
 * ```
 * input → lo-fi (worklet) → wet ──┐
 *       → dry ────────────────────┴→ output
 * ```
 *
 * The lo-fi is an `AudioWorklet` loaded from a blob. Until it is ready, and
 * off, the sound goes round it, clean. Parameters move with
 * `setTargetAtTime`, never `.value =`.
 */
export function createLofiEngine(
  ctx: BaseAudioContext,
  initial: LofiState
): LofiEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  wet.gain.value = 0;
  dry.gain.value = 1;

  let lofi: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: LofiState) => {
    const settings = lofiSettings(state);
    const playing = lofi !== null;
    follow(wet.gain, playing ? settings.wet : 0);
    follow(dry.gain, playing ? settings.dry : 1);
    if (lofi) {
      const param = (name: string) => lofi?.parameters.get(name) as AudioParam;
      follow(param("wow"), settings.wow);
      follow(param("flutter"), settings.flutter);
      follow(param("noise"), settings.noise);
      follow(param("crackle"), settings.crackle);
      follow(param("lowpass"), settings.lowpass);
      follow(param("highpass"), settings.highpass);
      follow(param("drive"), settings.drive);
    }
  };

  const ready = loadWorklet(ctx, LOFI_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = lofiSettings(latest);
    lofi = new AudioWorkletNode(ctx, "audioui-lofi", {
      parameterData: {
        crackle: settings.crackle,
        drive: settings.drive,
        flutter: settings.flutter,
        highpass: settings.highpass,
        lowpass: settings.lowpass,
        noise: settings.noise,
        wow: settings.wow,
      },
    });
    input.connect(lofi).connect(wet);
    apply(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      for (const node of [input, wet, dry, output]) {
        node.disconnect();
      }
      lofi?.disconnect();
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
