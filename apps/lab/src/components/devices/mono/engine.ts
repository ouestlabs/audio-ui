export type Wave = "sawtooth" | "sine" | "square" | "triangle";

export interface MonoSettings {
  /** Filter cutoff, in hertz. */
  cutoff: number;
  /** How long a note takes to fade out, in seconds. */
  release: number;
  /** Master level, in decibels. */
  volume: number;
  wave: Wave;
}

/** What one note adds before the master level: eight at once stay under full scale. */
const VOICE_GAIN = 0.12;
/** How fast a control moves a parameter: slow enough that a drag makes no click. */
const SMOOTHING = 0.02;
const ATTACK = 0.008;

const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);
const gainOf = (decibels: number) => 10 ** (decibels / 20);

interface Voice {
  gain: GainNode;
  oscillator: OscillatorNode;
}

/**
 * One oscillator per held note into a shared low-pass filter. The audio
 * context starts with the first note, which is a click or a key press, as
 * browsers ask.
 */
export function createMonoEngine(initial: MonoSettings) {
  const settings = { ...initial };
  const held = new Map<number, Voice>();
  const fading = new Set<Voice>();
  let context: AudioContext | null = null;
  let filter: BiquadFilterNode | null = null;
  let master: GainNode | null = null;

  function ensure() {
    if (!(context && filter && master)) {
      context = new AudioContext();
      filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = settings.cutoff;
      master = context.createGain();
      master.gain.value = gainOf(settings.volume);
      filter.connect(master);
      master.connect(context.destination);
    }
    if (context.state === "suspended") {
      context.resume();
    }
    return { context, filter };
  }

  function stop(voice: Voice) {
    voice.oscillator.stop();
    voice.oscillator.disconnect();
    voice.gain.disconnect();
    fading.delete(voice);
  }

  return {
    dispose() {
      for (const voice of [...held.values(), ...fading]) {
        stop(voice);
      }
      held.clear();
      context?.close();
      context = null;
      filter = null;
      master = null;
    },
    noteOff(pitch: number) {
      const voice = held.get(pitch);
      if (!(voice && context)) {
        return;
      }
      held.delete(pitch);
      fading.add(voice);
      const now = context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, settings.release / 4);
      voice.oscillator.stop(now + settings.release + 0.1);
      voice.oscillator.onended = () => stop(voice);
    },
    noteOn(pitch: number) {
      if (held.has(pitch)) {
        return;
      }
      const { context: audio, filter: lowpass } = ensure();
      const oscillator = audio.createOscillator();
      oscillator.type = settings.wave;
      oscillator.frequency.value = hertz(pitch);
      const gain = audio.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(VOICE_GAIN, audio.currentTime, ATTACK);
      oscillator.connect(gain);
      gain.connect(lowpass);
      oscillator.start();
      held.set(pitch, { gain, oscillator });
    },
    set<Key extends keyof MonoSettings>(key: Key, value: MonoSettings[Key]) {
      settings[key] = value;
      if (!context) {
        return;
      }
      const now = context.currentTime;
      if (key === "cutoff") {
        filter?.frequency.setTargetAtTime(settings.cutoff, now, SMOOTHING);
      }
      if (key === "volume") {
        master?.gain.setTargetAtTime(gainOf(settings.volume), now, SMOOTHING);
      }
    },
  };
}
