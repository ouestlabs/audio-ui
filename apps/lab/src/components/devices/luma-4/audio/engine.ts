/**
 * The sound of Luma-4: a photocell vibe. A lamp pulses inside a box, and four
 * light-dependent cells around it set four phase-shift stages: the brighter
 * the lamp, the lower each cell's resistance and the higher the frequency its
 * stage turns the phase around. The stages sit far apart (their capacitors
 * differ), so the sound sweeps in a lopsided, throbbing way, not as an even
 * phaser does. A filament heats fast and cools slowly, and a cell answers
 * light with a lag of its own, so the sweep rises quickly and falls back
 * slowly: that shape is the lamp's wave here, computed once.
 *
 * Chorus mixes the shifted sound with the dry one (moving notches); vibrato
 * plays the shifted sound alone, and the moving phase is heard as pitch.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Everything moves with ramps, and the unit plays into the
 * bus it is attached to, which owns the master level and the safety limiter.
 */

export type Source = "Drums" | "Guitar" | "Organ";
export const SOURCES: readonly Source[] = ["Guitar", "Organ", "Drums"];
export type Mode = "Chorus" | "Vibrato";
export const MODES: readonly Mode[] = ["Chorus", "Vibrato"];
export type Param = "intensity" | "speed" | "volume";
export type Settings = Record<Param, number> & { mode: Mode };

export const DEFAULTS: Settings = {
  intensity: 6,
  mode: "Chorus",
  speed: 4,
  volume: 7,
};

/** Where each stage turns the phase with the lamp dark, in hertz: spread wide, as the four capacitors are. */
const STAGES = [90, 480, 1900, 5200] as const;
/** A stage's all-pass: a broad one, close to the single pole of the circuit. */
const STAGE_Q = 0.5;
/** How far the lamp at full brightness moves every stage, at the top of the intensity: two octaves and a half. */
const MAX_SWEEP_CENTS = 3000;
const SMOOTHING = 0.03;
const HARMONICS = 48;
/** The lamp never goes fully dark: a bias keeps the filament warm. */
const BIAS = 0.1;
/** How fast a filament heats and cools, as shares of a cycle: it lights at once and fades slowly. */
const HEAT = 0.06;
const COOL = 0.22;

const unit = (value: number) => value / 10;
export const speedHertz = (value: number) => 0.6 * 20 ** unit(value);
export const sweepCents = (value: number) => unit(value) * MAX_SWEEP_CENTS;
export const volumeGain = (value: number) => unit(value) ** 2 * 1.4;

/**
 * One cycle of the lamp's light, from 0 (dim) to 1 (bright): the drive is a
 * sine, the filament's power its square over a bias, and the light follows it
 * through a lag that heats fast and cools slowly, run until it repeats.
 */
export function lampCycle(samples = 512) {
  const light = new Float32Array(samples);
  let level = 0;
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < samples; i += 1) {
      const drive = (1 + Math.sin((2 * Math.PI * i) / samples)) / 2;
      const power = BIAS + (1 - BIAS) * drive * drive;
      const rate = power > level ? HEAT : COOL;
      level += (power - level) * (1 - Math.exp(-1 / (rate * samples)));
      light[i] = level;
    }
  }
  return light;
}

/** The lamp's light as an oscillator's wave, from -1 to 1, by its Fourier series. */
function lampWave(ctx: BaseAudioContext) {
  const light = lampCycle();
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const value of light) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let n = 1; n < HARMONICS; n += 1) {
    let cos = 0;
    let sin = 0;
    for (const [i, value] of light.entries()) {
      const centered = ((value - low) / (high - low)) * 2 - 1;
      const angle = (2 * Math.PI * n * i) / light.length;
      cos += centered * Math.cos(angle);
      sin += centered * Math.sin(angle);
    }
    real[n] = (2 * cos) / light.length;
    imag[n] = (2 * sin) / light.length;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

/** How each mode mixes the shifted sound, the dry one, and the untouched one the footswitch passes. */
const MIXES: Record<
  Mode | "Bypass",
  { bypass: number; dry: number; wet: number }
> = {
  Bypass: { bypass: 1, dry: 0, wet: 0 },
  Chorus: { bypass: 0, dry: 0.5, wet: 0.5 },
  Vibrato: { bypass: 0, dry: 0, wet: 1 },
};

/** The preamp's warmth: a soft curve that rounds the peaks a little. */
function preampCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
  }
  return curve;
}

interface Graph {
  bypass: GainNode;
  ctx: BaseAudioContext;
  depth: GainNode;
  dry: GainNode;
  input: GainNode;
  lamp: OscillatorNode;
  lampAnalyser: AnalyserNode;
  output: GainNode;
  wet: GainNode;
}

