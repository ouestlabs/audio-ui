/**
 * The sound of Maia-16: a sixteen-band vocoder. A voice (the modulator) is
 * split by sixteen band-pass filters, and each band's loudness is followed:
 * rectified, then smoothed. A synth (the carrier) is split by sixteen matching
 * filters, and each of its bands is let through as loud as the voice's band
 * is. What comes out has the synth's pitch and the voice's vowels and
 * consonants: the keyboard sings the words.
 *
 * The carrier is a polyphonic synth of two detuned saws a key, with noise
 * mixed in so the hiss of an S or a T has something to shape. Formant moves
 * the carrier's bands against the voice's, for a smaller or a bigger throat.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps, and the engine plays into
 * the bus it is attached to, which owns the master level and the safety
 * limiter. The voice is never sent to the output, only what it shapes.
 */

export const BANDS = 16;
const LOWEST_BAND = 120;
const HIGHEST_BAND = 7600;
/** The bands' centers, spread evenly in octaves from 120 Hz to 7.6 kHz. */
export const BAND_HERTZ = Array.from(
  { length: BANDS },
  (_, index) =>
    LOWEST_BAND * (HIGHEST_BAND / LOWEST_BAND) ** (index / (BANDS - 1))
);
export const VOICES = 8;

export type Param =
  | "detune"
  | "formant"
  | "input"
  | "noise"
  | "response"
  | "volume";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings = {
  detune: 4,
  formant: 5,
  input: 5,
  noise: 3,
  response: 5,
  volume: 7,
};

/** Each band is two band-pass filters in a row: narrow enough to tell the bands apart, wide enough to leave no gaps. */
const BAND_Q = 5;
/** What a carrier voice puts in, each of its two saws: eight of them stay under the bus's limiter once split and shaped. */
const SAW_GAIN = 0.1;
/** The bands take a lot of level off (a band keeps a sliver of each signal, and is opened by a follower well under one): this brings it back. */
const MAKEUP = 30;
const SMOOTHING = 0.03;
const ATTACK = 0.008;
const RELEASE = 0.18;
const NOISE_SECONDS = 2;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

/** How hard the voice drives the bands: silent at 0, unity at 5, four times at 10. */
export const inputGain = (value: number) => unit(value) ** 2 * 4;
/** How fast a band follows the voice, as the follower's cutoff: slow and smooth at 0, quick and crisp at 10. */
export const responseHertz = (value: number) => 6 * 12 ** unit(value);
/** How far the carrier's bands move against the voice's, in semitones, from an octave down to an octave up. */
export const formantSemitones = (value: number) => (value - 5) * 2.4;
export const noiseGain = (value: number) => unit(value) * 0.25;
export const detuneCents = (value: number) => unit(value) * 24;

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

/** A full-wave rectifier: every sample made positive, so a smoothing filter after it reads the band's loudness. */
function rectifierCurve() {
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i += 1) {
    curve[i] = Math.abs((i / (curve.length - 1)) * 2 - 1);
  }
  return curve;
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

/** Two band-pass filters in a row at one center: a steeper band than one alone. */
function band(ctx: BaseAudioContext, frequency: number) {
  const first = ctx.createBiquadFilter();
  first.type = "bandpass";
  first.frequency.value = frequency;
  first.Q.value = BAND_Q;
  const second = ctx.createBiquadFilter();
  second.type = "bandpass";
  second.frequency.value = frequency;
  second.Q.value = BAND_Q;
  first.connect(second);
  return { first, second };
}

interface Voice {
  amp: GainNode;
  oscillators: OscillatorNode[];
  pitch: number;
  released: boolean;
  startedAt: number;
}

interface Graph {
  analysers: AnalyserNode[];
  carrier: GainNode;
  carrierBands: BiquadFilterNode[];
  ctx: BaseAudioContext;
  followers: BiquadFilterNode[];
  input: GainNode;
  noise: AudioBufferSourceNode;
  noiseLevel: GainNode;
  output: GainNode;
}

