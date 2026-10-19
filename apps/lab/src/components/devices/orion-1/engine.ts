/**
 * The sound of Orion-1: a monophonic analog voice. An oscillator and a sub
 * oscillator an octave down, and noise, mixed into a low-pass filter that a
 * contour envelope opens, then an amplifier shaped by the same ADSR. A slow
 * oscillator wobbles the pitch.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), so a drag
 * makes no zipper noise, and the engine plays into the bus it is attached to,
 * which owns the master level and the safety limiter.
 */

export type Wave = "Pulse" | "Saw" | "Square" | "Tri";
export type Range = "4'" | "8'" | "16'" | "32'";

export interface Settings {
  attack: number;
  contour: number;
  cutoff: number;
  decay: number;
  depth: number;
  glide: number;
  noise: number;
  osc: number;
  range: Range;
  rate: number;
  release: number;
  resonance: number;
  sub: number;
  sustain: number;
  tune: number;
  wave: Wave;
  width: number;
}

export type Param = Exclude<keyof Settings, "range" | "wave">;

export const DEFAULTS: Settings & { volume: number } = {
  attack: 1,
  contour: 5,
  cutoff: 6,
  decay: 4,
  depth: 0,
  glide: 2,
  noise: 1,
  osc: 8,
  range: "8'",
  rate: 3,
  release: 3,
  resonance: 3,
  sub: 4,
  sustain: 7,
  tune: 5,
  volume: 7,
  wave: "Saw",
  width: 7,
};

/** What each source adds before the filter: with the resonance, the loudest case stays under the bus's limiter. */
const SOURCE_GAIN = 0.2;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
/** Silence is the bottom of the volume knob, as it is on a fader. */
const SILENCE_DB = -60;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const NOISE_SECONDS = 2;
const HARMONICS = 96;

const RANGE_SEMITONES: Record<Range, number> = {
  "4'": 12,
  "8'": 0,
  "16'": -12,
  "32'": -24,
};

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const cutoffHertz = (value: number) => 40 * 300 ** unit(value);
export const resonanceDecibels = (value: number) => unit(value) * 12;
export const contourCents = (value: number) => unit(value) * 4800;
export const rateHertz = (value: number) => 0.2 * 100 ** unit(value);
export const depthCents = (value: number) => unit(value) ** 2 * 100;
export const glideSeconds = (value: number) => unit(value) * 0.6;
export const attackSeconds = (value: number) => 0.003 * 600 ** unit(value);
export const decaySeconds = (value: number) => 0.01 * 300 ** unit(value);
export const releaseSeconds = (value: number) => 0.01 * 500 ** unit(value);
/** The pulse's width: a square at the bottom of the knob, thin at the top. */
export const pulseWidth = (value: number) => 0.5 - unit(value) * 0.45;

/** The volume knob in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

/** A pulse wave of the given duty, from its Fourier series: the browser has no pulse oscillator. */
function pulseWave(ctx: BaseAudioContext, duty: number) {
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let n = 1; n < HARMONICS; n += 1) {
    const k = 2 / (n * Math.PI);
    real[n] = k * Math.sin(2 * Math.PI * n * duty);
    imag[n] = k * (1 - Math.cos(2 * Math.PI * n * duty));
  }
  return ctx.createPeriodicWave(real, imag);
}

function noiseBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(
    1,
    ctx.sampleRate * NOISE_SECONDS,
    ctx.sampleRate
  );
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

interface Graph {
  amp: GainNode;
  ctx: BaseAudioContext;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  mixes: { noise: GainNode; osc: GainNode; sub: GainNode };
  noise: AudioBufferSourceNode;
  osc: OscillatorNode;
  sub: OscillatorNode;
}