export function createLumaEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const buffers = new Map<Source, AudioBuffer>();
  let graph: Graph | null = null;
  let playing: { fade: GainNode; source: AudioBufferSourceNode } | null = null;
  let current: Source = "Guitar";
  let engaged = true;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  /** The mix the mode and the footswitch make: chorus is half dry, half shifted; vibrato is shifted alone; bypassed, the dry sound passes untouched. */
  function applyMix() {
    if (!graph) {
      return;
    }
    const mix = MIXES[engaged ? settings.mode : "Bypass"];
    smooth(graph.wet.gain, mix.wet);
    smooth(graph.dry.gain, mix.dry);
    smooth(graph.bypass.gain, mix.bypass);
  }

  function fadeOut() {
    if (!(graph && playing)) {
      return;
    }
    const { fade, source } = playing;
    const now = graph.ctx.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + 0.02);
    source.stop(now + 0.05);
    source.onended = () => {
      source.disconnect();
      fade.disconnect();
    };
    playing = null;
  }

  return {
    /** Builds the unit into `destination` (the bus): the lamp starts pulsing, nothing sounds until a loop plays. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const input = ctx.createGain();
      const preamp = ctx.createWaveShaper();
      preamp.curve = preampCurve();
      preamp.oversample = "2x";
      input.connect(preamp);

      // The lamp: a slow oscillator of its own wave; its depth is how far it moves the stages, in cents.
      const lamp = ctx.createOscillator();
      lamp.setPeriodicWave(lampWave(ctx));
      lamp.frequency.value = speedHertz(settings.speed);
      const depth = ctx.createGain();
      depth.gain.value = sweepCents(settings.intensity) / 2;
      lamp.connect(depth);
      const lampAnalyser = ctx.createAnalyser();
      lampAnalyser.fftSize = 32;
      lamp.connect(lampAnalyser);

      // Four stages in a row, each one's center set by its cell: half the sweep above the dark lamp's place, on average.
      let node: AudioNode = preamp;
      for (const hertz of STAGES) {
        const stage = ctx.createBiquadFilter();
        stage.type = "allpass";
        stage.Q.value = STAGE_Q;
        stage.frequency.value = hertz;
        stage.detune.value = sweepCents(settings.intensity) / 2;
        depth.connect(stage.detune);
        node = node.connect(stage);
      }

      const wet = ctx.createGain();
      const dry = ctx.createGain();
      const bypass = ctx.createGain();
      const output = ctx.createGain();
      output.gain.value = volumeGain(settings.volume);
      node.connect(wet).connect(output);
      preamp.connect(dry).connect(output);
      input.connect(bypass).connect(destination);
      output.connect(destination);
      lamp.start();
      graph = {
        bypass,
        ctx,
        depth,
        dry,
        input,
        lamp,
        lampAnalyser,
        output,
        wet,
      };
      applyMix();
    },
    /** Stops the loop and the lamp, and disconnects what this unit made; the shared context stays. */
    detach() {
      if (playing) {
        playing.source.stop();
        playing = null;
      }
      if (graph) {
        graph.lamp.stop();
        graph.lamp.disconnect();
        graph.input.disconnect();
        graph.output.disconnect();
        graph.bypass.disconnect();
      }
      graph = null;
    },
    /** Turns the effect on or off, as the footswitch does: off, the loop passes dry. */
    engage(on: boolean) {
      engaged = on;
      applyMix();
    },
    /** The lamp's wave as it plays, from -1 (dim) to 1 (bright): the window's bulb glows with it. */
    lamp: () => graph?.lampAnalyser ?? null,
    load(next: Partial<Record<Source, AudioBuffer>>) {
      for (const [name, buffer] of Object.entries(next)) {
        if (buffer) {
          buffers.set(name as Source, buffer);
        }
      }
    },
    play(source: Source = current) {
      const buffer = buffers.get(source);
      if (!(graph && buffer)) {
        return;
      }
      fadeOut();
      current = source;
      const loop = graph.ctx.createBufferSource();
      loop.buffer = buffer;
      loop.loop = true;
      const fade = graph.ctx.createGain();
      fade.gain.setValueAtTime(0, graph.ctx.currentTime);
      fade.gain.linearRampToValueAtTime(1, graph.ctx.currentTime + 0.02);
      loop.connect(fade).connect(graph.input);
      loop.start();
      playing = { fade, source: loop };
    },
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      if (key === "mode") {
        applyMix();
      } else if (key === "speed") {
        smooth(graph.lamp.frequency, speedHertz(settings.speed));
      } else if (key === "intensity") {
        smooth(graph.depth.gain, sweepCents(settings.intensity) / 2);
      } else if (key === "volume") {
        smooth(graph.output.gain, volumeGain(settings.volume));
      }
    },
    stop() {
      fadeOut();
    },
  };
}

export type LumaEngine = ReturnType<typeof createLumaEngine>;
