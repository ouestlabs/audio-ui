/**
 * The sound of Selene-73: a tine electric piano. A key strikes a tine, a
 * tuned bar, and a pickup beside it hears it ring. Here that is two
 * frequency modulations on a sine: a body whose modulator sits on the same
 * pitch, so a hard key barks and a soft one is round, and a bell whose
 * modulator sits fourteen times higher and dies in a tenth of a second, the
 * ping of the hammer on the tine. The sum goes through a drive (the pickup and
 * the preamp running hot) and a tremolo.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Parameters move with ramps (never assigned), so a drag
 * makes no zipper noise, and the piano plays into the bus it is attached to,
 * which owns the master level and the safety limiter.
 */

export type Param = "bark" | "bell" | "decay" | "depth" | "drive" | "rate";
export type Settings = Record<Param, number>;

export const DEFAULTS: Settings & { volume: number } = {
  bark: 4,
  bell: 5,
  decay: 5,
  depth: 3,
  drive: 3,
  rate: 4,
  volume: 7,
};

export const VOICES = 10;
const BELL_RATIO = 14;
const SMOOTHING = 0.02;
/** Headroom: ten voices and the drive stay under the bus's limiter. */
const VOICE_GAIN = 0.16;
const MIN_VOLUME_DB = -40;
const MAX_VOLUME_DB = -3;
const SILENCE_DB = -60;
/** The softest key still sounds: a velocity of 0 is this fraction of a full one. */
const MIN_LEVEL = 0.3;
const RELEASE = 0.18;
const STEAL = 0.008;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const rateHertz = (value: number) => 1.5 * 6 ** unit(value);
export const driveGain = (value: number) => 1 + unit(value) * 5;
/** How long a note rings, in seconds, at middle C: the low keys ring longer, the high ones shorter. */
export const ringSeconds = (value: number, pitch: number) =>
  (0.8 + unit(value) * 5) * 2 ** ((60 - pitch) / 24);

/** The volume in decibels, never above unity, to the gain the bus takes. */
export function volumeGain(value: number) {
  const decibels =
    MIN_VOLUME_DB + unit(value) * (MAX_VOLUME_DB - MIN_VOLUME_DB);
  return value <= 0 || decibels <= SILENCE_DB ? 0 : 10 ** (decibels / 20);
}

function driveCurve() {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.8) / 1.8;
  }
  return curve;
}

interface Voice {
  amp: GainNode;
  oscillators: OscillatorNode[];
  pitch: number;
  released: boolean;
  startedAt: number;
}

interface Graph {
  ctx: BaseAudioContext;
  depth: GainNode;
  drive: GainNode;
  lfo: OscillatorNode;
  swing: GainNode;
  tremolo: GainNode;
  voices: GainNode;
}

export function createSeleneEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  const voices = new Set<Voice>();
  let graph: Graph | null = null;
  let unlock: (() => void) | null = null;

  const smooth = (param: AudioParam, value: number) => {
    if (graph) {
      param.setTargetAtTime(value, graph.ctx.currentTime, SMOOTHING);
    }
  };

  function applyTremolo() {
    if (!graph) {
      return;
    }
    const half = unit(settings.depth) * 0.45;
    smooth(graph.tremolo.gain, 1 - half);
    smooth(graph.swing.gain, half);
    smooth(graph.lfo.frequency, rateHertz(settings.rate));
  }

  function release(voice: Voice, fast = false) {
    if (!graph || voice.released) {
      return;
    }
    voice.released = true;
    const now = graph.ctx.currentTime;
    const tau = fast ? STEAL : RELEASE / 3;
    voice.amp.gain.cancelScheduledValues(now);
    voice.amp.gain.setValueAtTime(voice.amp.gain.value, now);
    voice.amp.gain.setTargetAtTime(0, now, tau);
    for (const osc of voice.oscillators) {
      osc.stop(now + tau * 8 + 0.05);
    }
  }

  function dispose(voice: Voice) {
    voices.delete(voice);
    for (const node of [...voice.oscillators, voice.amp]) {
      node.disconnect();
    }
  }

  return {
    /** Builds the drive and the tremolo into `destination` (the bus): nothing sounds until a key. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const voicesBus = ctx.createGain();
      const drive = ctx.createGain();
      drive.gain.value = driveGain(settings.drive);
      const shaper = ctx.createWaveShaper();
      shaper.curve = driveCurve();
      const makeup = ctx.createGain();
      makeup.gain.value = 0.8;
      const tremolo = ctx.createGain();
      const lfo = ctx.createOscillator();
      const swing = ctx.createGain();
      lfo.connect(swing).connect(tremolo.gain);
      lfo.start();
      voicesBus.connect(drive).connect(shaper).connect(makeup).connect(tremolo);
      tremolo.connect(destination);
      graph = {
        ctx,
        depth: swing,
        drive,
        lfo,
        swing,
        tremolo,
        voices: voicesBus,
      };
      const half = unit(settings.depth) * 0.45;
      tremolo.gain.value = 1 - half;
      swing.gain.value = half;
      lfo.frequency.value = rateHertz(settings.rate);
    },
    /** Stops every voice and the tremolo, and disconnects what this piano made; the shared context stays. */
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
        graph.voices.disconnect();
        graph.tremolo.disconnect();
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
    /** Strikes a key; `velocity` is from 0 to 1. The eleventh key takes the oldest voice. */
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
      const level = MIN_LEVEL + (1 - MIN_LEVEL) * velocity;
      const ring = ringSeconds(settings.decay, pitch);

      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, now);
      amp.gain.linearRampToValueAtTime(level * VOICE_GAIN, now + 0.003);
      // A tine rings down by itself, even with the key held.
      amp.gain.setTargetAtTime(0, now + 0.003, ring / 3);
      amp.connect(bus);

      const carrier = ctx.createOscillator();
      carrier.frequency.value = frequency;
      carrier.connect(amp);

      // The body: a modulator on the same pitch, harder with the key and the bark knob, and softer as the note rings.
      const body = ctx.createOscillator();
      body.frequency.value = frequency;
      const bodyIndex = ctx.createGain();
      const bark =
        unit(settings.bark) * (0.4 + 0.9 * velocity) * frequency * 1.6;
      bodyIndex.gain.setValueAtTime(bark, now);
      bodyIndex.gain.setTargetAtTime(bark * 0.12, now, 0.35);
      body.connect(bodyIndex).connect(carrier.frequency);

      // The bell: a modulator fourteen times up, gone in a tenth of a second.
      const bell = ctx.createOscillator();
      bell.frequency.value = frequency * BELL_RATIO;
      const bellIndex = ctx.createGain();
      const ping =
        unit(settings.bell) * (0.3 + 0.9 * velocity) * frequency * 1.2;
      bellIndex.gain.setValueAtTime(ping, now);
      bellIndex.gain.setTargetAtTime(0, now, 0.03);
      bell.connect(bellIndex).connect(carrier.frequency);

      const oscillators = [carrier, body, bell];
      const voice: Voice = {
        amp,
        oscillators,
        pitch,
        released: false,
        startedAt: now,
      };
      carrier.onended = () => dispose(voice);
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
    /** A control moved: the piano follows; a note already ringing keeps the timbre it was struck with. */
    set(key: Param, value: number) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      if (key === "drive") {
        smooth(graph.drive.gain, driveGain(value));
      }
      if (key === "depth" || key === "rate") {
        applyTremolo();
      }
    },
  };
}

export type SeleneEngine = ReturnType<typeof createSeleneEngine>;
