import type { DeviceBinding } from "@audio-ui/core/device";
import {
  COMPRESSOR_LOOKAHEAD_SECONDS,
  type CompressorState,
  compressorSettings,
} from "@/registry-audio/bases/base/lib/compressor-device";

/** How fast a parameter follows a change, as a time constant in seconds: fast enough to feel direct, slow enough not to click. */
const RAMP_SECONDS = 0.01;

export interface CompressorEngine extends DeviceBinding<CompressorState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** How many dB the compressor is taking off right now, 0 or negative. Read it per frame. */
  readonly reduction: number;
}

/**
 * A compressor on the Web Audio API for a `CompressorState`:
 *
 * ```
 * input → delay (the node's lookahead) → dry ───────────────┐
 *       → DynamicsCompressorNode → trim → wet ──────────────┴→ output
 * ```
 *
 * The dry path waits as long as the node looks ahead, so a mix of the two
 * does not comb. Parameters move with `setTargetAtTime`, never `.value =`,
 * so a knob turned while it plays does not click. What goes on each node
 * comes from `compressorSettings`, which is pure and tested.
 */
export function createCompressorEngine(
  ctx: BaseAudioContext,
  initial: CompressorState
): CompressorEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  const lookahead = ctx.createDelay(COMPRESSOR_LOOKAHEAD_SECONDS * 4);
  const dry = ctx.createGain();
  const trim = ctx.createGain();
  const wet = ctx.createGain();
  lookahead.delayTime.value = COMPRESSOR_LOOKAHEAD_SECONDS;

  input.connect(lookahead).connect(dry).connect(output);
  input.connect(compressor).connect(trim).connect(wet).connect(output);

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const update = (state: CompressorState) => {
    const settings = compressorSettings(state);
    follow(compressor.threshold, settings.threshold);
    follow(compressor.ratio, settings.ratio);
    follow(compressor.knee, settings.knee);
    follow(compressor.attack, settings.attack);
    follow(compressor.release, settings.release);
    follow(trim.gain, 10 ** (settings.trimDb / 20));
    follow(dry.gain, settings.dry);
    follow(wet.gain, settings.wet);
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
  const first = compressorSettings(initial);
  compressor.threshold.value = first.threshold;
  compressor.ratio.value = first.ratio;
  compressor.knee.value = first.knee;
  compressor.attack.value = first.attack;
  compressor.release.value = first.release;
  trim.gain.value = 10 ** (first.trimDb / 20);
  dry.gain.value = first.dry;
  wet.gain.value = first.wet;

  return {
    dispose: () => {
      for (const node of [
        input,
        lookahead,
        dry,
        compressor,
        trim,
        wet,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    get reduction() {
      return compressor.reduction;
    },
    update,
  };
}
