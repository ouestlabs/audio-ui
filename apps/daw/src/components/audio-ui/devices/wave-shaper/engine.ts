import type { InstrumentBinding, NoteTiming } from "@audio-ui/engine/device";
import {
  type WaveShaperNote,
  type WaveShaperState,
  waveShaperCurve,
  waveShaperCutoff,
} from "@/components/audio-ui/devices/wave-shaper/device";
import { createOversamplingDelay } from "@/lib/oversampling";

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
  /** The note it plays, as `noteOn` named it. */
  id: NoteTiming["id"];
  main: OscillatorNode;
  /** The level its attack rises to: the note's velocity. */
  peak: number;
  shaper: WaveShaperNode;
  /** When its attack began, on the audio clock. */
  start: number;
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

  const follow = (param: AudioParam, value: number, at = ctx.currentTime) =>
    param.setTargetAtTime(value, at, RAMP_SECONDS);
  /** A time on the audio clock that has not passed: now at the earliest. */
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);
  /** Where the voice's envelope stands at `time`: up its attack, then held. */
  const levelAt = (held: Voice, time: number) =>
    held.peak * Math.min(1, Math.max(0, (time - held.start) / ATTACK_SECONDS));

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
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      const { detuned, envelope, main } = voice;
      const time = when(at);
      envelope.gain.cancelScheduledValues(time);
      envelope.gain.setValueAtTime(levelAt(voice, time), time);
      envelope.gain.linearRampToValueAtTime(0, time + RELEASE_SECONDS);
      main.stop(time + RELEASE_SECONDS + RAMP_SECONDS);
      detuned.stop(time + RELEASE_SECONDS + RAMP_SECONDS);
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const now = when(at);
      if (voice) {
        follow(voice.main.frequency, note.frequency, now);
        follow(voice.detuned.frequency, note.frequency, now);
        follow(voice.filter.Q, note.resonance, now);
        voice.id = id;
        return;
      }
      const peak = Math.min(1, Math.max(0, note.velocity ?? 1));
      const main = ctx.createOscillator();
      const detuned = ctx.createOscillator();
      const mixed = ctx.createGain();
      const dry = ctx.createGain();
      const dryDelay = createOversamplingDelay(ctx, "4x");
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
      envelope.gain.linearRampToValueAtTime(peak, now + ATTACK_SECONDS);

      main.connect(mixed);
      detuned.connect(mixed);
      mixed.connect(dryDelay).connect(dry).connect(filter);
      mixed.connect(shaper).connect(wet).connect(filter);
      filter.connect(envelope).connect(output);
      main.onended = () => {
        for (const node of [
          main,
          detuned,
          mixed,
          dryDelay,
          dry,
          wet,
          shaper,
          filter,
        ]) {
          node.disconnect();
        }
        envelope.disconnect();
      };
      main.start(now);
      detuned.start(now);
      voice = {
        detuned,
        dry,
        envelope,
        filter,
        id,
        main,
        peak,
        shaper,
        start: now,
        wet,
      };
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
