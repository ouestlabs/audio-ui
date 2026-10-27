/**
 * The sound of Rhea-35: a tape-replay keyboard. Under each of its 35 keys
 * lies a strip of tape with one note recorded on it, in three tracks: flutes,
 * strings and a choir; the station chooses the track the heads read. Press a
 * key and its tape runs past the head; hold it for eight seconds and the tape
 * runs out, and the note stops however long the key stays down. Let go and a
 * spring pulls the tape back.
 *
 * The recordings are synthesized here, each the way its players would sound,
 * then everything goes through the tape: each key's strip a little off in
 * pitch and level from its neighbors, a hiss while it runs, the capstan's slow
 * wow and quick flutter on the pitch, a little saturation, and a tone control
 * that darkens the lot. The keys are not touch-sensitive: the tape plays at
 * the level it was recorded.
 *
 * The controls speak in the panel's 0 to 10 (the station is 0, 1 or 2); each
 * one is mapped here to the unit the node takes. Parameters move with ramps,
 * and the engine plays into the bus it is attached to, which owns the master
 * level and the safety limiter.
 */

export const LOWEST = 43;
export const HIGHEST = 77;
/** How long a strip of tape plays, in seconds, before it runs out. */
export const TAPE_SECONDS = 8;

export type Station = "Choir" | "Flutes" | "Strings";
export const STATIONS: readonly Station[] = ["Flutes", "Strings", "Choir"];
export type Param = "pitch" | "station" | "tone" | "volume" | "wow";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings = {
  pitch: 5,
  station: 1,
  tone: 6,
  volume: 7,
  wow: 4,
};

/** What a key's tape plays at: ten keys held stay under the bus's limiter. */
const VOICE_GAIN = 0.09;
/** Each track's level, so the three sound alike in loudness (measured on a chord). */
const STATION_GAIN: Record<Station, number> = {
  Choir: 3.4,
  Flutes: 0.7,
  Strings: 0.58,
};
/** How a recording starts, in seconds: a flute speaks quickly, a bow and a choir swell. */
const ATTACK: Record<Station, number> = {
  Choir: 0.32,
  Flutes: 0.06,
  Strings: 0.26,
};
/** The players' vibrato: how fast, how deep in cents, and after how long it comes in. */
const VIBRATO: Record<
  Station,
  { cents: number; delay: number; hertz: number }
> = {
  Choir: { cents: 9, delay: 0.5, hertz: 5.1 },
  Flutes: { cents: 13, delay: 0.35, hertz: 5.3 },
  Strings: { cents: 8, delay: 0.3, hertz: 5.8 },
};
/** The vowel the choir sings, "ah": its formants, how narrow, how loud. */
const AH = [
  { gain: 1, hertz: 720, q: 7 },
  { gain: 0.5, hertz: 1150, q: 9 },
  { gain: 0.22, hertz: 2600, q: 11 },
] as const;
/** The pads letting go of the tape, as a time constant, in seconds. */
const RELEASE = 0.05;
const HISS_GAIN = 0.012;
/** How far the capstan's slow wow and quick flutter bend the pitch, at the top of the knob, in cents. */
const MAX_WOW_CENTS = 16;
const MAX_FLUTTER_CENTS = 6;
const WOW_HERTZ = 0.55;
const FLUTTER_HERTZ = 6.7;
const SMOOTHING = 0.03;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const stationOf = (value: number) =>
  STATIONS[Math.round(value)] ?? "Strings";
/** The speed knob: up to a whole tone slower or faster, in cents. */
export const pitchCents = (value: number) => (value - 5) * 40;
export const toneHertz = (value: number) => 1200 * 12 ** unit(value);

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

/** Each key's strip is its own: a level and a tuning a little off, always the same for that key. */
function strip(pitch: number) {
  const seed = Math.sin(pitch * 12.9898) * 43_758.5453;
  const random = seed - Math.floor(seed);
  const other = Math.sin(pitch * 78.233) * 12_345.6789;
  return {
    cents: (random - 0.5) * 8,
    level: 10 ** (((other - Math.floor(other) - 0.5) * 3) / 20),
  };
}

function saturationCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.3) / Math.tanh(1.3);
  }
  return curve;
}

function noiseBuffer(ctx: BaseAudioContext) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

interface Voice {
  amp: GainNode;
  /** The oscillators the capstan and the speed knob bend: they let go of them when the voice ends. */
  bent: OscillatorNode[];
  nodes: AudioNode[];
  pitch: number;
  released: boolean;
  sources: AudioScheduledSourceNode[];
  startedAt: number;
}

