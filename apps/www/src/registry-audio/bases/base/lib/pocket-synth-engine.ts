import type { InstrumentBinding } from "@audio-ui/core/device";
import type {
  PocketSynthNote,
  PocketSynthState,
} from "@/registry-audio/bases/base/lib/pocket-synth-device";

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
  oscillator: OscillatorNode;
}

/**
 * A monophonic synth on the Web Audio API for a `PocketSynthState`:
 *
 * ```
 * oscillator → filter → envelope → output (the volume)
 * ```
 *
 * One voice at a time: a note while one is held glides it, and the voice goes
 * once its release is over. The wave and the filter type of a state change
 * under a held note as they change in the state.
 */
export function createPocketSynthEngine(
  ctx: BaseAudioContext,
  initial: PocketSynthState
): PocketSynthEngine {
  const output = ctx.createGain();
  let state = initial;
  let voice: Voice | null = null;
  output.gain.value = initial.volume * LEVEL;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  return {
    dispose: () => {
      voice?.oscillator.stop();
      voice = null;
      output.disconnect();
    },
    noteOff: () => {
      if (!voice) {
        return;
      }
      const { envelope, oscillator } = voice;
      const now = ctx.currentTime;
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(envelope.gain.value, now);
      envelope.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS);
      oscillator.stop(now + RELEASE_SECONDS + RAMP_SECONDS);
      voice = null;
    },
    noteOn: (note) => {
      if (voice) {
        follow(voice.oscillator.frequency, note.frequency);
        follow(voice.filter.frequency, note.cutoff);
        return;
      }
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      oscillator.type = state.wave;
      oscillator.frequency.setValueAtTime(note.frequency, now);
      filter.type = state.filter;
      filter.frequency.setValueAtTime(note.cutoff, now);
      filter.Q.setValueAtTime(RESONANCE, now);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(1, now + ATTACK_SECONDS);
      oscillator.connect(filter).connect(envelope).connect(output);
      oscillator.onended = () => {
        oscillator.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
      oscillator.start(now);
      voice = { envelope, filter, oscillator };
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
