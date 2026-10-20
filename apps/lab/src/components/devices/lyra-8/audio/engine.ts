/**
 * The sound of Lyra-8: an eight-voice polyphonic analog synth. Every key gets
 * a voice of its own: a saw, a pulse, a sub oscillator and noise, mixed into a
 * low-pass filter that an envelope opens, then an amplifier shaped by the same
 * ADSR. One slow oscillator, shared, wobbles every voice's pitch, and a stereo
 * chorus widens the sum of them.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), so a drag
 * makes no zipper noise, and the engine plays into the bus it is attached to,
 * which owns the master level and the safety limiter.
 */

export const VOICES = 8;

export type Chorus = "I" | "II" | "Off";
export type Param =
  | "attack"
  | "contour"
  | "cutoff"
  | "decay"
  | "keys"
  | "noise"
  | "pulse"
  | "rate"
  | "release"
  | "resonance"
  | "saw"
  | "sub"
  | "sustain"
  | "vibrato"
  | "width";
export type Settings = Record<Param, number> & { chorus: Chorus };

export const DEFAULTS: Settings & { volume: number } = {
  attack: 1,
  chorus: "I",
  contour: 4,
  cutoff: 6,
  decay: 5,
  keys: 5,
  noise: 0,
  pulse: 4,
  rate: 4,
  release: 3,
  resonance: 2,
  saw: 7,
  sub: 3,
  sustain: 7,
  vibrato: 0,
  volume: 7,
  width: 3,
};

/** What each source adds before the filter: with eight voices and the resonance, the loudest case stays under the bus's limiter. */
const SOURCE_GAIN = 0.1;
/** How fast a control moves a parameter: slow enough for a drag to make no click. */
const SMOOTHING = 0.02;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;
/** The softest key still sounds: a velocity of 0 is this fraction of a full one. */
const MIN_LEVEL = 0.25;
const NOISE_SECONDS = 2;
const HARMONICS = 96;
/** How fast a stolen or retriggered voice goes, as a time constant, in seconds. */
const STEAL = 0.006;
const MIDDLE_C = 261.63;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const cutoffHertz = (value: number) => 40 * 300 ** unit(value);
export const resonanceDecibels = (value: number) => unit(value) * 14;
export const contourCents = (value: number) => unit(value) * 4800;
export const rateHertz = (value: number) => 0.2 * 100 ** unit(value);
export const vibratoCents = (value: number) => unit(value) ** 2 * 80;
export const attackSeconds = (value: number) => 0.003 * 600 ** unit(value);
export const decaySeconds = (value: number) => 0.01 * 300 ** unit(value);
export const releaseSeconds = (value: number) => 0.01 * 500 ** unit(value);
/** The pulse's width: a square at the bottom of the slider, thin at the top. */
export const pulseWidth = (value: number) => 0.5 - unit(value) * 0.45;

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

/** What each chorus stop does: how fast the delay sweeps, how far, and how much of it is heard. */
const CHORUS: Record<Chorus, { depth: number; rate: number; wet: number }> = {
  I: { depth: 0.0018, rate: 0.5, wet: 0.65 },
  II: { depth: 0.0026, rate: 0.83, wet: 0.7 },
  Off: { depth: 0.0018, rate: 0.5, wet: 0 },
};

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

interface Voice {
  amp: GainNode;
  filter: BiquadFilterNode;
  frequency: number;
  level: number;
  mixes: { noise: GainNode; pulse: GainNode; saw: GainNode; sub: GainNode };
  oscillators: OscillatorNode[];
  pitch: number;
  pulse: OscillatorNode;
  released: boolean;
  source: AudioBufferSourceNode;
  startedAt: number;
}

interface Graph {
  bus: GainNode;
  chorus: {
    depthLeft: GainNode;
    depthRight: GainNode;
    lfo: OscillatorNode;
    wet: GainNode;
  };
  ctx: BaseAudioContext;
  lfo: OscillatorNode;
  lfoDepth: GainNode;
  noise: AudioBuffer;
}

