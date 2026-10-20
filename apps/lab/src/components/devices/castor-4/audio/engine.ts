/**
 * The sound of Castor-4: a string machine. Every key sounds four registers, a
 * violin and a viola at its pitch, a cello an octave down and a bass two, each
 * at the level its slider is set to; the sum bows in slowly and lets go slowly,
 * through a brightness filter, then an ensemble: three delay lines swayed by
 * three slow oscillators a third of a turn apart, which thicken the sound as a
 * section of players does.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), so a drag
 * makes no zipper noise, and the machine plays into the bus it is attached to,
 * which owns the master level and the safety limiter.
 */

export const REGISTERS = ["violin", "viola", "cello", "bass"] as const;
export type Register = (typeof REGISTERS)[number];
export type Param = Register | "attack" | "bright" | "ensemble" | "release";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings & { volume: number } = {
  attack: 4,
  bass: 0,
  bright: 6,
  cello: 5,
  ensemble: 6,
  release: 5,
  viola: 4,
  violin: 8,
  volume: 7,
};

export const VOICES = 8;
const SMOOTHING = 0.03;
/** What each source adds, so eight voices of five oscillators stay under the bus's limiter. */
const SOURCE_GAIN = 0.11;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;
const STEAL = 0.01;
const DETUNE_CENTS = 7;
const LFO_HERTZ = 0.55;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const attackSeconds = (value: number) => 0.01 + unit(value) ** 2 * 1.8;
export const releaseSeconds = (value: number) => 0.08 + unit(value) ** 2 * 2.4;
export const cutoffHertz = (value: number) => 700 * 14 ** unit(value);
export const registerGain = (value: number) => unit(value) ** 1.5;
export const ensembleDepth = (value: number) => 0.0004 + unit(value) * 0.0026;

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

interface Voice {
  amp: GainNode;
  levels: Record<Register, GainNode>;
  oscillators: OscillatorNode[];
  pitch: number;
  released: boolean;
  startedAt: number;
}

interface Graph {
  ctx: BaseAudioContext;
  depths: GainNode[];
  lfos: OscillatorNode[];
  voices: GainNode;
  wet: GainNode;
}

