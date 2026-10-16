import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** The longest echo time, in seconds: the node that holds it is made this long. */
export const MAX_DELAY_SECONDS = 2;
const MAX_FEEDBACK = 0.95;
/** An echo quieter than this share of the first is not drawn. */
const AUDIBLE_SHARE = 0.03;

/**
 * A delay as a device: an echo time, how much of each echo comes back, how dark
 * the repeats get, and a mix, with no panel and no audio in it. A panel draws
 * its state, an engine plays it, an agent drives it through
 * `deviceTools(delayDevice)`.
 */
export const delayDevice = defineDevice({
  description:
    "Repeats the sound: an echo after the time, each repeat a share of the one before it (the feedback) and darker as the tone closes, mixed with the dry sound.",
  id: "audioui.delay",
  name: "Delay",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 350,
      id: "timeMs",
      label: "Time",
      max: MAX_DELAY_SECONDS * 1000,
      min: 10,
      scale: "log",
      step: 1,
      unit: "ms",
    },
    {
      default: 40,
      id: "feedback",
      label: "Feedback",
      max: MAX_FEEDBACK * 100,
      min: 0,
      step: 1,
      unit: "%",
    },
    {
      default: 6000,
      format: formatHz,
      id: "toneHz",
      label: "Tone",
      max: 20_000,
      min: 200,
      scale: "log",
      step: 10,
    },
    {
      default: 30,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type DelayState = DeviceState<typeof delayDevice.parameters>;

/**
 * The numbers that go on the nodes for a state, as plain values. Pure, so what
 * an engine sets can be read and tested without an `AudioContext`. Off, the
 * echo is silent and nothing comes back, so what was ringing dies out.
 */
export function delaySettings(state: DelayState) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    delay: state.timeMs / 1000,
    dry: 1 - mix,
    feedback: state.enabled ? state.feedback / 100 : 0,
    tone: state.toneHz,
    wet: mix,
  };
}

/** One echo as the plot draws it: when it sounds, and how loud it is next to the dry sound. */
export interface DelayTap {
  level: number;
  timeMs: number;
}

/**
 * The echoes a state makes within `windowMs`: the dry sound at 0, then each
 * repeat at a multiple of the time, a `feedback` share quieter than the one
 * before, until it is too quiet to draw. The first echo is as loud as the mix.
 */
export function delayTaps(state: DelayState, windowMs: number): DelayTap[] {
  const { dry, feedback, wet } = delaySettings(state);
  const taps: DelayTap[] = [{ level: dry, timeMs: 0 }];
  let level = wet;
  for (
    let n = 1;
    n * state.timeMs <= windowMs && level >= wet * AUDIBLE_SHARE && level > 0;
    n += 1
  ) {
    taps.push({ level, timeMs: n * state.timeMs });
    level *= feedback;
  }
  return taps;
}
