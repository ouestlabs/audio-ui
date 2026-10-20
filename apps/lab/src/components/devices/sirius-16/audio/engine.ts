/**
 * The sound of Sirius-16: a monophonic bass voice, played by the sequencer. One
 * oscillator, always running, into a resonant low-pass filter that an envelope
 * opens on each note, then an amplifier. An accented step opens the filter
 * further and plays louder; a slid step glides to its pitch from the note
 * before, with no new envelope, as the notes of a tied phrase do.
 *
 * The controls speak in the panel's 0 to 10; each one is mapped here to the
 * unit the node takes. Notes are scheduled on the audio clock (`time`), so the
 * line keeps its feel whatever the page is doing, and the voice plays into the
 * bus it is attached to, which owns the master level and the safety limiter.
 */

export type Wave = "Saw" | "Square";
export type Param = "accent" | "cutoff" | "decay" | "envmod" | "resonance";
export interface Settings {
  accent: number;
  cutoff: number;
  decay: number;
  envmod: number;
  resonance: number;
  wave: Wave;
}

export const DEFAULTS: Settings = {
  accent: 6,
  cutoff: 4,
  decay: 4,
  envmod: 6,
  resonance: 6,
  wave: "Saw",
};

/** The lowest note a pitch of 0 plays: C2. */
export const ROOT = 36;
export const SPAN = 24;

const ATTACK = 0.003;
const RELEASE = 0.012;
const GLIDE = 0.07;
const NOTE_LEVEL = 0.32;
const ACCENT_LEVEL = 0.5;
const OCTAVES_OF_ENVELOPE = 4;

const unit = (value: number) => value / 10;
const hertz = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export const cutoffHertz = (value: number) => 60 * 80 ** unit(value);
export const resonanceDecibels = (value: number) => unit(value) * 14;
/** The filter's decay after a note: a stab to a long drawl. */
export const decaySeconds = (value: number) => 0.08 * 25 ** unit(value);

export function createSiriusEngine(initial: Settings = DEFAULTS) {
  const settings = { ...initial };
  /** The pitch the oscillator was last sent to, where a slide starts from. */
  let lastFrequency = hertz(ROOT);
  let graph: {
    amp: GainNode;
    ctx: BaseAudioContext;
    first: BiquadFilterNode;
    osc: OscillatorNode;
    second: BiquadFilterNode;
  } | null = null;

  return {
    /** Builds the voice into `destination` (the bus): nothing sounds until a note. */
    attach(destination: AudioNode) {
      const ctx = destination.context;
      const osc = ctx.createOscillator();
      osc.type = settings.wave === "Saw" ? "sawtooth" : "square";
      osc.frequency.value = hertz(ROOT);
      // Two low-pass stages make a steeper slope, the first one carrying the resonance.
      const first = ctx.createBiquadFilter();
      first.type = "lowpass";
      first.frequency.value = cutoffHertz(settings.cutoff);
      first.Q.value = resonanceDecibels(settings.resonance);
      const second = ctx.createBiquadFilter();
      second.type = "lowpass";
      second.frequency.value = cutoffHertz(settings.cutoff);
      second.Q.value = 0.7;
      const amp = ctx.createGain();
      amp.gain.value = 0;
      osc.connect(first).connect(second).connect(amp).connect(destination);
      osc.start();
      graph = { amp, ctx, first, osc, second };
    },
    /** Stops the oscillator and disconnects what this voice made; the shared context stays. */
    detach() {
      if (graph) {
        graph.osc.stop();
        graph.amp.disconnect();
      }
      graph = null;
    },
    /** Closes the note now, for a stop or a seek: no note is left hanging. */
    silence() {
      if (!graph) {
        return;
      }
      const now = graph.ctx.currentTime;
      graph.amp.gain.cancelScheduledValues(now);
      graph.amp.gain.setTargetAtTime(0, now, RELEASE);
    },
    /** Opens a note at `time`. A slid note glides from the one before it and keeps its envelope. */
    noteOn(time: number, pitch: number, accent: boolean, slide: boolean) {
      if (!graph) {
        return;
      }
      const { amp, first, osc, second } = graph;
      const frequency = hertz(ROOT + pitch);
      osc.frequency.cancelScheduledValues(time);
      if (slide) {
        // A ramp starts from the last event before it: the old pitch is set at `time` so the glide begins there.
        osc.frequency.setValueAtTime(lastFrequency, time);
        osc.frequency.exponentialRampToValueAtTime(frequency, time + GLIDE);
        lastFrequency = frequency;
        return;
      }
      osc.frequency.setValueAtTime(frequency, time);
      lastFrequency = frequency;
      // The filter's envelope: it leaps to the peak and falls back over the decay. An accent leaps higher.
      const base = cutoffHertz(settings.cutoff);
      const reach =
        unit(settings.envmod) *
        OCTAVES_OF_ENVELOPE *
        (accent ? 1 + unit(settings.accent) * 0.6 : 1);
      const peak = Math.min(18_000, base * 2 ** reach);
      const decay = decaySeconds(settings.decay) * (accent ? 0.6 : 1);
      for (const filter of [first, second]) {
        filter.frequency.cancelScheduledValues(time);
        filter.frequency.setValueAtTime(peak, time);
        filter.frequency.setTargetAtTime(base, time, decay / 3);
      }
      const level = accent
        ? NOTE_LEVEL + (ACCENT_LEVEL - NOTE_LEVEL) * unit(settings.accent)
        : NOTE_LEVEL;
      amp.gain.cancelScheduledValues(time);
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(level, time + ATTACK);
    },
    /** Closes the note at `time`. */
    noteOff(time: number) {
      if (!graph) {
        return;
      }
      graph.amp.gain.setTargetAtTime(0, time, RELEASE);
    },
    set<K extends keyof Settings>(key: K, value: Settings[K]) {
      settings[key] = value;
      if (!graph) {
        return;
      }
      const now = graph.ctx.currentTime;
      if (key === "wave") {
        graph.osc.type = value === "Saw" ? "sawtooth" : "square";
      }
      if (key === "resonance") {
        graph.first.Q.setTargetAtTime(
          resonanceDecibels(settings.resonance),
          now,
          0.02
        );
      }
    },
  };
}

export type SiriusEngine = ReturnType<typeof createSiriusEngine>;
