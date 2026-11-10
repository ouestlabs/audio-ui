import { type DeviceState, defineDevice } from "@audio-ui/core/device";

/** Where each of the four stages turns the phase with the lamp dark, in hertz: spread wide, as the circuit's four capacitors are. */
export const VIBE_STAGES = [90, 480, 1900, 5200] as const;
/** How far the lamp at full brightness moves every stage, at the top of the intensity: two octaves and a half. */
const MAX_SWEEP_CENTS = 3000;
/** The lamp never goes fully dark: a bias keeps the filament warm. */
const BIAS = 0.1;
/** How fast a filament heats and cools, as shares of a cycle: it lights at once and fades slowly. */
const HEAT = 0.06;
const COOL = 0.22;

const unit = (value: number) => value / 10;

export const speedHertz = (value: number) => 0.6 * 20 ** unit(value);
export const sweepCents = (value: number) => unit(value) * MAX_SWEEP_CENTS;
/** The output level: unity a little past the middle of the control, +3 dB at its top. */
export const volumeGain = (value: number) => unit(value) ** 2 * 1.4;

/**
 * One cycle of the lamp's light, from 0 (dim) to 1 (bright): the drive is a
 * sine, the filament's power its square over a bias, and the light follows it
 * through a lag that heats fast and cools slowly, run until it repeats.
 */
export function lampCycle(samples = 512): Float32Array {
  const light = new Float32Array(samples);
  let level = 0;
  for (let round = 0; round < 3; round += 1) {
    for (let index = 0; index < samples; index += 1) {
      const drive = (1 + Math.sin((2 * Math.PI * index) / samples)) / 2;
      const power = BIAS + (1 - BIAS) * drive * drive;
      const rate = power > level ? HEAT : COOL;
      level += (power - level) * (1 - Math.exp(-1 / (rate * samples)));
      light[index] = level;
    }
  }
  return light;
}

/**
 * A photocell vibe as a device, with no panel and no audio in it: a lamp that
 * pulses on four light cells, each setting a phase-shift stage far from the
 * others, so the sound sweeps in a lopsided, throbbing way. Chorus mixes the
 * shifted sound with the dry one, vibrato plays it alone and its moving phase
 * is heard as pitch.
 */
export const vibeDevice = defineDevice({
  description:
    "A photocell vibe: a lamp that rises fast and fades slowly sweeps four phase-shift stages spread wide apart, a throb in chorus or a pitch wobble in vibrato, with the speed, the intensity and the level.",
  id: "audioui.vibe",
  name: "Vibe",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: "chorus",
      id: "mode",
      kind: "choice",
      label: "Mode",
      options: [
        { label: "Chorus", value: "chorus" },
        { label: "Vibrato", value: "vibrato" },
      ],
    },
    {
      default: 4,
      format: (value: number) => `${speedHertz(value).toFixed(1)} Hz`,
      id: "speed",
      label: "Speed",
      max: 10,
      min: 0,
      step: 0.1,
    },
    {
      default: 6,
      format: (value: number) => `${Math.round(sweepCents(value) / 100)} st`,
      id: "intensity",
      label: "Intensity",
      max: 10,
      min: 0,
      step: 0.1,
    },
    {
      default: 7,
      format: (value: number) => {
        const gain = volumeGain(value);
        return gain <= 0 ? "-∞ dB" : `${(20 * Math.log10(gain)).toFixed(1)} dB`;
      },
      id: "volume",
      label: "Volume",
      max: 10,
      min: 0,
      step: 0.1,
    },
  ],
});

export type VibeState = DeviceState<typeof vibeDevice.parameters>;

/** How each mode mixes the shifted sound with the dry one, and what passes untouched when the device is off. */
export function vibeMix(state: VibeState) {
  if (!state.enabled) {
    return { bypass: 1, dry: 0, wet: 0 };
  }
  return state.mode === "vibrato"
    ? { bypass: 0, dry: 0, wet: 1 }
    : { bypass: 0, dry: 0.5, wet: 0.5 };
}

const LAMP = lampCycle(256);

/** The lamp's light at `seconds`, from 0 (dim) to 1 (bright), at the speed of a state: what the panel draws. */
export function vibeLight(state: VibeState) {
  const hertz = speedHertz(state.speed);
  return (seconds: number) => {
    const phase = (seconds * hertz) % 1;
    return LAMP[Math.floor(phase * LAMP.length)] ?? 0;
  };
}
