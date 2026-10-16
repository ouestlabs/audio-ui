import type { SidechainBinding } from "@audio-ui/core/device";
import {
  type GateState,
  gateSettings,
  gateTable,
} from "@/registry-audio/bases/base/lib/gate-device";

const RAMP_SECONDS = 0.01;

export interface GateEngine extends SidechainBinding<GateState, AudioNode> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Connect the key here: with `external` on, the gate opens and closes on this signal's level, and what it does to `input` follows. */
  readonly sidechain: AudioNode;
}

/**
 * A gate on the Web Audio API for a `GateState`. The browser has no gate node,
 * so the level is measured with the ones it has:
 *
 * ```
 * input ─→ own key ──┐
 * sidechain → key ───┴→ rectify → low-pass (the response) → step table → gain's own gain
 * input → gain ──────────────────────────────────────────────────────→ output
 * ```
 *
 * Only one of the two keys is open: the signal's own, or the sidechain with
 * `external` on. The sidechain is a signal that goes nowhere else, it is only
 * listened to.
 *
 * The rectified signal, smoothed, is the level; a table turns it into a gain
 * of the floor below the threshold and 1 above. The level it measures is the
 * smoothed rectified signal, so a short response follows the peaks and a long
 * one the average. It opens and closes at the same speed.
 */
export function createGateEngine(
  ctx: BaseAudioContext,
  initial: GateState
): GateEngine {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sidechain = ctx.createGain();
  const ownKey = ctx.createGain();
  const outerKey = ctx.createGain();
  const rectifier = ctx.createWaveShaper();
  const smoothing = ctx.createBiquadFilter();
  const step = ctx.createWaveShaper();
  const gate = ctx.createGain();
  rectifier.curve = new Float32Array([1, 0, 1]);
  smoothing.type = "lowpass";
  gate.gain.value = 0;
  input.connect(ownKey).connect(rectifier);
  sidechain.connect(outerKey).connect(rectifier);
  rectifier.connect(smoothing).connect(step).connect(gate.gain);
  input.connect(gate).connect(output);

  const first = gateSettings(initial);
  smoothing.frequency.value = first.smoothingHz;
  ownKey.gain.value = first.ownKey;
  outerKey.gain.value = first.outerKey;
  step.curve = gateTable(initial);
  let table = { ...initial };

  return {
    dispose: () => {
      for (const node of [
        input,
        sidechain,
        ownKey,
        outerKey,
        rectifier,
        smoothing,
        step,
        gate,
        output,
      ]) {
        node.disconnect();
      }
    },
    input,
    output,
    sidechain,
    update: (state) => {
      const settings = gateSettings(state);
      ownKey.gain.setTargetAtTime(
        settings.ownKey,
        ctx.currentTime,
        RAMP_SECONDS
      );
      outerKey.gain.setTargetAtTime(
        settings.outerKey,
        ctx.currentTime,
        RAMP_SECONDS
      );
      smoothing.frequency.setTargetAtTime(
        settings.smoothingHz,
        ctx.currentTime,
        RAMP_SECONDS
      );
      if (
        table.enabled !== state.enabled ||
        table.floorDb !== state.floorDb ||
        table.thresholdDb !== state.thresholdDb
      ) {
        step.curve = gateTable(state);
        table = { ...state };
      }
    },
  };
}
