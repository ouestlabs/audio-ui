import { toWebAudioQ, WEB_AUDIO_FILTER_TYPES } from "@audio-ui/core/analysis";
import type { DeviceBinding } from "@audio-ui/core/device";
import {
  EQUALIZER_BANDS,
  type EqualizerState,
  equalizerBands,
} from "@/registry-audio/bases/base/lib/equalizer-device";

/** How fast a parameter follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.02;

export interface EqualizerEngine extends DeviceBinding<EqualizerState> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

/**
 * An equalizer on the Web Audio API for an `EqualizerState`:
 *
 * ```
 * input → low shelf → bell → bell → high shelf → trim → output
 * ```
 *
 * The filters are the ones `equalizerCurve` draws, with `toWebAudioQ` between
 * a band's width and the node's. Off, every band goes flat and the trim to 0
 * dB, so the signal passes unchanged. Parameters move with `setTargetAtTime`,
 * never `.value =`, so a knob turned while it plays does not click.
 */
export function createEqualizerEngine(
  ctx: BaseAudioContext,
  initial: EqualizerState
): EqualizerEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const filters = EQUALIZER_BANDS.map((band) => {
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
    state: EqualizerState,
    set: (param: AudioParam, value: number) => void
  ) => {
    const bands = equalizerBands(state);
    filters.forEach((filter, index) => {
      const band = bands[index];
      if (!band) {
        return;
      }
      set(filter.frequency, band.frequency);
      set(filter.gain, state.enabled ? (band.gainDb ?? 0) : 0);
      set(filter.Q, toWebAudioQ(band.type, band.q));
    });
    set(trim.gain, 10 ** ((state.enabled ? state.outputDb : 0) / 20));
  };

  // A fresh node has its own defaults: set the first state outright, ramps come after.
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
