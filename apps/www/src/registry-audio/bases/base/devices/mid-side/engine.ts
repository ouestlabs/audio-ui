import { toWebAudioQ } from "@audio-ui/core/analysis";
import type { DeviceBinding } from "@audio-ui/core/device";
import {
  DETUNE_WORKLET,
  type MidSideState,
  midSideSettings,
} from "@/registry-audio/bases/base/devices/mid-side/device";
import { loadWorklet } from "@/registry-audio/bases/base/lib/audio-worklet";
import {
  createFeed,
  type Feed,
} from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.015;
const HALF = 0.5;
/** The longest Haas delay, in seconds. */
const LONGEST_HAAS = 0.035;

export interface MidSideEngine extends DeviceBinding<MidSideState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the detune is in the graph. Until then it passes the sound as it is. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
}

/**
 * A mid/side device on the Web Audio API for a `MidSideState`:
 *
 * ```
 * input → as it is ────────────────────────────┐
 *       → L, R delayed (Haas) ─────────────────┤
 *       → detune (worklet) ────────────────────┴→ widened
 * widened → split → mid = (L + R) / 2 → mid level ───────────────┐
 *                 → side = (L - R) / 2 → high-pass → side level ──┴→ L = mid + side, R = mid - side → merge → output
 * ```
 *
 * The widen choice cross-fades the three paths in. The detune is an
 * `AudioWorklet` loaded from a blob, fed only while it plays: until it is
 * ready, it passes the sound as it is. The high-pass on the side is bass mono:
 * what is under it has no side, so it sits in the centre. A mono input is
 * spread to both sides first.
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

  const plain = ctx.createGain();
  const haasSplit = ctx.createChannelSplitter(2);
  const haasDelay = ctx.createDelay(LONGEST_HAAS);
  const haasMerge = ctx.createChannelMerger(2);
  const haas = ctx.createGain();
  const detuned = ctx.createGain();
  const widened = ctx.createGain();
  input.connect(plain).connect(widened);
  input.connect(haasSplit);
  haasSplit.connect(haasMerge, 0, 0);
  haasSplit.connect(haasDelay, 1).connect(haasMerge, 0, 1);
  haasMerge.connect(haas).connect(widened);
  detuned.connect(widened);

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

  widened.connect(split);
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

  let detune: AudioWorkletNode | null = null;
  let latest = initial;
  let disposed = false;
  let feed: Feed | null = null;

  const set = (
    state: MidSideState,
    write: (param: AudioParam, value: number) => void
  ) => {
    const settings = midSideSettings(state);
    // Until the worklet is ready, the detune passes the sound as it is.
    const detuning = settings.widen === "detune" && detune !== null;
    write(
      plain.gain,
      settings.widen === "off" || (settings.widen === "detune" && !detuning)
        ? 1
        : 0
    );
    write(haas.gain, settings.widen === "haas" ? 1 : 0);
    write(detuned.gain, detuning ? 1 : 0);
    write(haasDelay.delayTime, settings.haas);
    write(midLevel.gain, settings.mid);
    write(sideLevel.gain, settings.side);
    write(bass.frequency, settings.bassHz);
    if (detune) {
      write(detune.parameters.get("mix") as AudioParam, settings.detuneMix);
      // A count of cents bakes each head's speed: it changes at once, and the worklet fades it in.
      (detune.parameters.get("cents") as AudioParam).value =
        settings.detuneCents;
    }
    feed?.set(detuning);
  };
  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);
  set(initial, (param, value) => {
    param.value = value;
  });

  const ready = loadWorklet(ctx, DETUNE_WORKLET).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    const settings = midSideSettings(latest);
    detune = new AudioWorkletNode(ctx, "audioui-detune", {
      outputChannelCount: [2],
      parameterData: {
        cents: settings.detuneCents,
        mix: settings.detuneMix,
      },
    });
    feed = createFeed([[input, detune]]);
    detune.connect(detuned);
    set(latest, follow);
    return true;
  });

  return {
    dispose: () => {
      disposed = true;
      feed?.dispose();
      for (const node of [
        input,
        plain,
        haasSplit,
        haasDelay,
        haasMerge,
        haas,
        detuned,
        widened,
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
      detune?.disconnect();
    },
    input,
    output,
    ready,
    update: (state) => {
      latest = state;
      set(state, follow);
    },
  };
}