export function createLyraEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const voices = new Set<Voice>();
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  /** Where the cutoff sits for a note: the keyboard tracking carries it up and down with the pitch. */
  const cutoffFor = (frequency: number) =>
    cutoffHertz(settings.cutoff) *
    (frequency / MIDDLE_C) ** unit(settings.keys);

  function applyChorus() {
    if (!graph) {
      return;
    }
    const stop = CHORUS[settings.chorus];
    smooth(graph.chorus.lfo.frequency, stop.rate);
    smooth(graph.chorus.depthLeft.gain, stop.depth);
    smooth(graph.chorus.depthRight.gain, -stop.depth);
    smooth(graph.chorus.wet.gain, stop.wet);
  }

  /** Lets a voice go along the release, or fast when it is taken for a new note. */
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
    voice.filter.detune.cancelScheduledValues(now);
    voice.filter.detune.setValueAtTime(voice.filter.detune.value, now);
    voice.filter.detune.setTargetAtTime(0, now, fast ? STEAL : seconds / 4);
    const end = now + seconds * 1.4 + 0.05;
    for (const osc of voice.oscillators) {
      osc.stop(end);
    }
    voice.source.stop(end);
  }

  function dispose(voice: Voice) {
    voices.delete(voice);
    for (const osc of voice.oscillators) {
      graph?.lfoDepth.disconnect(osc.detune);
      osc.disconnect();
    }
    voice.source.disconnect();
    for (const node of Object.values(voice.mixes)) {
      node.disconnect();
    }
    voice.filter.disconnect();
    voice.amp.disconnect();
  }

  /** What a sounding voice does when one control moves; the ones that only matter to the next note are not listed. */
  const mixLevel =
    (source: "noise" | "pulse" | "saw" | "sub") => (held: Voice) =>
      smooth(held.mixes[source].gain, unit(settings[source]) * SOURCE_GAIN);
  const tracking = (held: Voice) =>
    smooth(held.filter.frequency, cutoffFor(held.frequency));
  const FOLLOW: Partial<Record<Param, (held: Voice) => void>> = {
    cutoff: tracking,
    keys: tracking,
    noise: mixLevel("noise"),
    pulse: mixLevel("pulse"),
    resonance: (held) =>
      smooth(held.filter.Q, resonanceDecibels(settings.resonance)),
    saw: mixLevel("saw"),
    sub: mixLevel("sub"),
    width: (held) => {
      if (graph) {
        held.pulse.setPeriodicWave(
          pulseWave(graph.ctx, pulseWidth(settings.width))
        );
      }
    },
  };

  return {
    /** Builds the chorus and the shared oscillator into `destination` (the bus): nothing sounds until a key. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const bus = ctx.createGain();
      const dry = ctx.createGain();
      bus.connect(dry).connect(destination);
      const left = ctx.createDelay(0.05);
      const right = ctx.createDelay(0.05);
      left.delayTime.value = 0.0065;
      right.delayTime.value = 0.0065;
      const merger = ctx.createChannelMerger(2);
      bus.connect(left).connect(merger, 0, 0);
      bus.connect(right).connect(merger, 0, 1);
      const wet = ctx.createGain();
      wet.gain.value = 0;
      merger.connect(wet).connect(destination);
      const chorusLfo = ctx.createOscillator();
      chorusLfo.type = "triangle";
      const depthLeft = ctx.createGain();
      const depthRight = ctx.createGain();
      chorusLfo.connect(depthLeft).connect(left.delayTime);
      chorusLfo.connect(depthRight).connect(right.delayTime);
      chorusLfo.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rateHertz(settings.rate);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = vibratoCents(settings.vibrato);
      lfo.connect(lfoDepth);
      lfo.start();
      graph = {
        bus,
        chorus: { depthLeft, depthRight, lfo: chorusLfo, wet },
        ctx,
        lfo,
        lfoDepth,
        noise: noiseBuffer(ctx),
      };
      applyChorus();
    },
    /** Stops every voice and the oscillators, and disconnects what this engine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      for (const voice of [...voices]) {
        for (const osc of voice.oscillators) {
          osc.stop();
        }
        voice.source.stop();
        dispose(voice);
      }
      if (graph) {
        graph.lfo.stop();
        graph.chorus.lfo.stop();
        graph.bus.disconnect();
        graph.chorus.wet.disconnect();
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
    /** Starts a voice for a key; `velocity` is from 0 to 1. The ninth key takes the oldest voice. */
    noteOn(pitch: number, velocity = 1) {
      if (!graph) {
        return;
      }
      const { bus, ctx, lfoDepth, noise } = graph;
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
      const level = MIN_LEVEL + (1 - MIN_LEVEL) * velocity;
      const saw = ctx.createOscillator();
      saw.type = "sawtooth";
      saw.frequency.value = frequency;
      const pulse = ctx.createOscillator();
      pulse.setPeriodicWave(pulseWave(ctx, pulseWidth(settings.width)));
      pulse.frequency.value = frequency;
      const sub = ctx.createOscillator();
      sub.type = "square";
      sub.frequency.value = frequency / 2;
      const oscillators = [saw, pulse, sub];
      for (const osc of oscillators) {
        lfoDepth.connect(osc.detune);
      }
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const mixes = {
        noise: ctx.createGain(),
        pulse: ctx.createGain(),
        saw: ctx.createGain(),
        sub: ctx.createGain(),
      };
      mixes.saw.gain.value = unit(settings.saw) * SOURCE_GAIN;
      mixes.pulse.gain.value = unit(settings.pulse) * SOURCE_GAIN;
      mixes.sub.gain.value = unit(settings.sub) * SOURCE_GAIN;
      mixes.noise.gain.value = unit(settings.noise) * SOURCE_GAIN;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = cutoffFor(frequency);
      filter.Q.value = resonanceDecibels(settings.resonance);
      const amp = ctx.createGain();
      amp.gain.value = 0;
      saw.connect(mixes.saw).connect(filter);
      pulse.connect(mixes.pulse).connect(filter);
      sub.connect(mixes.sub).connect(filter);
      source.connect(mixes.noise).connect(filter);
      filter.connect(amp).connect(bus);

      // The ADSR opens the amplifier and the filter together, from where they are.
      const attack = attackSeconds(settings.attack);
      const decay = decaySeconds(settings.decay);
      const sustain = unit(settings.sustain);
      const contour = contourCents(settings.contour);
      amp.gain.setTargetAtTime(level, now, attack / 4);
      amp.gain.setTargetAtTime(level * sustain, now + attack, decay / 3);
      filter.detune.setTargetAtTime(contour, now, attack / 4);
      filter.detune.setTargetAtTime(contour * sustain, now + attack, decay / 3);

      const voice: Voice = {
        amp,
        filter,
        frequency,
        level,
        mixes,
        oscillators,
        pitch,
        pulse,
        released: false,
        source,
        startedAt: now,
      };
      saw.onended = () => dispose(voice);
      voices.add(voice);
      for (const osc of oscillators) {
        osc.start(now);
      }
      source.start(now);
    },
    /** Lets every voice go: a panic, or a patch change that should not leave old notes ringing. */
    releaseAll() {
      for (const voice of voices) {
        release(voice);
      }
    },
    /** A control moved: the engine, and every voice sounding, follows. */
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      if (key === "chorus") {
        applyChorus();
        return;
      }
      if (key === "rate") {
        smooth(graph.lfo.frequency, rateHertz(settings.rate));
        return;
      }
      if (key === "vibrato") {
        smooth(graph.lfoDepth.gain, vibratoCents(settings.vibrato));
        return;
      }
      const follow = FOLLOW[key as Param];
      if (follow) {
        for (const voice of voices) {
          follow(voice);
        }
      }
    },
  };
}

export type LyraEngine = ReturnType<typeof createLyraEngine>;
