import {
  DEFAULT_TEMPO,
  SYNCED_DIVISIONS,
  syncedSeconds,
  type Tempo,
} from "@audio-ui/core/time";

/** The slowest and the fastest an oscillator is allowed to run, in hertz: a synced one is held between them. */
const MIN_RATE_HZ = 0.02;
const MAX_RATE_HZ = 40;

/** The parameters that give an oscillator its rate: free in hertz, or a cycle per note value of the tempo. */
export interface RateState {
  division: string;
  rateHz: number;
  sync: boolean;
}

/** The two descriptors a synced rate adds beside the one in hertz: a switch and the note list. */
export const SYNCED_RATE_PARAMETERS = [
  { default: false, id: "sync", kind: "toggle", label: "Sync" },
  {
    default: "1/4",
    id: "division",
    kind: "choice",
    label: "Note",
    options: SYNCED_DIVISIONS,
  },
] as const;

/**
 * The rate of an oscillator in hertz: the one in the state, or, when it is
 * synced, one cycle for each note value at `tempo`, so `1/4` at 120 BPM is 2 Hz.
 */
export function lfoRate(state: RateState, tempo: Tempo = DEFAULT_TEMPO) {
  if (!state.sync) {
    return state.rateHz;
  }
  const rate = 1 / syncedSeconds(state.division, tempo);
  return Math.min(MAX_RATE_HZ, Math.max(MIN_RATE_HZ, rate));
}