export function createMaiaEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const voices = new Set<Voice>();
  let graph: Graph | null = null;
  let source: AudioNode | null = null;
  let loop: { fade: GainNode; node: AudioBufferSourceNode } | null = null;
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
    const seconds = fast ? 0.02 : RELEASE;
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, now);
    voice.amp.gain.setTargetAtTime(0, now, seconds / 4);
    for (const osc of voice.oscillators) {
      osc.stop(now + seconds * 1.5 + 0.02);
    }
  }

  function dispose(voice: Voice) {
    voices.delete(voice);
    for (const osc of voice.oscillators) {
      osc.disconnect();
    }
    voice.amp.disconnect();
  }

  /** What each control moves in the graph, at a new value. */
  const FOLLOW: Partial<Record<Param, (on: Graph, value: number) => void>> = {
    detune: (_on, value) => {
      const spread = detuneCents(value);
      for (const voice of voices) {
        smooth((voice.oscillators[0] as OscillatorNode).detune, -spread);
        smooth((voice.oscillators[1] as OscillatorNode).detune, spread);
      }
    },
    formant: (on, value) => {
      const cents = formantSemitones(value) * 100;
      for (const filter of on.carrierBands) {
        smooth(filter.detune, cents);
      }
    },
    input: (on, value) => smooth(on.input.gain, inputGain(value)),
    noise: (on, value) => smooth(on.noiseLevel.gain, noiseGain(value)),
    response: (on, value) => {
      for (const follower of on.followers) {
        smooth(follower.frequency, responseHertz(value));
      }
    },
  };

  function stopLoop() {
    if (!(graph && loop)) {
      return;
    }
    const { fade, node } = loop;
    const now = graph.ctx.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + 0.02);
    node.stop(now + 0.05);
    node.onended = () => {
      node.disconnect();
      fade.disconnect();
    };
    loop = null;
  }

  return {
    /** The analysers on the voice's sixteen bands, low to high: the display reads them. */
    analysers: () => graph?.analysers ?? [],
    /** Builds the two banks into `destination` (the bus): nothing sounds until a voice speaks and a key is held. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const input = ctx.createGain();
      input.gain.value = inputGain(settings.input);
      const carrier = ctx.createGain();
      const output = ctx.createGain();
      output.gain.value = MAKEUP;
      output.connect(destination);
      const rectifier = rectifierCurve();
      const formant = formantSemitones(settings.formant) * 100;

      const analysers: AnalyserNode[] = [];
      const followers: BiquadFilterNode[] = [];
      const carrierBands: BiquadFilterNode[] = [];
      for (const frequency of BAND_HERTZ) {
        // The voice's band, and its loudness: rectified, then smoothed into a slow control signal.
        const analysis = band(ctx, frequency);
        input.connect(analysis.first);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analysis.second.connect(analyser);
        const rectify = ctx.createWaveShaper();
        rectify.curve = rectifier;
        const follower = ctx.createBiquadFilter();
        follower.type = "lowpass";
        follower.frequency.value = responseHertz(settings.response);
        follower.Q.value = -3;
        analysis.second.connect(rectify).connect(follower);

        // The synth's band, let through as loud as the voice's is.
        const synthesis = band(ctx, frequency);
        synthesis.first.detune.value = formant;
        synthesis.second.detune.value = formant;
        carrier.connect(synthesis.first);
        const gate = ctx.createGain();
        gate.gain.value = 0;
        follower.connect(gate.gain);
        synthesis.second.connect(gate).connect(output);

        analysers.push(analyser);
        followers.push(follower);
        carrierBands.push(synthesis.first, synthesis.second);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx);
      noise.loop = true;
      const noiseLevel = ctx.createGain();
      noiseLevel.gain.value = noiseGain(settings.noise);
      noise.connect(noiseLevel).connect(carrier);
      noise.start();

      graph = {
        analysers,
        carrier,
        carrierBands,
        ctx,
        followers,
        input,
        noise,
        noiseLevel,
        output,
      };
      if (source) {
        source.connect(input);
      }
    },
    /** Stops the loop, every voice and the noise, and disconnects what this engine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      if (loop) {
        loop.node.stop();
        loop.node.disconnect();
        loop = null;
      }
      for (const voice of [...voices]) {
        for (const osc of voice.oscillators) {
          osc.stop();
        }
        dispose(voice);
      }
      if (graph) {
        source?.disconnect(graph.input);
        graph.noise.stop();
        graph.noise.disconnect();
        graph.input.disconnect();
        graph.carrier.disconnect();
        graph.output.disconnect();
      }
      graph = null;
    },
    /** Lets a live voice (a microphone) be the modulator, or none; it is only read, never played out. */
    listen(node: AudioNode | null) {
      if (source && graph) {
        source.disconnect(graph.input);
      }
      source = node;
      if (source && graph) {
        source.connect(graph.input);
      }
    },
    noteOff(pitch: number) {
      for (const voice of voices) {
        if (voice.pitch === pitch && !voice.released) {
          release(voice);
        }
      }
    },
    /** Starts a carrier voice for a key; the ninth key takes the oldest. */
    noteOn(pitch: number) {
      if (!graph) {
        return;
      }
      const { carrier, ctx } = graph;
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
      const amp = ctx.createGain();
      amp.gain.value = 0;
      amp.gain.setTargetAtTime(SAW_GAIN, now, ATTACK / 3);
      amp.connect(carrier);
      const spread = detuneCents(settings.detune);
      const oscillators = [-spread, spread].map((cents) => {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = hertz(pitch);
        osc.detune.value = cents;
        osc.connect(amp);
        osc.start(now);
        return osc;
      });
      const voice: Voice = {
        amp,
        oscillators,
        pitch,
        released: false,
        startedAt: now,
      };
      (oscillators[0] as OscillatorNode).onended = () => dispose(voice);
      voices.add(voice);
    },
    /** Plays a recorded voice into the modulator, round and round. */
    play(buffer: AudioBuffer) {
      if (!graph) {
        return;
      }
      stopLoop();
      const node = graph.ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      const fade = graph.ctx.createGain();
      fade.gain.setValueAtTime(0, graph.ctx.currentTime);
      fade.gain.linearRampToValueAtTime(1, graph.ctx.currentTime + 0.02);
      node.connect(fade).connect(graph.input);
      node.start();
      loop = { fade, node };
    },
    /** Lets every carrier voice go: a panic, or the hold let off. */
    releaseAll() {
      for (const voice of voices) {
        release(voice);
      }
    },
    /** A control moved: the engine, and every voice sounding, follows. The volume is the bus's. */
    set(param: Param, value: number) {
      settings[param] = value;
      if (graph) {
        FOLLOW[param]?.(graph, value);
      }
    },
    stop() {
      stopLoop();
    },
  };
}

export type MaiaEngine = ReturnType<typeof createMaiaEngine>;