interface Graph {
  bus: GainNode;
  ctx: BaseAudioContext;
  flutter: OscillatorNode;
  flutterDepth: GainNode;
  noise: AudioBuffer;
  output: GainNode;
  speed: ConstantSourceNode;
  tone: BiquadFilterNode;
  wow: OscillatorNode;
  wowDepth: GainNode;
}

export function createRheaEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const voices = new Map<number, Voice>();
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function dispose(voice: Voice) {
    if (voices.get(voice.pitch) === voice) {
      voices.delete(voice.pitch);
    }
    for (const node of [...voice.sources, ...voice.nodes, voice.amp]) {
      node.disconnect();
    }
    for (const osc of voice.bent) {
      graph?.speed.disconnect(osc.detune);
      graph?.wowDepth.disconnect(osc.detune);
      graph?.flutterDepth.disconnect(osc.detune);
    }
  }

  /** Lets the pads off a tape: the note fades in a few hundredths of a second. */
  function release(voice: Voice) {
    if (!graph || voice.released) {
      return;
    }
    voice.released = true;
    const now = graph.ctx.currentTime;
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, now);
    voice.amp.gain.setTargetAtTime(0, now, RELEASE);
    for (const source of voice.sources) {
      source.stop(now + RELEASE * 8);
    }
  }

  /** What a track's players put on tape for one note, into `into`: oscillators and noise, with their vibrato. */
  function record(
    ctx: BaseAudioContext,
    station: Station,
    pitch: number,
    into: AudioNode,
    now: number
  ) {
    if (!graph) {
      return { bent: [], nodes: [], sources: [] };
    }
    const { flutterDepth, noise, speed, wowDepth } = graph;
    const frequency = hertz(pitch);
    const { cents } = strip(pitch);
    const sources: AudioScheduledSourceNode[] = [];
    const nodes: AudioNode[] = [];
    const bent: OscillatorNode[] = [];

    const vibrato = VIBRATO[station];
    const lfo = ctx.createOscillator();
    lfo.frequency.value = vibrato.hertz * (0.95 + Math.random() * 0.1);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, now);
    depth.gain.setTargetAtTime(vibrato.cents, now + vibrato.delay, 0.3);
    lfo.connect(depth);
    sources.push(lfo);
    nodes.push(depth);

    const oscillator = (
      type: OscillatorType,
      ratio: number,
      detune: number
    ) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = frequency * ratio;
      osc.detune.value = cents + detune;
      speed.connect(osc.detune);
      wowDepth.connect(osc.detune);
      flutterDepth.connect(osc.detune);
      depth.connect(osc.detune);
      sources.push(osc);
      bent.push(osc);
      return osc;
    };
    const breath = (level: number, center: number, q: number) => {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      source.loopStart = Math.random();
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = center;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = level;
      source.connect(filter).connect(gain).connect(into);
      sources.push(source);
      nodes.push(filter, gain);
      return gain;
    };

    if (station === "Flutes") {
      // A near sine and a little of its octave, and the breath across the mouthpiece, with a chiff as it speaks.
      const body = oscillator("sine", 1, 0);
      const octave = oscillator("triangle", 2, 2);
      const octaveLevel = ctx.createGain();
      octaveLevel.gain.value = 0.12;
      body.connect(into);
      octave.connect(octaveLevel).connect(into);
      const air = breath(0.05, Math.min(frequency * 3, 4000), 1.2);
      air.gain.setValueAtTime(0.22, now);
      air.gain.setTargetAtTime(0.05, now + 0.03, 0.04);
      nodes.push(octaveLevel);
    } else if (station === "Strings") {
      // A section: three bows a little apart in tune, darkened as a body would.
      const body = ctx.createBiquadFilter();
      body.type = "lowpass";
      body.frequency.value = Math.min(7000, frequency * 7);
      body.Q.value = 0.5;
      for (const detune of [-9, 0, 7]) {
        oscillator("sawtooth", 1, detune).connect(body);
      }
      body.connect(into);
      nodes.push(body);
    } else {
      // A choir on "ah": two buzzes through the vowel's three formants, and some breath.
      const folds = ctx.createGain();
      oscillator("sawtooth", 1, -7).connect(folds);
      oscillator("sawtooth", 1, 6).connect(folds);
      for (const formant of AH) {
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = formant.hertz;
        filter.Q.value = formant.q;
        const gain = ctx.createGain();
        gain.gain.value = formant.gain;
        folds.connect(filter).connect(gain).connect(into);
        nodes.push(filter, gain);
      }
      breath(0.03, 2400, 0.8);
      nodes.push(folds);
    }

    // The tape's own hiss, for as long as it runs.
    breath(HISS_GAIN, 6000, 0.4);
    return { bent, nodes, sources };
  }

  return {
    /** Builds the tape path into `destination` (the bus): the capstan turns, nothing sounds until a key. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const bus = ctx.createGain();
      const saturator = ctx.createWaveShaper();
      saturator.curve = saturationCurve();
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 60;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = toneHertz(settings.tone);
      tone.Q.value = 0.4;
      const output = ctx.createGain();
      bus.connect(saturator).connect(high).connect(tone).connect(output);
      output.connect(destination);

      // The capstan: one slow wobble and one quick one, and the speed knob, on every oscillator's pitch.
      const wow = ctx.createOscillator();
      wow.frequency.value = WOW_HERTZ;
      const wowDepth = ctx.createGain();
      wowDepth.gain.value = unit(settings.wow) * MAX_WOW_CENTS;
      wow.connect(wowDepth);
      const flutter = ctx.createOscillator();
      flutter.frequency.value = FLUTTER_HERTZ;
      const flutterDepth = ctx.createGain();
      flutterDepth.gain.value = unit(settings.wow) * MAX_FLUTTER_CENTS;
      flutter.connect(flutterDepth);
      const speed = ctx.createConstantSource();
      speed.offset.value = pitchCents(settings.pitch);
      wow.start();
      flutter.start();
      speed.start();
      graph = {
        bus,
        ctx,
        flutter,
        flutterDepth,
        noise: noiseBuffer(ctx),
        output,
        speed,
        tone,
        wow,
        wowDepth,
      };
    },
    /** Stops every tape and the capstan, and disconnects what this engine made; the shared context stays. */
    detach() {
      if (unlock) {
        document.removeEventListener("pointerup", unlock);
        unlock = null;
      }
      for (const voice of [...voices.values()]) {
        for (const source of voice.sources) {
          source.stop();
        }
        dispose(voice);
      }
      if (graph) {
        for (const source of [graph.wow, graph.flutter, graph.speed]) {
          source.stop();
          source.disconnect();
        }
        graph.bus.disconnect();
        graph.output.disconnect();
      }
      graph = null;
    },
    noteOff(pitch: number) {
      const voice = voices.get(pitch);
      if (voice) {
        release(voice);
      }
    },
    /** A key goes down: its tape runs from the start, on the station's track, for eight seconds at most. */
    noteOn(pitch: number) {
      if (!graph || pitch < LOWEST || pitch > HIGHEST) {
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
      const previous = voices.get(pitch);
      if (previous) {
        release(previous);
      }
      const now = ctx.currentTime;
      const station = stationOf(settings.station);
      const level = VOICE_GAIN * STATION_GAIN[station] * strip(pitch).level;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, now);
      amp.gain.setTargetAtTime(level, now, ATTACK[station] / 3);
      // The end of the strip: the recording stops there, key down or not.
      const end = now + TAPE_SECONDS;
      amp.gain.setTargetAtTime(0, end - 0.05, 0.015);
      amp.connect(bus);
      const { bent, nodes, sources } = record(ctx, station, pitch, amp, now);
      const voice: Voice = {
        amp,
        bent,
        nodes,
        pitch,
        released: false,
        sources,
        startedAt: now,
      };
      for (const source of sources) {
        source.start(now);
        source.stop(end + 0.05);
      }
      (sources[0] as AudioScheduledSourceNode).onended = () => dispose(voice);
      voices.set(pitch, voice);
    },
    /** Lets every key go: a panic, or the page leaving. */
    releaseAll() {
      for (const voice of voices.values()) {
        release(voice);
      }
    },
    /** The tape left on the key that has played longest, in seconds: eight when no key is down. */
    remaining() {
      if (!graph) {
        return TAPE_SECONDS;
      }
      let least = TAPE_SECONDS;
      for (const voice of voices.values()) {
        if (!voice.released) {
          const left = voice.startedAt + TAPE_SECONDS - graph.ctx.currentTime;
          least = Math.min(least, Math.max(0, left));
        }
      }
      return least;
    },
    /** A control moved: the tape path follows at once; the station takes the next key. */
    set(param: Param, value: number) {
      settings[param] = value;
      if (!graph) {
        return;
      }
      if (param === "pitch") {
        smooth(graph.speed.offset, pitchCents(value));
      } else if (param === "tone") {
        smooth(graph.tone.frequency, toneHertz(value));
      } else if (param === "wow") {
        smooth(graph.wowDepth.gain, unit(value) * MAX_WOW_CENTS);
        smooth(graph.flutterDepth.gain, unit(value) * MAX_FLUTTER_CENTS);
      }
    },
  };
}

export type RheaEngine = ReturnType<typeof createRheaEngine>;
