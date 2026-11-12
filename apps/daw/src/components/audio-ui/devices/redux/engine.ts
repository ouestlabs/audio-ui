import type { EffectEngine } from "@audio-ui/engine/device";
import { loadWorklet } from "@audio-ui/engine/worklet";
import {
  REDUX_WORKLET,
  type ReduxState,
  reduxSettings,
  reduxTable,
} from "@/components/audio-ui/devices/redux/device";

const RAMP_SECONDS = 0.015;

export interface ReduxEngine extends EffectEngine<ReduxState> {
  /** Resolves once the sample hold is in the graph. Until then the bits are rounded to the nearest level and the rate is not reduced. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A redux on the Web Audio API for a `ReduxState`:
 *
 * ```
 * input → sample hold (worklet) → quantizer (table) → wet ──┐
 *       → dry ──────────────────────────────────────────────┴→ output
 * ```
 *
 * Rounded to the nearest level, the bits are a `WaveShaperNode` table, rebuilt
 * only when they change. The sample hold is an `AudioWorklet` loaded from a
 * blob, which also rounds a shaped quantizer, the table then out of the way:
 * until it is ready the signal goes straight to the table, shaped or not.
 */
export function createReduxEngine(
  ctx: BaseAudioContext,
  initial: ReduxState
): ReduxEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const pre = ctx.createGain();
  const shaper = ctx.createWaveShaper();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  input.connect(pre).connect(shaper).connect(wet).connect(output);
  input.connect(dry).connect(output);

  let settings = reduxSettings(initial);
  wet.gain.value = settings.wet;
  dry.gain.value = settings.dry;

  let hold: AudioWorkletNode | null = null;
  let disposed = false;
  /** What the table holds: the bits it rounds to, or nothing when the worklet shapes them. */
  let tabled: number | null = Number.NaN;
  const table = () => {
    const wanted = settings.shaped && hold ? null : settings.bits;
    if (wanted !== tabled) {
      tabled = wanted;
      shaper.curve = wanted === null ? null : reduxTable(wanted);
    }
  };
  table();

  const ready = loadWorklet(ctx, REDUX_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    hold = new AudioWorkletNode(ctx, "audioui-redux", {
      parameterData: { bits: settings.bits, hold: settings.hold },
      processorOptions: { shaped: settings.shaped },
    });
    pre.disconnect(shaper);
    pre.connect(hold).connect(shaper);
    table();
    return true;
  });

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      disposed = true;
      for (const node of [input, pre, shaper, wet, dry, output]) {
        node.disconnect();
      }
      hold?.disconnect();
    },
    input,
    output,
    ready,
    update: (state) => {
      const { shaped } = settings;
      settings = reduxSettings(state);
      if (hold && settings.shaped !== shaped) {
        hold.port.postMessage({ shaped: settings.shaped });
      }
      table();
      hold?.parameters
        .get("hold")
        ?.setValueAtTime(settings.hold, ctx.currentTime);
      hold?.parameters
        .get("bits")
        ?.setValueAtTime(settings.bits, ctx.currentTime);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
    },
  };
}
