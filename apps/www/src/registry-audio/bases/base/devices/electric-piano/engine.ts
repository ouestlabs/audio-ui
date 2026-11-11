import type { NoteTiming } from "@audio-ui/core/device";
import {
  driveGain,
  type ElectricPianoNote,
  type ElectricPianoState,
  rateHertz,
  ringSeconds,
  volumeGain,
} from "@/registry-audio/bases/base/devices/electric-piano/device";
import type { InstrumentEngine } from "@/registry-audio/bases/base/lib/device-engine";

/** How far up the bell's modulator sits: fourteen times the pitch. */
const BELL_RATIO = 14;
const SMOOTHING = 0.02;
/** A voice's level into the pickup: struck alone, lifted where a whole piano summed ten. */
const VOICE_GAIN = 0.6;
/** The softest key still sounds: a velocity of 0 is this share of a full one. */
const MIN_LEVEL = 0.3;
/** How long a note takes to rise: a strike. */
const ATTACK = 0.003;
/** How long a key let go takes to fall silent, as three time constants. */
const RELEASE = 0.18;
/** How fast a key struck again cuts the note it rang. */
const RESTRIKE = 0.008;
const DRIVE_MAKEUP = 0.8;

export type ElectricPianoEngine = InstrumentEngine<
  ElectricPianoState,
  ElectricPianoNote
>;

interface Voice {
  amp: GainNode;
  id: NoteTiming["id"];
  /** The level it was struck at. */
  level: number;
  oscillators: OscillatorNode[];
  /** How long it rings down, in seconds. */
  ring: number;
  start: number;
}

/** A soft clip, as a pickup and a preamp running hot. */
function driveCurve() {
  const curve = new Float32Array(1024);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * 1.8) / 1.8;
  }
  return curve;
}

const pitchOf = (frequency: number) => 69 + 12 * Math.log2(frequency / 440);

/**
 * One voice of the Electric Piano on the Web Audio API, for an
 * `ElectricPianoState`:
 *
 * ```
 * body (same pitch) ─┐
 *                    ├→ carrier (sine) → amp → drive → tremolo → output (volume)
 * bell (×14)        ─┘
 * ```
 *
 * A host plays chords with several of them, one note each. A note is struck:
 * it rises in three milliseconds, then rings down by itself, even held, over
 * the decay (longer in the bass); its bark and its bell are as bright as the
 * key is hard, and soften as it rings. Let go, it falls silent in a fifth of a
 * second from where it got to. A key struck again while its note rings cuts
 * it and strikes anew. A ringing note keeps the timbre it was struck with; the
 * drive, the tremolo and the volume move under it.
 */
export function createElectricPianoEngine(
  ctx: BaseAudioContext,
  initial: ElectricPianoState
): ElectricPianoEngine {
  let state = initial;
  let voice: Voice | null = null;

  const smooth = (param: AudioParam, value: number, at = ctx.currentTime) =>
    param.setTargetAtTime(value, at, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);

  // What every note goes through: the pickup's drive, the tremolo and the volume.
  const bus = ctx.createGain();
  const drive = ctx.createGain();
  drive.gain.value = driveGain(initial.drive);
  const shaper = ctx.createWaveShaper();
  shaper.curve = driveCurve();
  const makeup = ctx.createGain();
  makeup.gain.value = DRIVE_MAKEUP;
  const tremolo = ctx.createGain();
  const swing = ctx.createGain();
  const lfo = ctx.createOscillator();
  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume);
  const tremoloOf = (next: ElectricPianoState) => (next.depth / 10) * 0.45;
  tremolo.gain.value = 1 - tremoloOf(initial);
  swing.gain.value = tremoloOf(initial);
  lfo.frequency.value = rateHertz(initial.rate);
  lfo.connect(swing).connect(tremolo.gain);
  lfo.start();
  bus.connect(drive).connect(shaper).connect(makeup).connect(tremolo);
  tremolo.connect(output);

  /** Where a voice's level stands at `time`: struck, then ringing down. */
  const levelAt = (held: Voice, time: number) => {
    const elapsed = time - held.start;
    if (elapsed < ATTACK) {
      return held.level * Math.max(0, elapsed / ATTACK);
    }
    return held.level * Math.exp(-(elapsed - ATTACK) / (held.ring / 3));
  };

  const release = (held: Voice, time: number, fall: number) => {
    held.amp.gain.cancelScheduledValues(time);
    held.amp.gain.setValueAtTime(levelAt(held, time), time);
    held.amp.gain.setTargetAtTime(0, time, fall);
    for (const oscillator of held.oscillators) {
      oscillator.stop(time + fall * 8 + 0.05);
    }
  };

  const strike = (
    note: ElectricPianoNote,
    id: Voice["id"],
    time: number
  ): Voice => {
    const { frequency } = note;
    const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
    const level = (MIN_LEVEL + (1 - MIN_LEVEL) * velocity) * VOICE_GAIN;
    const ring = ringSeconds(state.decay, pitchOf(frequency));
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + ATTACK);
    // A tine rings down by itself, even with the key held.
    amp.gain.setTargetAtTime(0, time + ATTACK, ring / 3);
    amp.connect(bus);
    const carrier = ctx.createOscillator();
    carrier.frequency.setValueAtTime(frequency, time);
    carrier.connect(amp);
    // The body: a modulator on the same pitch, harder with the key and the bark, softer as the note rings.
    const body = ctx.createOscillator();
    body.frequency.setValueAtTime(frequency, time);
    const bodyIndex = ctx.createGain();
    const bark = (state.bark / 10) * (0.4 + 0.9 * velocity) * frequency * 1.6;
    bodyIndex.gain.setValueAtTime(bark, time);
    bodyIndex.gain.setTargetAtTime(bark * 0.12, time, 0.35);
    body.connect(bodyIndex).connect(carrier.frequency);
    // The bell: a modulator fourteen times up, gone in a tenth of a second.
    const bell = ctx.createOscillator();
    bell.frequency.setValueAtTime(frequency * BELL_RATIO, time);
    const bellIndex = ctx.createGain();
    const ping = (state.bell / 10) * (0.3 + 0.9 * velocity) * frequency * 1.2;
    bellIndex.gain.setValueAtTime(ping, time);
    bellIndex.gain.setTargetAtTime(0, time, 0.03);
    bell.connect(bellIndex).connect(carrier.frequency);
    const oscillators = [carrier, body, bell];
    carrier.onended = () => {
      for (const node of [...oscillators, bodyIndex, bellIndex, amp]) {
        node.disconnect();
      }
    };
    for (const oscillator of oscillators) {
      oscillator.start(time);
    }
    return { amp, id, level, oscillators, ring, start: time };
  };

  return {
    dispose: () => {
      if (voice) {
        for (const oscillator of voice.oscillators) {
          oscillator.stop();
        }
      }
      voice = null;
      lfo.stop();
      output.disconnect();
    },
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      release(voice, when(at), RELEASE / 3);
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      // A key struck again cuts the note it rang, and rings anew.
      if (voice) {
        release(voice, time, RESTRIKE);
      }
      voice = strike(note, id, time);
    },
    output,
    update: (next) => {
      state = next;
      smooth(output.gain, volumeGain(next.volume));
      smooth(drive.gain, driveGain(next.drive));
      smooth(tremolo.gain, 1 - tremoloOf(next));
      smooth(swing.gain, tremoloOf(next));
      smooth(lfo.frequency, rateHertz(next.rate));
    },
  };
}
