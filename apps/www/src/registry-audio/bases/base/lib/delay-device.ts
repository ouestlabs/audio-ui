import { formatHz } from "@audio-ui/core/analysis";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import {
  DEFAULT_TEMPO,
  SYNCED_DIVISIONS,
  syncedSeconds,
  type Tempo,
} from "@audio-ui/core/time";

/** The longest echo time, in seconds: the node that holds it is made this long. */
export const MAX_DELAY_SECONDS = 2;
const MAX_FEEDBACK = 0.95;
/** An echo quieter than this share of the first is not drawn. */
const AUDIBLE_SHARE = 0.03;

/**
 * A delay as a device: an echo time (in milliseconds, or a note value that
 * follows the host's tempo), how much of each echo comes back, how dark the
 * repeats get, and a mix, with no panel and no audio in it. A panel draws
 * its state, an engine plays it, an agent drives it through
 * `deviceTools(delayDevice)`.
 */
export const delayDevice = defineDevice({
  description:
    "Repeats the sound: an echo after the time, or after a note value of the host's tempo when it is synced, each repeat a share of the one before it (the feedback) and darker as the tone closes, mixed with the dry sound.",
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
    { default: false, id: "sync", kind: "toggle", label: "Sync" },
    {
      default: "1/8",
      id: "division",
      kind: "choice",
      label: "Note",
      options: SYNCED_DIVISIONS,
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

/** The echo time of a state in seconds: the note value at the tempo when it is synced, else the milliseconds, and never more than the node can hold. */
export function delaySeconds(state: DelayState, tempo: Tempo = DEFAULT_TEMPO) {
  const seconds = state.sync
    ? syncedSeconds(state.division, tempo)
    : state.timeMs / 1000;
  return Math.min(MAX_DELAY_SECONDS, seconds);
}

/** The note value whose length at `tempo` is closest to `seconds`: where a handle dragged to a time lands when the delay is synced. */
export function nearestDivision(seconds: number, tempo: Tempo = DEFAULT_TEMPO) {
  let best = SYNCED_DIVISIONS[0]?.value ?? "1/8";
  let gap = Number.POSITIVE_INFINITY;
  for (const { value } of SYNCED_DIVISIONS) {
    const distance = Math.abs(syncedSeconds(value, tempo) - seconds);
    if (distance < gap) {
      gap = distance;
      best = value;
    }
  }
  return best;
}

/**
 * The numbers that go on the nodes for a state, as plain values. Pure, so what
 * an engine sets can be read and tested without an `AudioContext`. Off, the
 * echo is silent and nothing comes back, so what was ringing dies out.
 */
export function delaySettings(state: DelayState, tempo: Tempo = DEFAULT_TEMPO) {
  const mix = state.enabled ? state.mix / 100 : 0;
  return {
    delay: delaySeconds(state, tempo),
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
export function delayTaps(
  state: DelayState,
  windowMs: number,
  tempo: Tempo = DEFAULT_TEMPO
): DelayTap[] {
  const { delay, dry, feedback, wet } = delaySettings(state, tempo);
  const timeMs = delay * 1000;
  const taps: DelayTap[] = [{ level: dry, timeMs: 0 }];
  let level = wet;
  for (
    let n = 1;
    n * timeMs <= windowMs && level >= wet * AUDIBLE_SHARE && level > 0;
    n += 1
  ) {
    taps.push({ level, timeMs: n * timeMs });
    level *= feedback;
  }
  return taps;
}
