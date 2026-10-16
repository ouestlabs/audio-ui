import type { InstrumentBinding } from "@audio-ui/core/device";
import {
  type WaveShaperNote,
  type WaveShaperState,
  waveShaperCurve,
  waveShaperCutoff,
} from "@/registry-audio/bases/base/lib/wave-shaper-device";

/** How fast a parameter follows a change, as a time constant in seconds. */
const RAMP_SECONDS = 0.01;
const ATTACK_SECONDS = 0.02;
const RELEASE_SECONDS = 0.05;
/** The level of a full volume. */
const LEVEL = 0.4;
/** Two oscillators in one voice: each at half, so the pair is not louder than one. */
const OSCILLATOR_LEVEL = 0.5;

export interface WaveShaperEngine
  extends InstrumentBinding<WaveShaperState, WaveShaperNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface Voice {
  detuned: OscillatorNode;
  dry: GainNode;
  envelope: GainNode;
  filter: BiquadFilterNode;
  main: OscillatorNode;
  shaper: WaveShaperNode;
  wet: GainNode;
}

/**
 * A wave shaper synth on the Web Audio API for a `WaveShaperState`:
 *
 * ```
 * two oscillators → ┬→ dry ─────────────┬→ low-pass → envelope → output (the volume)
 *                   └→ distortion → wet ┘
 * ```
 *
 * One voice at a time: a note while one is held glides it, and the voice goes
 * once its release is over. The distortion curve is rebuilt only when the
 * drive changes, since it is a table of 44,100 points.
 */
export function createWaveShaperEngine(
  ctx: BaseAudioContext,
  initial: WaveShaperState
): WaveShaperEngine {
  const output = ctx.createGain();
  let state = initial;
  let voice: Voice | null = null;
  let curve: Float32Array<ArrayBuffer> | null = null;
  let curveDrive = Number.NaN;
  output.gain.value = initial.volume * LEVEL;

  const follow = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS);

  const curveFor = (drive: number) => {
    if (!curve || curveDrive !== drive) {
      curve = waveShaperCurve(drive);
      curveDrive = drive;
    }
    return curve;
  };

  const levels = (mix: number) => ({ dry: (100 - mix) / 100, wet: mix / 100 });

  return {
    dispose: () => {
      voice?.main.stop();
      voice?.detuned.stop();
      voice = null;
      output.disconnect();
    },
    noteOff: () => {
      if (!voice) {
        return;
      }
      const { detuned, envelope, main } = voice;
      const now = ctx.currentTime;
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setValueAtTime(envelope.gain.value, now);
      envelope.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS);
      main.stop(now + RELEASE_SECONDS + RAMP_SECONDS);
      detuned.stop(now + RELEASE_SECONDS + RAMP_SECONDS);
      voice = null;
    },
    noteOn: (note) => {
      if (voice) {
        follow(voice.main.frequency, note.frequency);
        follow(voice.detuned.frequency, note.frequency);
        follow(voice.filter.Q, note.resonance);
        return;
      }
      const now = ctx.currentTime;
      const main = ctx.createOscillator();
      const detuned = ctx.createOscillator();
      const mixed = ctx.createGain();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const shaper = ctx.createWaveShaper();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      for (const oscillator of [main, detuned]) {
        oscillator.type = state.wave;
        oscillator.frequency.setValueAtTime(note.frequency, now);
      }
      detuned.detune.setValueAtTime(state.detune, now);
      mixed.gain.setValueAtTime(OSCILLATOR_LEVEL, now);
      const { dry: dryLevel, wet: wetLevel } = levels(state.mix);
      dry.gain.setValueAtTime(dryLevel, now);
      wet.gain.setValueAtTime(wetLevel, now);
      shaper.curve = curveFor(state.drive);
      shaper.oversample = "4x";
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(waveShaperCutoff(state.tone), now);
      filter.Q.setValueAtTime(note.resonance, now);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(1, now + ATTACK_SECONDS);

      main.connect(mixed);
      detuned.connect(mixed);
      mixed.connect(dry).connect(filter);
      mixed.connect(shaper).connect(wet).connect(filter);
      filter.connect(envelope).connect(output);
      main.onended = () => {
        for (const node of [main, detuned, mixed, dry, wet, shaper, filter]) {
          node.disconnect();
        }
        envelope.disconnect();
      };
      main.start(now);
      detuned.start(now);
      voice = { detuned, dry, envelope, filter, main, shaper, wet };
    },
    output,
    update: (next) => {
      state = next;
      follow(output.gain, next.volume * LEVEL);
      if (!voice) {
        return;
      }
      voice.main.type = next.wave;
      voice.detuned.type = next.wave;
      follow(voice.detuned.detune, next.detune);
      follow(voice.filter.frequency, waveShaperCutoff(next.tone));
      voice.shaper.curve = curveFor(next.drive);
      const { dry, wet } = levels(next.mix);
      follow(voice.dry.gain, dry);
      follow(voice.wet.gain, wet);
    },
  };
}
