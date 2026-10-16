import { toWebAudioQ, WEB_AUDIO_FILTER_TYPES } from "@audio-ui/core/analysis";
import {
  type ChannelEqState,
  channelEqBands,
} from "@/registry-audio/bases/base/lib/channel-eq-device";

const RAMP_SECONDS = 0.02;

export interface ChannelEqEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: ChannelEqState) => void;
}

/**
 * A channel EQ on the Web Audio API for a `ChannelEqState`:
 *
 * ```
 * input → high-pass → low shelf → mid bell → high shelf → trim → output
 * ```
 *
 * The filters are the ones `channelEqCurve` draws. Off, every filter goes flat
 * and the trim to 0 dB.
 */
export function createChannelEqEngine(
  ctx: BaseAudioContext,
  initial: ChannelEqState
): ChannelEqEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const filters = channelEqBands(initial).map((band) => {
    const filter = ctx.createBiquadFilter();
    filter.type = WEB_AUDIO_FILTER_TYPES[band.type];
    return filter;
  });
  const trim = ctx.createGain();
  [input, ...filters, trim, output].reduce((from, to) => {
    from.connect(to);
    return to;
  });

  const apply = (
    state: ChannelEqState,
    set: (param: AudioParam, value: number) => void
  ) => {
    channelEqBands(state).forEach((band, index) => {
      const filter = filters[index];
      if (!filter) {
        return;
      }
      set(filter.frequency, band.frequency);
      set(filter.gain, state.enabled ? (band.gainDb ?? 0) : 0);
      set(filter.Q, toWebAudioQ(band.type, band.q));
    });
    set(trim.gain, 10 ** ((state.enabled ? state.outputDb : 0) / 20));
  };
  apply(initial, (param, value) => {
    param.value = value;
  });

  return {
    dispose: () => {
      for (const node of [input, ...filters, trim, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) =>
      apply(state, (param, value) =>
        param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS)
      ),
  };
}
