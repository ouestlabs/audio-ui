/**
 * The sound of Capella-9: a tonewheel organ, built the way it is played. Every
 * key sounds nine sine waves at the organ's own harmonics, from the 16' an
 * octave below to the 1' three octaves above, each at the level its drawbar
 * is pulled to; a short percussion on the second or third harmonic and a tick
 * of key click open each note. The sum goes through an overdrive and a rotary
 * speaker: two delays swayed in opposite directions, and a tremolo, whose
 * rate takes a moment to reach the speed of the switch, as the horns do.
 *
 * The controls speak in the panel's own units; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), and the
 * organ plays into the bus it is attached to, which owns the master level and
 * the safety limiter.
 */

export const DRAWBARS = 9;
export const MAX_DRAWBAR = 8;

/** The footages, from the 16' to the 1', and their pitch against the 8' (the key itself). */
export const FOOTAGES = [
  { label: "16'", ratio: 0.5 },
  { label: "5⅓'", ratio: 1.5 },
  { label: "8'", ratio: 1 },
  { label: "4'", ratio: 2 },
  { label: "2⅔'", ratio: 3 },
  { label: "2'", ratio: 4 },
  { label: "1⅗'", ratio: 5 },
  { label: "1⅓'", ratio: 6 },
  { label: "1'", ratio: 8 },
] as const;

export type Leslie = "Fast" | "Slow" | "Stop";
export type Harmonic = "2nd" | "3rd";
export type Decay = "Fast" | "Slow";

export interface Settings {
  click: number;
  decay: Decay;
  /** The drawbars, each pulled from 0 to 8, in the order of `FOOTAGES`. */
  drawbars: number[];
  drive: number;
  harmonic: Harmonic;
  leslie: Leslie;
  percussion: boolean;
}

export const DEFAULTS: Settings & { volume: number } = {
  click: 3,
  decay: "Fast",
  drawbars: [8, 8, 8, 0, 0, 0, 0, 0, 0],
  drive: 2,
  harmonic: "3rd",
  leslie: "Slow",
  percussion: false,
  volume: 7,
};

/** Headroom: nine partials a key and a handful of keys together stay under the bus's limiter. */
const PARTIAL_GAIN = 0.1;
const ATTACK = 0.004;
const RELEASE = 0.025;
const SMOOTHING = 0.02;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;
const PERCUSSION_LEVEL = 0.6;
const PERCUSSION_SECONDS: Record<Decay, number> = { Fast: 0.22, Slow: 0.5 };
const NOISE_SECONDS = 0.05;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** A drawbar's gain: each step is 3 dB, so the eighth is full and the first is 21 dB under it. */
export const drawbarGain = (level: number) =>
  level <= 0 ? 0 : 10 ** (-((MAX_DRAWBAR - level) * 3) / 20);
/**
 * A registration with few drawbars out would sound far under one with all of
 * them: the trim lifts it part of the way, by the energy of the bars, so
 * changing a registration does not mean reaching for the volume.
 */
export function registrationTrim(drawbars: readonly number[]) {
  const energy = drawbars.reduce(
    (sum, level) => sum + drawbarGain(level) ** 2,
    0
  );
  return energy > 0 ? Math.min(6, energy ** -0.7) : 1;
}
export const driveGain = (value: number) => 1 + unit(value) * 5;
export const clickGain = (value: number) => unit(value) ** 2 * 0.5;

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

/** What each speed of the rotary speaker does: how fast it turns, how far it sways the pitch and the level. */
const LESLIE: Record<Leslie, { rate: number; sway: number; tremolo: number }> =
  {
    Fast: { rate: 6.6, sway: 0.000_32, tremolo: 0.28 },
    Slow: { rate: 0.85, sway: 0.0005, tremolo: 0.2 },
    Stop: { rate: 0.3, sway: 0, tremolo: 0 },
  };
/** The horns take a moment to reach a new speed. */
const SPEED_TIME = 0.7;

function saturationCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 2) / 2;
  }
  return curve;
}

interface Voice {
  amp: GainNode;
  levels: GainNode[];
  oscillators: OscillatorNode[];
  pitch: number;
  released: boolean;
}

interface Graph {
  bus: GainNode;
  click: AudioBuffer;
  ctx: BaseAudioContext;
  drive: GainNode;
  lfo: OscillatorNode;
  swayLeft: GainNode;
  swayRight: GainNode;
  tremoloLeft: GainNode;
  tremoloRight: GainNode;
  trim: GainNode;
}

export function createCapellaEngine(initial: Settings = DEFAULTS) {
  const settings: Settings = {
    ...initial,
    drawbars: [...initial.drawbars],
  };
  const voices = new Set<Voice>();
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function applyLeslie() {
    if (!graph) {
      return;
    }
    const speed = LESLIE[settings.leslie];
    const now = graph.ctx.currentTime;
    graph.lfo.frequency.setTargetAtTime(speed.rate, now, SPEED_TIME);
    graph.swayLeft.gain.setTargetAtTime(speed.sway, now, SPEED_TIME);
    graph.swayRight.gain.setTargetAtTime(-speed.sway, now, SPEED_TIME);
    graph.tremoloLeft.gain.setTargetAtTime(speed.tremolo, now, SPEED_TIME);
    graph.tremoloRight.gain.setTargetAtTime(-speed.tremolo, now, SPEED_TIME);
  }

  function dispose(voice: Voice) {
    voices.delete(voice);
    for (const node of [...voice.oscillators, ...voice.levels, voice.amp]) {
      node.disconnect();
    }
  }

  function release(voice: Voice) {
    if (!graph || voice.released) {
      return;
    }
    voice.released = true;
    const now = graph.ctx.currentTime;
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, now);
    voice.amp.gain.setTargetAtTime(0, now, RELEASE / 3);
    for (const osc of voice.oscillators) {
      osc.stop(now + RELEASE * 4);
    }
  }

  /** The percussion: a decaying sine on the second or third harmonic, only on the note's attack. */
  function percussion(amp: AudioNode, base: number, now: number) {
    if (!(graph && settings.percussion)) {
      return;
    }
    const osc = graph.ctx.createOscillator();
    osc.frequency.value = base * (settings.harmonic === "2nd" ? 2 : 3);
    const decay = PERCUSSION_SECONDS[settings.decay];
    const gain = graph.ctx.createGain();
    gain.gain.setValueAtTime(PERCUSSION_LEVEL * PARTIAL_GAIN * 4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(gain).connect(amp);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }

  /** The key click: a few milliseconds of high noise as the contacts close. */
  function keyClick(amp: AudioNode, now: number) {
    if (!(graph && settings.click > 0)) {
      return;
    }
    const source = graph.ctx.createBufferSource();
    source.buffer = graph.click;
    const filter = graph.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2500;
    const gain = graph.ctx.createGain();
    gain.gain.value = clickGain(settings.click);
    source.connect(filter).connect(gain).connect(amp);
    source.start(now);
  }

  return {
    /** Builds the overdrive and the rotary speaker into `destination` (the bus): nothing sounds until a key. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const bus = ctx.createGain();
      const trim = ctx.createGain();
      trim.gain.value = registrationTrim(settings.drawbars);
      const drive = ctx.createGain();
      drive.gain.value = driveGain(settings.drive);
      const shaper = ctx.createWaveShaper();
      shaper.curve = saturationCurve();
      const makeup = ctx.createGain();
      makeup.gain.value = 0.7;
      bus.connect(trim).connect(drive).connect(shaper).connect(makeup);

      // The rotary speaker: two delays swayed opposite ways and two tremolos, one a side.
      const left = ctx.createDelay(0.05);
      const right = ctx.createDelay(0.05);
      left.delayTime.value = 0.004;
      right.delayTime.value = 0.004;
      const sideLeft = ctx.createGain();
      const sideRight = ctx.createGain();
      sideLeft.gain.value = 0.8;
      sideRight.gain.value = 0.8;
      const merger = ctx.createChannelMerger(2);
      makeup.connect(left).connect(sideLeft).connect(merger, 0, 0);
      makeup.connect(right).connect(sideRight).connect(merger, 0, 1);
      merger.connect(destination);
      const lfo = ctx.createOscillator();
      const swayLeft = ctx.createGain();
      const swayRight = ctx.createGain();
      const tremoloLeft = ctx.createGain();
      const tremoloRight = ctx.createGain();
      // The speaker starts at the speed of its switch: only a later change takes its time to arrive.
      const speed = LESLIE[settings.leslie];
      lfo.frequency.value = speed.rate;
      swayLeft.gain.value = speed.sway;
      swayRight.gain.value = -speed.sway;
      tremoloLeft.gain.value = speed.tremolo;
      tremoloRight.gain.value = -speed.tremolo;
      lfo.connect(swayLeft).connect(left.delayTime);
      lfo.connect(swayRight).connect(right.delayTime);
      lfo.connect(tremoloLeft).connect(sideLeft.gain);
      lfo.connect(tremoloRight).connect(sideRight.gain);
      lfo.start();

      // A tick for the key click: a few milliseconds of noise.
      const click = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * NOISE_SECONDS),
        ctx.sampleRate
      );
      const data = click.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
      }
      graph = {
        bus,
        trim,
        click,
        ctx,
        drive,
        lfo,
        swayLeft,
        swayRight,
        tremoloLeft,
        tremoloRight,
      };
    },
    /** Stops every voice and the speaker's oscillator, and disconnects what this organ made; the shared context stays. */
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
        graph.lfo.stop();
        graph.bus.disconnect();
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
    /** Sounds a key: nine partials at their drawbar levels, with the percussion and the click. */
    noteOn(pitch: number, velocity = 1) {
      if (!graph) {
        return;
      }
      const { bus, ctx } = graph;
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
          release(voice);
        }
      }
      const now = ctx.currentTime;
      const base = hertz(pitch);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(0.4 + 0.6 * velocity, now + ATTACK);
      amp.connect(bus);
      const oscillators: OscillatorNode[] = [];
      const levels: GainNode[] = [];
      for (const [index, footage] of FOOTAGES.entries()) {
        const osc = ctx.createOscillator();
        osc.frequency.value = base * footage.ratio;
        const level = ctx.createGain();
        level.gain.value =
          drawbarGain(settings.drawbars[index] ?? 0) * PARTIAL_GAIN;
        osc.connect(level).connect(amp);
        osc.start(now);
        oscillators.push(osc);
        levels.push(level);
      }
      percussion(amp, base, now);
      keyClick(amp, now);
      const voice: Voice = { amp, levels, oscillators, pitch, released: false };
      oscillators[0]?.addEventListener("ended", () => dispose(voice));
      voices.add(voice);
    },
    /** Lets every key go: a panic, or a registration that should not leave old notes ringing. */
    releaseAll() {
      for (const voice of voices) {
        release(voice);
      }
    },
    /** A control moved: the organ, and every key sounding, follows. */
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      if (key === "leslie") {
        applyLeslie();
      }
      if (key === "drive") {
        smooth(graph.drive.gain, driveGain(settings.drive));
      }
      if (key === "drawbars") {
        smooth(graph.trim.gain, registrationTrim(settings.drawbars));
        for (const voice of voices) {
          for (const [index, level] of voice.levels.entries()) {
            smooth(
              level.gain,
              drawbarGain(settings.drawbars[index] ?? 0) * PARTIAL_GAIN
            );
          }
        }
      }
    },
  };
}

export type CapellaEngine = ReturnType<typeof createCapellaEngine>;
