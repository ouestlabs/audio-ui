/**
 * The sound of Mizar-1: a spring reverb. A spring does not echo like a room:
 * the sound runs down the coil and each frequency travels at its own speed, so a
 * click comes back as a chirp, and again, and again, a little darker each time.
 * Here a spring is a delay in a feedback loop with a row of all-pass filters in
 * it (each one delays the frequencies around its own a little more than the
 * rest: that is the dispersion), and two springs of different lengths run side
 * by side, as in a tank.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Everything moves with ramps, and the unit plays into the
 * bus it is attached to, which owns the master level and the safety limiter.
 * Stopping the loop lets the springs ring out.
 */

export type Source = "Keys" | "Pluck" | "Snare";
export const SOURCES: readonly Source[] = ["Pluck", "Snare", "Keys"];
export type Param = "decay" | "dwell" | "mix" | "output" | "tension" | "tone";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings = {
  decay: 6,
  dwell: 5,
  mix: 5,
  output: 7,
  tension: 5,
  tone: 5,
};

/** The two springs of the tank: how long the sound takes to run the coil once, in seconds. */
const SPRINGS = [0.031, 0.043] as const;
/** Where the all-pass filters sit, in hertz: the sound's dispersion. Tension scales them. */
const DISPERSION = [420, 700, 1150, 1800, 2900, 4600] as const;
const SMOOTHING = 0.03;
/** What the springs add back after the loop: their output is quiet next to the dry sound. */
const SPRING_GAIN = 2.5;

const unit = (value: number) => value / 10;
/** How hard the sound drives the springs: a little saturation at the top. */
export const dwellGain = (value: number) => 0.3 + unit(value) * 2.4;
export const tensionScale = (value: number) => 0.6 + unit(value) * 1.2;
/** How much of the sound comes back round the coil: up to just under the point where it would never die. */
export const feedbackGain = (value: number) => 0.5 + unit(value) * 0.42;
export const toneHertz = (value: number) => 1200 * 8 ** unit(value);
export const mixGain = (value: number) => unit(value) * 1.1;
export const outputGain = (value: number) => unit(value) ** 2;

function saturationCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / 1.6;
  }
  return curve;
}

interface Graph {
  allpasses: BiquadFilterNode[];
  bumpBuffer: AudioBuffer;
  ctx: BaseAudioContext;
  dwell: GainNode;
  feedbacks: GainNode[];
  input: GainNode;
  mix: GainNode;
  output: GainNode;
  outputAnalyser: AnalyserNode;
  springIn: GainNode;
  tone: BiquadFilterNode;
}

export function createMizarEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const buffers = new Map<Source, AudioBuffer>();
  let graph: Graph | null = null;
  let playing: { fade: GainNode; source: AudioBufferSourceNode } | null = null;
  let current: Source = "Pluck";

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function applyAll() {
    if (!graph) {
      return;
    }
    smooth(graph.dwell.gain, dwellGain(settings.dwell));
    smooth(graph.tone.frequency, toneHertz(settings.tone));
    smooth(graph.mix.gain, mixGain(settings.mix));
    smooth(graph.output.gain, outputGain(settings.output));
    for (const feedback of graph.feedbacks) {
      smooth(feedback.gain, feedbackGain(settings.decay));
    }
    for (const [index, filter] of graph.allpasses.entries()) {
      const base = DISPERSION[index % DISPERSION.length] ?? 1000;
      smooth(filter.frequency, base * tensionScale(settings.tension));
    }
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
    /** The analyser after the output: the springs shake with it, and a VU reads it. */
    analyser: () => graph?.outputAnalyser ?? null,
    /** Builds the tank into `destination` (the bus): nothing sounds until the loop plays or the tank is bumped. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const input = ctx.createGain();
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 90;
      const dwell = ctx.createGain();
      dwell.gain.value = dwellGain(settings.dwell);
      const saturator = ctx.createWaveShaper();
      saturator.curve = saturationCurve();
      const springIn = ctx.createGain();
      input.connect(high).connect(dwell).connect(saturator).connect(springIn);

      const sum = ctx.createGain();
      const allpasses: BiquadFilterNode[] = [];
      const feedbacks: GainNode[] = [];
      for (const length of SPRINGS) {
        // One spring: the sound goes round a loop of all-passes and a delay, and a little of it comes back each time.
        const join = ctx.createGain();
        springIn.connect(join);
        let node: AudioNode = join;
        for (const base of DISPERSION) {
          const filter = ctx.createBiquadFilter();
          filter.type = "allpass";
          filter.Q.value = 1.1;
          filter.frequency.value = base * tensionScale(settings.tension);
          allpasses.push(filter);
          node = node.connect(filter);
        }
        const delay = ctx.createDelay(0.2);
        delay.delayTime.value = length;
        const damp = ctx.createBiquadFilter();
        damp.type = "lowpass";
        damp.frequency.value = 3600;
        // A low-pass quality is in dB: the default of 1 dB peaks 2 dB, which with the feedback would carry the loop past a gain of one. -3 dB is flat.
        damp.Q.value = -3;
        const feedback = ctx.createGain();
        feedback.gain.value = feedbackGain(settings.decay);
        feedbacks.push(feedback);
        node.connect(delay);
        delay.connect(damp).connect(feedback).connect(join);
        delay.connect(sum);
      }

      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = toneHertz(settings.tone);
      const mix = ctx.createGain();
      mix.gain.value = mixGain(settings.mix);
      const output = ctx.createGain();
      output.gain.value = outputGain(settings.output);
      const outputAnalyser = ctx.createAnalyser();
      outputAnalyser.fftSize = 1024;
      sum.gain.value = SPRING_GAIN;
      sum.connect(tone).connect(mix).connect(output);
      input.connect(output);
      output.connect(destination);
      output.connect(outputAnalyser);

      // The thump of a hand on the tank: a few milliseconds of low noise.
      const bumpBuffer = ctx.createBuffer(
        1,
        Math.ceil(ctx.sampleRate * 0.06),
        ctx.sampleRate
      );
      const data = bumpBuffer.getChannelData(0);
      let low = 0;
      for (let i = 0; i < data.length; i += 1) {
        low += (Math.random() * 2 - 1 - low) * 0.12;
        data[i] = low * (1 - i / data.length) ** 2 * 6;
      }
      graph = {
        allpasses,
        bumpBuffer,
        ctx,
        dwell,
        feedbacks,
        input,
        mix,
        output,
        outputAnalyser,
        springIn,
        tone,
      };
    },
    /** Hits the tank: a thump straight into the springs, which answer with a crash. */
    bump() {
      if (!graph) {
        return;
      }
      const source = graph.ctx.createBufferSource();
      source.buffer = graph.bumpBuffer;
      const gain = graph.ctx.createGain();
      gain.gain.value = 1.2;
      source.connect(gain).connect(graph.springIn);
      source.start();
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
      };
    },
    /** Stops the loop and disconnects what this unit made; the shared context stays. */
    detach() {
      if (playing) {
        playing.source.stop();
        playing = null;
      }
      if (graph) {
        graph.input.disconnect();
        graph.output.disconnect();
        graph.springIn.disconnect();
      }
      graph = null;
    },
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
    set(param: Param, value: number) {
      settings[param] = value;
      applyAll();
    },
    stop() {
      fadeOut();
    },
  };
}

export type MizarEngine = ReturnType<typeof createMizarEngine>;
