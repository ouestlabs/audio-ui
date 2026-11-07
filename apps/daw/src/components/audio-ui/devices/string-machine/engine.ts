import type { InstrumentBinding, NoteTiming } from "@audio-ui/core/device";
import {
  attackSeconds,
  cutoffHertz,
  ensembleDepth,
  registerGain,
  releaseSeconds,
  type StringMachineNote,
  type StringMachineState,
  volumeGain,
} from "@/components/audio-ui/devices/string-machine/device";

/** What each oscillator adds before the filter. */
const SOURCE_GAIN = 0.11;
/** What a voice is lifted by on its way out, +9.5 dB: a voice plays alone, where a whole machine summed eight. */
const VOICE_GAIN = 3;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.03;
/** How fast a note struck again cuts the one its voice held. */
const RESTRIKE = 0.01;
/** How long a voice rings after its release starts, as releases. */
const RELEASE_TAIL = 1.4;
const DETUNE_CENTS = 7;
const LFO_HERTZ = 0.55;
/** The softest note is this share of a full one: a string leans on the bow a little, no more. */
const MIN_LEVEL = 0.75;

const REGISTERS = ["violin", "viola", "cello", "bass"] as const;
type Register = (typeof REGISTERS)[number];

/** Each register's oscillators: their wave, their pitch against the key's and their detune in cents. */
const SOURCES: readonly {
  detune: number;
  ratio: number;
  register: Register;
  type: OscillatorType;
}[] = [
  { detune: -DETUNE_CENTS, ratio: 1, register: "violin", type: "sawtooth" },
  { detune: DETUNE_CENTS, ratio: 1, register: "violin", type: "sawtooth" },
  { detune: 0, ratio: 1, register: "viola", type: "sawtooth" },
  { detune: 0, ratio: 0.5, register: "cello", type: "sawtooth" },
  { detune: 0, ratio: 0.25, register: "bass", type: "triangle" },
];

export interface StringMachineEngine
  extends InstrumentBinding<StringMachineState, StringMachineNote> {
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
}

interface Voice {
  amp: GainNode;
  attack: number;
  filter: BiquadFilterNode;
  id: NoteTiming["id"];
  level: number;
  levels: Record<Register, GainNode>;
  oscillators: OscillatorNode[];
  start: number;
}

/**
 * One voice of the String Machine on the Web Audio API, for a
 * `StringMachineState`:
 *
 * ```
 * violin (two saws, detuned), viola, cello, bass → brightness → amp → dry ──────────┐
 *                                                  (low-pass)   (bow)  └→ ensemble ─┴→ output (volume)
 * ```
 *
 * A host plays chords with several of them, one note each. A note bows in
 * over the attack and lets go over the release, from where it had got to; the
 * ensemble is three delay lines swayed by three slow oscillators a third of a
 * turn apart. A register's level and the brightness move a held note. A note
 * while one is held cuts it and bows anew.
 */
export function createStringMachineEngine(
  ctx: BaseAudioContext,
  initial: StringMachineState
): StringMachineEngine {
  let state = initial;
  let voice: Voice | null = null;

  const smooth = (param: AudioParam, value: number) =>
    param.setTargetAtTime(value, ctx.currentTime, SMOOTHING);
  const when = (at?: number) => Math.max(ctx.currentTime, at ?? 0);
  const levelOf = (register: Register) =>
    registerGain(state[register]) * SOURCE_GAIN;

  const output = ctx.createGain();
  output.gain.value = volumeGain(initial.volume) * VOICE_GAIN;
  const bus = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 0.6;
  bus.connect(dry).connect(output);
  const wet = ctx.createGain();
  wet.gain.value = (initial.ensemble / 10) * 0.55;
  const merger = ctx.createChannelMerger(2);
  const depths: GainNode[] = [];
  const lfos: OscillatorNode[] = [];
  // Three delay lines, each swayed by its own oscillator, a third of a turn apart.
  for (const [index, side] of [0, 1, 0].entries()) {
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.012 + index * 0.003;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = LFO_HERTZ * (1 + index * 0.11);
    const depth = ctx.createGain();
    depth.gain.value = ensembleDepth(initial.ensemble);
    lfo.connect(depth).connect(delay.delayTime);
    lfo.start(ctx.currentTime + index * (1 / LFO_HERTZ / 3));
    bus.connect(delay).connect(merger, 0, side);
    depths.push(depth);
    lfos.push(lfo);
  }
  merger.connect(wet).connect(output);

  const release = (held: Voice, time: number, fall?: number) => {
    const seconds = fall ? fall * 4 : releaseSeconds(state.release);
    const elapsed = time - held.start;
    const reached =
      elapsed < held.attack ? held.level * (elapsed / held.attack) : held.level;
    held.amp.gain.cancelScheduledValues(time);
    held.amp.gain.setValueAtTime(reached, time);
    held.amp.gain.setTargetAtTime(0, time, fall ?? seconds / 4);
    for (const oscillator of held.oscillators) {
      oscillator.stop(time + seconds * RELEASE_TAIL + 0.05);
    }
  };

  const strike = (
    note: StringMachineNote,
    id: Voice["id"],
    time: number
  ): Voice => {
    const velocity = Math.min(1, Math.max(0, note.velocity ?? 1));
    const level = MIN_LEVEL + (1 - MIN_LEVEL) * velocity;
    const attack = attackSeconds(state.attack);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(level, time + attack);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoffHertz(state.bright);
    filter.Q.value = 0.5;
    filter.connect(amp).connect(bus);
    const levels = Object.fromEntries(
      REGISTERS.map((register) => {
        const gain = ctx.createGain();
        gain.gain.value = levelOf(register);
        gain.connect(filter);
        return [register, gain];
      })
    ) as Record<Register, GainNode>;
    const oscillators = SOURCES.map((source) => {
      const oscillator = ctx.createOscillator();
      oscillator.type = source.type;
      oscillator.frequency.setValueAtTime(note.frequency * source.ratio, time);
      oscillator.detune.value = source.detune;
      oscillator.connect(levels[source.register]);
      return oscillator;
    });
    const [first] = oscillators;
    if (first) {
      first.onended = () => {
        for (const node of [
          ...oscillators,
          ...Object.values(levels),
          filter,
          amp,
        ]) {
          node.disconnect();
        }
      };
    }
    for (const oscillator of oscillators) {
      oscillator.start(time);
    }
    return { amp, attack, filter, id, level, levels, oscillators, start: time };
  };

  return {
    dispose: () => {
      for (const oscillator of voice?.oscillators ?? []) {
        oscillator.stop();
      }
      voice = null;
      for (const lfo of lfos) {
        lfo.stop();
      }
      output.disconnect();
    },
    noteOff: ({ at, id } = {}) => {
      if (
        !voice ||
        (id !== undefined && voice.id !== undefined && id !== voice.id)
      ) {
        return;
      }
      release(voice, when(at));
      voice = null;
    },
    noteOn: (note, { at, id } = {}) => {
      const time = when(at);
      if (voice) {
        release(voice, time, RESTRIKE);
      }
      voice = strike(note, id, time);
    },
    output,
    update: (next) => {
      state = next;
      smooth(output.gain, volumeGain(next.volume) * VOICE_GAIN);
      smooth(wet.gain, (next.ensemble / 10) * 0.55);
      for (const depth of depths) {
        smooth(depth.gain, ensembleDepth(next.ensemble));
      }
      if (!voice) {
        return;
      }
      for (const register of REGISTERS) {
        smooth(voice.levels[register].gain, levelOf(register));
      }
      smooth(voice.filter.frequency, cutoffHertz(next.bright));
    },
  };
}