export function createOrionEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const stack: number[] = [];
  let graph: Graph | null = null;
  let powered = true;
  let gate = false;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  /** Both oscillators follow the pitch: the sub an octave down. */
  function tuneTo(pitch: number, glide: number) {
    if (!graph) {
      return;
    }
    const frequency = hertz(pitch + RANGE_SEMITONES[settings.range]);
    const now = graph.ctx.currentTime;
    const time = glide > 0 ? glide / 3 : 0.001;
    graph.osc.frequency.setTargetAtTime(frequency, now, time);
    graph.sub.frequency.setTargetAtTime(frequency / 2, now, time);
  }

  function applyWave() {
    if (!graph) {
      return;
    }
    if (settings.wave === "Pulse") {
      graph.osc.setPeriodicWave(
        pulseWave(graph.ctx, pulseWidth(settings.width))
      );
      return;
    }
    graph.osc.type = {
      Saw: "sawtooth",
      Square: "square",
      Tri: "triangle",
    }[settings.wave] as OscillatorType;
  }

  /** Every parameter, once the graph exists. */
  function applyAll() {
    if (!graph) {
      return;
    }
    const { mixes, filter, osc, sub, lfo, lfoDepth } = graph;
    smooth(mixes.osc.gain, unit(settings.osc) * SOURCE_GAIN);
    smooth(mixes.sub.gain, unit(settings.sub) * SOURCE_GAIN);
    smooth(mixes.noise.gain, unit(settings.noise) * SOURCE_GAIN);
    smooth(filter.frequency, cutoffHertz(settings.cutoff));
    smooth(filter.Q, resonanceDecibels(settings.resonance));
    smooth(osc.detune, (settings.tune - 5) * 10);
    smooth(sub.detune, (settings.tune - 5) * 10);
    smooth(lfo.frequency, rateHertz(settings.rate));
    smooth(lfoDepth.gain, depthCents(settings.depth));
    applyWave();
  }

  /** Opens the amplifier and the filter along the ADSR, from wherever they are. */
  function open() {
    if (!graph) {
      return;
    }
    const { amp, filter, ctx } = graph;
    const now = ctx.currentTime;
    const attack = attackSeconds(settings.attack);
    const decay = decaySeconds(settings.decay);
    const sustain = unit(settings.sustain);
    const contour = contourCents(settings.contour);
    amp.gain.cancelScheduledValues(now);
    amp.gain.setValueAtTime(amp.gain.value, now);
    amp.gain.setTargetAtTime(1, now, attack / 4);
    amp.gain.setTargetAtTime(sustain, now + attack, decay / 3);
    filter.detune.cancelScheduledValues(now);
    filter.detune.setValueAtTime(filter.detune.value, now);
    filter.detune.setTargetAtTime(contour, now, attack / 4);
    filter.detune.setTargetAtTime(contour * sustain, now + attack, decay / 3);
  }

  function close() {
    if (!graph) {
      return;
    }
    const { amp, filter, ctx } = graph;
    const now = ctx.currentTime;
    const release = releaseSeconds(settings.release);
    amp.gain.cancelScheduledValues(now);
    amp.gain.setValueAtTime(amp.gain.value, now);
    amp.gain.setTargetAtTime(0, now, release / 4);
    filter.detune.cancelScheduledValues(now);
    filter.detune.setValueAtTime(filter.detune.value, now);
    filter.detune.setTargetAtTime(0, now, release / 4);
  }

  return {
    /** Builds the voice into `destination` (the bus): nothing sounds until a note. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const amp = ctx.createGain();
      amp.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoffHertz(settings.cutoff);
      const mix = () => {
        const node = ctx.createGain();
        node.gain.value = 0;
        node.connect(filter);
        return node;
      };
      const mixes = { noise: mix(), osc: mix(), sub: mix() };
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      sub.type = "square";
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx);
      noise.loop = true;
      const lfo = ctx.createOscillator();
      const lfoDepth = ctx.createGain();
      lfo.connect(lfoDepth);
      lfoDepth.connect(osc.detune);
      lfoDepth.connect(sub.detune);
      osc.connect(mixes.osc);
      sub.connect(mixes.sub);
      noise.connect(mixes.noise);
      filter.connect(amp);
      amp.connect(destination);
      graph = { amp, ctx, filter, lfo, lfoDepth, mixes, noise, osc, sub };
      applyAll();
      for (const source of [osc, sub, noise, lfo]) {
        source.start();
      }
    },
    /** Stops and disconnects everything this engine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      if (!graph) {
        return;
      }
      for (const source of [graph.osc, graph.sub, graph.noise, graph.lfo]) {
        source.stop();
        source.disconnect();
      }
      for (const node of [
        graph.mixes.osc,
        graph.mixes.sub,
        graph.mixes.noise,
        graph.lfoDepth,
        graph.filter,
        graph.amp,
      ]) {
        node.disconnect();
      }
      graph = null;
      gate = false;
      stack.length = 0;
    },
    noteOff(pitch: number) {
      const index = stack.indexOf(pitch);
      if (index === -1) {
        return;
      }
      stack.splice(index, 1);
      const last = stack.at(-1);
      if (last === undefined) {
        gate = false;
        close();
        return;
      }
      // A key is still down: the voice glides back to it, the gate stays open.
      tuneTo(last, glideSeconds(settings.glide));
    },
    noteOn(pitch: number) {
      if (!(graph && powered)) {
        return;
      }
      const { ctx } = graph;
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
      const legato = gate;
      stack.push(pitch);
      tuneTo(pitch, legato ? glideSeconds(settings.glide) : 0);
      gate = true;
      if (!legato) {
        open();
      }
    },
    setPower(on: boolean) {
      powered = on;
      if (!on) {
        stack.length = 0;
        gate = false;
        close();
      }
    },
    set<Key extends keyof Settings>(key: Key, value: Settings[Key]) {
      settings[key] = value;
      applyAll();
      // A held note follows the range the moment it changes.
      const held = stack.at(-1);
      if (key === "range" && held !== undefined) {
        tuneTo(held, 0);
      }
    },
  };
}
