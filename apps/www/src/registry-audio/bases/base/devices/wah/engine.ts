import type { DeviceContext } from "@audio-ui/core/device";
import { DEFAULT_TEMPO } from "@audio-ui/core/time";
import {
  WAH_MODES,
  WAH_WORKLET,
  type WahState,
  wahSettings,
} from "@/registry-audio/bases/base/devices/wah/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.02;

export interface WahEngine extends EffectEngine<WahState> {
  /** Resolves once the wah is in the graph. Until then the sound passes clean. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A wah on the Web Audio API for a `WahState`:
 *
 * ```
 * input → wah (worklet) → envelope ─┐
 *                       → sweep ────┼→ wet ──┐
 *                       → pedal ────┘        │
 *       → dry ───────────────────────────────┴→ output level → output
 * ```
 *
 * The wah is an `AudioWorklet` loaded from a blob that plays every mode, one
 * output each; the mode fades one in and the others out, so a change of mode
 * does not click. Until it is ready the sound passes clean. Parameters move
 * with `setTargetAtTime`, never `.value =`.
 */
export function createWahEngine(
  ctx: BaseAudioContext,
  initial: WahState,
  context?: DeviceContext
): WahEngine {
  let tempo = context?.tempo ?? DEFAULT_TEMPO;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const level = ctx.createGain();
  const modes = WAH_MODES.map(() => ctx.createGain());
  input.connect(dry).connect(level);
  for (const mode of modes) {
    mode.connect(wet);
  }
  wet.connect(level).connect(output);
  const first = wahSettings(initial, tempo);
  dry.gain.value = 1;
  wet.gain.value = 0;
  level.gain.value = first.output;
  modes.forEach((mode, index) => {
    mode.gain.value = first.modes[index] ?? 0;
  });

  let wah: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const apply = (state: WahState) => {
    const settings = wahSettings(state, tempo);
    // Until the worklet is ready, the sound passes clean.
    follow(dry.gain, wah ? settings.dry : 1);
    follow(wet.gain, wah ? settings.wet : 0);
    follow(level.gain, settings.output);
    for (const [index, mode] of modes.entries()) {
      follow(mode.gain, settings.modes[index] ?? 0);
    }
    if (wah) {
      const param = (name: string) => wah?.parameters.get(name) as AudioParam;
      follow(param("frequency"), settings.frequency);
      follow(param("range"), settings.range);
      follow(param("q"), settings.q);
      follow(param("attack"), settings.attack);
      follow(param("release"), settings.release);
      follow(param("sensitivity"), settings.sensitivity);
      follow(param("rate"), settings.rate);
      follow(param("depth"), settings.depth);
    }
  };

  const ready = loadWorklet(ctx, WAH_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = wahSettings(latest, tempo);
    wah = new AudioWorkletNode(ctx, "audioui-wah", {
      numberOfOutputs: WAH_MODES.length,
      outputChannelCount: WAH_MODES.map(() => 2),
      parameterData: {
        attack: settings.attack,
        depth: settings.depth,
        frequency: settings.frequency,
        q: settings.q,
        range: settings.range,
        rate: settings.rate,
        release: settings.release,
        sensitivity: settings.sensitivity,
      },
    });
    input.connect(wah);
    for (const [index, mode] of modes.entries()) {
      wah.connect(mode, index);
    }
    apply(latest);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      for (const node of [input, dry, wet, level, ...modes, output]) {
        node.disconnect();
      }
      wah?.disconnect();
    },
    input,
    output,
    ready,
    update: (state, next) => {
      tempo = next?.tempo ?? tempo;
      latest = state;
      apply(state);
    },
  };
}
