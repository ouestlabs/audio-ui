import type { InstrumentBinding, NoteTiming } from "@audio-ui/engine/device";
import type {
  PocketSynthNote,
  PocketSynthState,
} from "@/components/audio-ui/devices/pocket-synth/device";

/** How fast a parameter follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.01;
const ATTACK_SECONDS = 0.02;
const RELEASE_SECONDS = 0.05;
/** The level of a full volume: a bare oscillator is loud. */
const LEVEL = 0.3;
const RESONANCE = 5;

export interface PocketSynthEngine
  extends InstrumentBinding<PocketSynthState, PocketSynthNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface Voice {
  envelope: GainNode;
  filter: BiquadFilterNode;
  /** The note it plays, as `noteOn` named it. */
  id: NoteTiming["id"];
  oscillator: OscillatorNode;
  /** The level its attack rises to: the note's velocity. */
  peak: number;
  /** When its attack began, on the audio clock. */
  start: number;
}

/**
 * A monophonic synth on the Web Audio API for a `PocketSynthState`:
 *
 * ```
 * oscillator → filter → envelope → output (the volume)
 * ```
 *
 * One voice at a time: a note while one is held glides it, and the voice goes
 * once its release is over. A note plays as loud as its velocity. Notes start
 * and end at the time they are given on the audio clock, now when they are
 * given none, and a note off that names another note than the held one lets
 * nothing go: the held note took over from it. The wave and the filter type
 * of a state change under a held note as they change in the state.
 */
export function createPocketSynthEngine(
  ctx: BaseAudioContext,
  initial: PocketSynthState
): PocketSynthEngine {
  const output = ctx.createGain();
  let state = initial;
  let voice: Voice | null = null;
  output.gain.value = initial.volume * LEVEL;

  const follow = (param: AudioParam, value: number, at = ctx.currentTime) =>
    param.setTargetAtTime(value, at, RAMP_SECONDS);
  /** A time on the audio clock that has not passed: now at the earliest. */
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);
  /** Where the voice's envelope stands at `time`: up its attack, then held. */
  const levelAt = (held: Voice, time: number) =>
    held.peak * Math.min(1, Math.max(0, (time - held.start) / ATTACK_SECONDS));

  return {
    dispose: () => {
      voice?.oscillator.stop();
      voice = null;
      output.disconnect();
    },
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      const { envelope, oscillator } = voice;
      const time = when(at);
      envelope.gain.cancelScheduledValues(time);
      envelope.gain.setValueAtTime(levelAt(voice, time), time);
      envelope.gain.linearRampToValueAtTime(0, time + RELEASE_SECONDS);
      oscillator.stop(time + RELEASE_SECONDS + RAMP_SECONDS);
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      if (voice) {
        follow(voice.oscillator.frequency, note.frequency, time);
        follow(voice.filter.frequency, note.cutoff, time);
        voice.id = id;
        return;
      }
      const peak = Math.min(1, Math.max(0, note.velocity ?? 1));
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      oscillator.type = state.wave;
      oscillator.frequency.setValueAtTime(note.frequency, time);
      filter.type = state.filter;
      filter.frequency.setValueAtTime(note.cutoff, time);
      filter.Q.setValueAtTime(RESONANCE, time);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(peak, time + ATTACK_SECONDS);
      oscillator.connect(filter).connect(envelope).connect(output);
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
      oscillator.start(time);
      voice = { envelope, filter, id, oscillator, peak, start: time };
    },
    output,
    update: (next) => {
      state = next;
      follow(output.gain, next.volume * LEVEL);
      if (voice) {
        voice.oscillator.type = next.wave;
        voice.filter.type = next.filter;
      }
    },
  };
}