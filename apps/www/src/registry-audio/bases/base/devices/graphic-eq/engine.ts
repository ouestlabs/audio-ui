import { toWebAudioQ, WEB_AUDIO_FILTER_TYPES } from "@audio-ui/engine/analysis";
import {
  type GraphicEqState,
  graphicEqBands,
} from "@/registry-audio/bases/base/devices/graphic-eq/device";
import type { EffectEngine } from "@/registry-audio/bases/base/lib/device-engine";

const RAMP_SECONDS = 0.02;

export type GraphicEqEngine = EffectEngine<GraphicEqState>;

/**
 * A graphic EQ on the Web Audio API for a `GraphicEqState`:
 *
 * ```
 * input → 31 Hz → 63 Hz → … → 16 kHz → output level → output
 * ```
 *
 * Each band is a peaking filter, the ones `graphicEqCurve` draws. Off, every
 * band goes flat and the level to 0 dB.
 */
export function createGraphicEqEngine(
  ctx: BaseAudioContext,
  initial: GraphicEqState
): GraphicEqEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const filters = graphicEqBands(initial).map((band) => {
    const filter = ctx.createBiquadFilter();
    filter.type = WEB_AUDIO_FILTER_TYPES[band.type];
    return filter;
  });
  const level = ctx.createGain();
  [input, ...filters, level, output].reduce((from, to) => {
    from.connect(to);
    return to;
  });

  const apply = (
    state: GraphicEqState,
    set: (param: AudioParam, value: number) => void
  ) => {
    graphicEqBands(state).forEach((band, index) => {
      const filter = filters[index];
      if (!filter) {
        return;
      }
      set(filter.frequency, band.frequency);
      set(filter.gain, band.gainDb ?? 0);
      set(filter.Q, toWebAudioQ(band.type, band.q));
    });
    set(level.gain, 10 ** ((state.enabled ? state.outputDb : 0) / 20));
  };
  apply(initial, (param, value) => {
    param.value = value;
  });

  return {
    dispose: () => {
      for (const node of [input, ...filters, level, output]) {
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
