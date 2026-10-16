import {
  type UtilityState,
  utilitySettings,
} from "@/registry-audio/bases/base/lib/utility-device";

const RAMP_SECONDS = 0.015;
const HALF = 0.5;

export interface UtilityEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: UtilityState) => void;
}

/**
 * A utility on the Web Audio API for a `UtilityState`:
 *
 * ```
 * input → split → mid = (L + R) / 2 ───────────────┐
 *               → side = (L - R) / 2 → width ──────┴→ L = mid + side, R = mid - side
 *                                                     → merge → pan → gain → output
 * ```
 *
 * The width scales the side signal: 0 is mono, 1 is the input as it is, 2 is
 * twice as wide. A mono input is spread to both sides first.
 */
export function createUtilityEngine(
  ctx: BaseAudioContext,
  initial: UtilityState
): UtilityEngine {
  const input = ctx.createGain();
  input.channelCount = 2;
  input.channelCountMode = "explicit";
  input.channelInterpretation = "speakers";
  const output = ctx.createGain();
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  const mid = ctx.createGain();
  const sideFromLeft = ctx.createGain();
  const sideFromRight = ctx.createGain();
  const width = ctx.createGain();
  const widthInverted = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const level = ctx.createGain();
  mid.gain.value = HALF;
  sideFromLeft.gain.value = HALF;
  sideFromRight.gain.value = -HALF;
  widthInverted.gain.value = -1;

  input.connect(split);
  split.connect(mid, 0);
  split.connect(mid, 1);
  split.connect(sideFromLeft, 0);
  split.connect(sideFromRight, 1);
  sideFromLeft.connect(width);
  sideFromRight.connect(width);
  mid.connect(merge, 0, 0);
  mid.connect(merge, 0, 1);
  width.connect(merge, 0, 0);
  width.connect(widthInverted);
  widthInverted.connect(merge, 0, 1);
  merge.connect(pan).connect(level).connect(output);

  const first = utilitySettings(initial);
  width.gain.value = first.width;
  pan.pan.value = first.pan;
  level.gain.value = first.gain;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [
        input,
        split,
        mid,
        sideFromLeft,
        sideFromRight,
        width,
        widthInverted,
        merge,
        pan,
        level,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      const settings = utilitySettings(state);
      follow(width.gain, settings.width);
      follow(pan.pan, settings.pan);
      follow(level.gain, settings.gain);
    },
  };
}
