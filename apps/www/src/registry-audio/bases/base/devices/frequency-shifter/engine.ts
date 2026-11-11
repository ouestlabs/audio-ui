import type { EffectEngine } from "@audio-ui/engine/device";
import { loadWorklet } from "@audio-ui/engine/worklet";
import {
  FREQUENCY_SHIFTER_MODES,
  FREQUENCY_SHIFTER_WORKLET,
  type FrequencyShifterState,
  frequencyShifterSettings,
} from "@/registry-audio/bases/base/devices/frequency-shifter/device";

const RAMP_SECONDS = 0.02;

export interface FrequencyShifterEngine
  extends EffectEngine<FrequencyShifterState> {
  /** Resolves once the shifter is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A frequency shifter on the Web Audio API for a `FrequencyShifterState`:
 *
 * ```
 * input → shifter (worklet) → shift ──┐
 *                           → ring ───┴→ output
 *       → clean (until it is ready) ──┘
 * ```
 *
 * The shifter is an `AudioWorklet` loaded from a blob that plays both modes,
 * one output each, each mixing the clean sound in itself; the mode fades one
 * in and the other out. Until it is ready the sound passes clean. Parameters
 * move with `setTargetAtTime`, never `.value =`.
 */
export function createFrequencyShifterEngine(
  ctx: BaseAudioContext,
  initial: FrequencyShifterState
): FrequencyShifterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const clean = ctx.createGain();
  const modes = FREQUENCY_SHIFTER_MODES.map(() => ctx.createGain());
  input.connect(clean).connect(output);
  for (const mode of modes) {
    mode.connect(output);
    mode.gain.value = 0;
  }
  clean.gain.value = 1;

  let shifter: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: FrequencyShifterState) => {
    const settings = frequencyShifterSettings(state);
    // Until the worklet is ready, the sound passes clean.
    follow(clean.gain, shifter ? 0 : 1);
    for (const [index, mode] of modes.entries()) {
      follow(mode.gain, shifter ? (settings.modes[index] ?? 0) : 0);
    }
    if (shifter) {
      const param = (name: string) =>
        shifter?.parameters.get(name) as AudioParam;
      follow(param("shift"), settings.shift);
      follow(param("frequency"), settings.frequency);
      follow(param("mix"), settings.mix);
      // A length, not a level: it changes at once, and the worklet fades it in.
      param("taps").value = settings.taps;
    }
  };

  const ready = loadWorklet(ctx, FREQUENCY_SHIFTER_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = frequencyShifterSettings(latest);
    shifter = new AudioWorkletNode(ctx, "audioui-frequency-shifter", {
      numberOfOutputs: FREQUENCY_SHIFTER_MODES.length,
      outputChannelCount: FREQUENCY_SHIFTER_MODES.map(() => 2),
      parameterData: {
        frequency: settings.frequency,
        mix: settings.mix,
        shift: settings.shift,
        taps: settings.taps,
      },
    });
    input.connect(shifter);
    for (const [index, mode] of modes.entries()) {
      shifter.connect(mode, index);
    }
    apply(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      for (const node of [input, clean, ...modes, output]) {
        node.disconnect();
      }
      shifter?.disconnect();
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
