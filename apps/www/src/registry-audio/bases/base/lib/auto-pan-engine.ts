import {
  type AutoPanState,
  autoPanSettings,
} from "@/registry-audio/bases/base/lib/auto-pan-device";

const RAMP_SECONDS = 0.03;

export interface AutoPanEngine {
  dispose: () => void;
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  update: (state: AutoPanState) => void;
}

/**
 * An auto pan and tremolo on the Web Audio API for an `AutoPanState`:
 *
 * ```
 * input → tremolo gain → panner → output
 *            ↑ oscillator → depth ┘   (one moves the level, the other the pan)
 * ```
 *
 * One oscillator feeds both; the mode sets which of the two depths is on.
 */
export function createAutoPanEngine(
  ctx: BaseAudioContext,
  initial: AutoPanState
): AutoPanEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const tremolo = ctx.createGain();
  const panner = ctx.createStereoPanner();
  const oscillator = ctx.createOscillator();
  const tremoloDepth = ctx.createGain();
  const panDepth = ctx.createGain();
  panner.pan.value = 0;
  input.connect(tremolo).connect(panner).connect(output);
  oscillator.connect(tremoloDepth).connect(tremolo.gain);
  oscillator.connect(panDepth).connect(panner.pan);

  const set = (
    state: AutoPanState,
    write: (param: AudioParam, value: number) => void
  ) => {
    const settings = autoPanSettings(state);
    write(oscillator.frequency, settings.rate);
    write(tremolo.gain, settings.tremoloBase);
    write(tremoloDepth.gain, settings.tremoloDepth);
    write(panDepth.gain, settings.panDepth);
  };
  oscillator.type = initial.shape;
  set(initial, (param, value) => {
    param.value = value;
  });
  oscillator.start();

  return {
    dispose: () => {
      oscillator.stop();
      for (const node of [
        input,
        tremolo,
        panner,
        oscillator,
        tremoloDepth,
        panDepth,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    update: (state) => {
      oscillator.type = state.shape;
      set(state, (param, value) =>
        param.setTargetAtTime(value, ctx.currentTime, RAMP_SECONDS)
      );
    },
  };
}
