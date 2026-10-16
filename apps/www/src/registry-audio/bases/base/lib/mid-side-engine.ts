import { toWebAudioQ } from "@audio-ui/core/analysis";
import type { DeviceBinding } from "@audio-ui/core/device";
import {
  type MidSideState,
  midSideSettings,
} from "@/registry-audio/bases/base/lib/mid-side-device";

const RAMP_SECONDS = 0.015;
const HALF = 0.5;

export interface MidSideEngine extends DeviceBinding<MidSideState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

/**
 * A mid/side device on the Web Audio API for a `MidSideState`:
 *
 * ```
 * input → split → mid = (L + R) / 2 → mid level ───────────────┐
 *               → side = (L - R) / 2 → high-pass → side level ──┴→ L = mid + side, R = mid - side → merge → output
 * ```
 *
 * The high-pass on the side is bass mono: what is under it has no side, so it
 * sits in the centre. A mono input is spread to both sides first.
 */
export function createMidSideEngine(
  ctx: BaseAudioContext,
  initial: MidSideState
): MidSideEngine {
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
  const bass = ctx.createBiquadFilter();
  const midLevel = ctx.createGain();
  const sideLevel = ctx.createGain();
  const sideInverted = ctx.createGain();
  bass.type = "highpass";
  // The node takes the Q of a high-pass in dB: this is the Butterworth one, -3 dB, with no bump.
  bass.Q.value = toWebAudioQ("lowcut", Math.SQRT1_2);
  mid.gain.value = HALF;
  sideFromLeft.gain.value = HALF;
  sideFromRight.gain.value = -HALF;
  sideInverted.gain.value = -1;

  input.connect(split);
  split.connect(mid, 0);
  split.connect(mid, 1);
  split.connect(sideFromLeft, 0);
  split.connect(sideFromRight, 1);
  mid.connect(midLevel);
  sideFromLeft.connect(bass);
  sideFromRight.connect(bass);
  bass.connect(sideLevel);
  midLevel.connect(merge, 0, 0);
  midLevel.connect(merge, 0, 1);
  sideLevel.connect(merge, 0, 0);
  sideLevel.connect(sideInverted);
  sideInverted.connect(merge, 0, 1);
  merge.connect(output);

  const first = midSideSettings(initial);
  midLevel.gain.value = first.mid;
  sideLevel.gain.value = first.side;
  bass.frequency.value = first.bassHz;

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
        bass,
        midLevel,
        sideLevel,
        sideInverted,
        merge,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      const settings = midSideSettings(state);
      follow(midLevel.gain, settings.mid);
      follow(sideLevel.gain, settings.side);
      follow(bass.frequency, settings.bassHz);
    },
  };
}