export function createCastorEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const voices = new Set<Voice>();
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function release(voice: Voice, fast = false) {
    if (!graph || voice.released) {
      return;
    }
    voice.released = true;
    const now = graph.ctx.currentTime;
    const seconds = fast ? STEAL * 4 : releaseSeconds(settings.release);
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, now);
    voice.amp.gain.setTargetAtTime(0, now, fast ? STEAL : seconds / 4);
    for (const osc of voice.oscillators) {
      osc.stop(now + seconds * 1.4 + 0.05);
    }
  }

  function dispose(voice: Voice) {
    voices.delete(voice);
    for (const node of [...voice.oscillators, voice.amp]) {
      node.disconnect();
    }
  }

  return {
    /** Builds the ensemble into `destination` (the bus): nothing sounds until a key. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const bus = ctx.createGain();
      const dry = ctx.createGain();
      dry.gain.value = 0.6;
      bus.connect(dry).connect(destination);
      const wet = ctx.createGain();
      wet.gain.value = unit(settings.ensemble) * 0.55;
      const merger = ctx.createChannelMerger(2);
      const depths: GainNode[] = [];
      const lfos: OscillatorNode[] = [];
      // Three delay lines, each swayed by its own oscillator, a third of a turn apart.
      for (const [index, side] of [0, 1, 0].entries()) {
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.012 + index * 0.003;
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = LFO_HERTZ * (1 + index * 0.11);
        const depth = ctx.createGain();
        depth.gain.value = ensembleDepth(settings.ensemble);
        lfo.connect(depth).connect(delay.delayTime);
        // Spreading the start: each oscillator begins at its own place in the turn.
        lfo.start(ctx.currentTime + index * (1 / LFO_HERTZ / 3));
        bus.connect(delay).connect(merger, 0, side);
        depths.push(depth);
        lfos.push(lfo);
      }
      merger.connect(wet).connect(destination);
      graph = { ctx, depths, lfos, voices: bus, wet };
    },
    /** Stops every voice and the ensemble's oscillators, and disconnects what this machine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      for (const voice of [...voices]) {
        for (const osc of voice.oscillators) {
          osc.stop();
        }
        dispose(voice);
      }
      if (graph) {
        for (const lfo of graph.lfos) {
          lfo.stop();
        }
        graph.voices.disconnect();
        graph.wet.disconnect();
      }
      graph = null;
    },
    noteOff(pitch: number) {
      for (const voice of voices) {
        if (voice.pitch === pitch && !voice.released) {
          release(voice);
        }
      }
    },
    /** Bows a key; `velocity` is from 0 to 1 and only leans on the level a little, as strings do. */
    noteOn(pitch: number, velocity = 1) {
      if (!graph) {
        return;
      }
      const { ctx, voices: bus } = graph;
      // Not awaited: on a first press the promise can wait for the pointer's release, after the key is up.
      if (ctx.state === "suspended" && "resume" in ctx) {
        (ctx as AudioContext).resume().catch(() => undefined);
        if (!unlock) {
          unlock = () => {
            (ctx as AudioContext).resume().catch(() => undefined);
          };
          document.addEventListener("pointerup", unlock, { once: true });
        }
      }
      for (const voice of voices) {
        if (voice.pitch === pitch) {
          release(voice, true);
        }
      }
      const live = [...voices].filter((other) => !other.released);
      if (live.length >= VOICES) {
        const oldest = live.reduce((a, b) =>
          a.startedAt <= b.startedAt ? a : b
        );
        release(oldest, true);
      }
      const now = ctx.currentTime;
      const frequency = hertz(pitch);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(
        0.75 + 0.25 * velocity,
        now + attackSeconds(settings.attack)
      );
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoffHertz(settings.bright);
      filter.Q.value = 0.5;
      filter.connect(amp).connect(bus);

      const oscillators: OscillatorNode[] = [];
      const levels = {} as Record<Register, GainNode>;
      const make = (
        register: Register,
        type: OscillatorType,
        ratio: number,
        detune: number
      ) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = frequency * ratio;
        osc.detune.value = detune;
        let level = levels[register];
        if (!level) {
          level = ctx.createGain();
          level.gain.value = registerGain(settings[register]) * SOURCE_GAIN;
          level.connect(filter);
          levels[register] = level;
        }
        osc.connect(level);
        oscillators.push(osc);
      };
      make("violin", "sawtooth", 1, -DETUNE_CENTS);
      make("violin", "sawtooth", 1, DETUNE_CENTS);
      make("viola", "sawtooth", 1, 0);
      make("cello", "sawtooth", 0.5, 0);
      make("bass", "triangle", 0.25, 0);
      const voice: Voice = {
        amp,
        levels,
        oscillators,
        pitch,
        released: false,
        startedAt: now,
      };
      oscillators[0]?.addEventListener("ended", () => dispose(voice));
      voices.add(voice);
      for (const osc of oscillators) {
        osc.start(now);
      }
    },
    /** Lets every key go: a panic, or a patch that should not leave old notes ringing. */
    releaseAll() {
      for (const voice of voices) {
        release(voice);
      }
    },
    /** A control moved: the machine, and every key sounding, follows. */
    set(key: Param, value: number) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      if (key === "ensemble") {
        smooth(graph.wet.gain, unit(value) * 0.55);
        for (const depth of graph.depths) {
          smooth(depth.gain, ensembleDepth(value));
        }
      }
      if ((REGISTERS as readonly string[]).includes(key)) {
        for (const voice of voices) {
          smooth(
            voice.levels[key as Register].gain,
            registerGain(value) * SOURCE_GAIN
          );
        }
      }
    },
  };
}

export type CastorEngine = ReturnType<typeof createCastorEngine>;
