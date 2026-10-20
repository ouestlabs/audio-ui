/**
 * The sound of Deneb-1: a tape echo. The input goes two ways: straight to the
 * output, and into a delay whose repeats come back through a filter, a tape
 * saturator and the intensity (the feedback), so each one is a little darker
 * and rounder than the last. Two slow oscillators, the wow and the flutter,
 * sway the delay time as an old transport does.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), so a drag
 * makes no zipper noise, and the unit plays into the bus it is attached to,
 * which owns the master level and the safety limiter. Stopping the loop leaves
 * the echoes to ring out, as a tape does.
 */

export type Param =
  | "echo"
  | "input"
  | "intensity"
  | "output"
  | "rate"
  | "tone"
  | "wow";
export type Source = "Drums" | "Keys" | "Pluck";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings = {
  echo: 6,
  input: 6,
  intensity: 4,
  output: 7,
  rate: 5,
  tone: 5,
  wow: 3,
};

export const SOURCES: readonly Source[] = ["Keys", "Drums", "Pluck"];

const SMOOTHING = 0.03;
/** The saturator's curve: the repeats round off instead of clipping. */
const DRIVE_CURVE_SAMPLES = 1024;
const WOW_HERTZ = 0.7;
const FLUTTER_HERTZ = 7.3;

const unit = (value: number) => value / 10;
/** The delay time: from a slap to nearly a second. */
export const rateSeconds = (value: number) => 0.06 * 15 ** unit(value);
/** The feedback: up to just under the point where the echoes would never die. */
export const feedbackGain = (value: number) => unit(value) * 0.93;
export const toneHertz = (value: number) => 600 * 12 ** unit(value);
export const echoGain = (value: number) => unit(value) ** 1.5 * 1.2;
export const driveGain = (value: number) => 0.35 + unit(value) * 1.65;
export const outputGain = (value: number) => unit(value) ** 2;
/** The wow's reach, in seconds of delay time; the flutter is a sixth of it. */
export const wowSeconds = (value: number) => unit(value) ** 2 * 0.006;

function saturationCurve() {
  const curve = new Float32Array(DRIVE_CURVE_SAMPLES);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    // A slope of one at rest: small repeats pass as they are, and only the loud ones round off.
    curve[i] = Math.tanh(x * 1.6) / 1.6;
  }
  return curve;
}

interface Graph {
  ctx: BaseAudioContext;
  delay: DelayNode;
  drive: GainNode;
  echo: GainNode;
  feedback: GainNode;
  flutter: GainNode;
  input: AnalyserNode;
  lfos: OscillatorNode[];
  mixer: GainNode;
  output: GainNode;
  outputAnalyser: AnalyserNode;
  tone: BiquadFilterNode;
  wow: GainNode;
}

export function createDenebEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const buffers = new Map<Source, AudioBuffer>();
  let graph: Graph | null = null;
  let playing: { fade: GainNode; source: AudioBufferSourceNode } | null = null;
  let current: Source = "Keys";

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function applyAll() {
    if (!graph) {
      return;
    }
    smooth(graph.drive.gain, driveGain(settings.input));
    smooth(graph.delay.delayTime, rateSeconds(settings.rate));
    smooth(graph.feedback.gain, feedbackGain(settings.intensity));
    smooth(graph.echo.gain, echoGain(settings.echo));
    smooth(graph.tone.frequency, toneHertz(settings.tone));
    smooth(graph.wow.gain, wowSeconds(settings.wow));
    smooth(graph.flutter.gain, wowSeconds(settings.wow) / 6);
    smooth(graph.output.gain, outputGain(settings.output));
  }

  /** Lets the loop go over a few milliseconds; the echoes keep ringing. */
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
    /** The analysers the two meters read: the input and the output. */
    analysers: () =>
      graph ? { input: graph.input, output: graph.outputAnalyser } : null,
    /** Builds the unit into `destination` (the bus): nothing sounds until the loop plays. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const drive = ctx.createGain();
      const input = ctx.createAnalyser();
      input.fftSize = 1024;
      const delay = ctx.createDelay(1.2);
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 140;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.Q.value = 0.5;
      const saturator = ctx.createWaveShaper();
      saturator.curve = saturationCurve();
      const feedback = ctx.createGain();
      const echo = ctx.createGain();
      const mixer = ctx.createGain();
      const output = ctx.createGain();
      const outputAnalyser = ctx.createAnalyser();
      outputAnalyser.fftSize = 1024;
      drive.connect(input);
      drive.connect(mixer);
      drive.connect(delay);
      delay.connect(high).connect(tone).connect(saturator);
      saturator.connect(feedback).connect(delay);
      saturator.connect(echo).connect(mixer);
      mixer.connect(output).connect(destination);
      output.connect(outputAnalyser);

      // The wow and the flutter sway the delay time.
      const wow = ctx.createGain();
      const flutter = ctx.createGain();
      const slow = ctx.createOscillator();
      slow.frequency.value = WOW_HERTZ;
      const fast = ctx.createOscillator();
      fast.frequency.value = FLUTTER_HERTZ;
      slow.connect(wow).connect(delay.delayTime);
      fast.connect(flutter).connect(delay.delayTime);
      slow.start();
      fast.start();

      graph = {
        ctx,
        delay,
        drive,
        echo,
        feedback,
        flutter,
        input,
        lfos: [slow, fast],
        mixer,
        output,
        outputAnalyser,
        tone,
        wow,
      };
      // The first values are set, not ramped: nothing is playing yet.
      drive.gain.value = driveGain(settings.input);
      delay.delayTime.value = rateSeconds(settings.rate);
      feedback.gain.value = feedbackGain(settings.intensity);
      echo.gain.value = echoGain(settings.echo);
      tone.frequency.value = toneHertz(settings.tone);
      wow.gain.value = wowSeconds(settings.wow);
      flutter.gain.value = wowSeconds(settings.wow) / 6;
      output.gain.value = outputGain(settings.output);
    },
    /** Stops the loop and the oscillators, and disconnects what this unit made; the shared context stays. */
    detach() {
      if (playing) {
        playing.source.stop();
        playing = null;
      }
      if (graph) {
        for (const lfo of graph.lfos) {
          lfo.stop();
        }
        graph.output.disconnect();
        graph.drive.disconnect();
      }
      graph = null;
    },
    /** Sets the loops the source switch chooses between. */
    load(next: Partial<Record<Source, AudioBuffer>>) {
      for (const [name, buffer] of Object.entries(next)) {
        if (buffer) {
          buffers.set(name as Source, buffer);
        }
      }
    },
    play(source: Source = current) {
      if (!graph) {
        return;
      }
      const buffer = buffers.get(source);
      if (!buffer) {
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
      loop.connect(fade).connect(graph.drive);
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

export type DenebEngine = ReturnType<typeof createDenebEngine>;
