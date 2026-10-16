import {
  type FilterState,
  filterSettings,
} from "@/registry-audio/bases/base/lib/filter-device";

/** How fast a knob follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.015;

export interface FilterEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: FilterState) => void;
}

/**
 * A filter on the Web Audio API for a `FilterState`:
 *
 * ```
 * input → filter → wet ──┐
 *       → dry ───────────┴→ output
 * ```
 *
 * The node is the filter `filterCurve` draws, with the resonance given to it
 * in the unit it wants. Off, the signal goes round it. Parameters move with
 * `setTargetAtTime`, never `.value =`, so a sweep does not click.
 */
export function createFilterEngine(
  ctx: BaseAudioContext,
  initial: FilterState
): FilterEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const wet = ctx.createGain();
  const dry = ctx.createGain();
  input.connect(filter).connect(wet).connect(output);
  input.connect(dry).connect(output);

  const first = filterSettings(initial);
  filter.type = first.type;
  filter.frequency.value = first.frequency;
  filter.Q.value = first.q;
  wet.gain.value = first.wet;
  dry.gain.value = first.dry;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      for (const node of [input, filter, wet, dry, output]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      const settings = filterSettings(state);
      filter.type = settings.type;
      follow(filter.frequency, settings.frequency);
      follow(filter.Q, settings.q);
      follow(wet.gain, settings.wet);
      follow(dry.gain, settings.dry);
    },
  };
}
