import type { SidechainBinding } from "@audio-ui/core/device";
import {
  GATE_WORKLET,
  type GateState,
  gateSettings,
  MAX_LOOKAHEAD_MS,
} from "@/registry-audio/bases/base/lib/gate-device";

const RAMP_SECONDS = 0.01;

export interface GateEngine extends SidechainBinding<GateState, AudioNode> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the detector is in the graph. Until then the gate stays open. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** Connect the key here: with `external` on, the gate opens and closes on this signal's level, and what it does to `input` follows. */
  readonly sidechain: AudioNode;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the detector into a context once. `false` when the context cannot run worklets. */
function loadDetector(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  const worklet = (ctx as { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!(worklet && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([GATE_WORKLET], { type: "text/javascript" })
  );
  const done = worklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A gate on the Web Audio API for a `GateState`. The browser has no gate node,
 * so the level is measured by an `AudioWorklet` loaded from a blob, which
 * writes the gain to apply:
 *
 * ```
 * input ─→ own key ──┐
 * sidechain → key ───┴→ detector (threshold, attack, hold, release) → gain's own gain
 * input → look-ahead delay → gain ───────────────────────────────────→ output
 * ```
 *
 * Only one of the two keys is open: the signal's own, or the sidechain with
 * `external` on. The sidechain is a signal that goes nowhere else, it is only
 * listened to. The detector reads the signal before the delay, so the gate is
 * open by the time a transient has gone through the look-ahead. Until the
 * detector is ready the gate stays open.
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
  const delay = ctx.createDelay(MAX_LOOKAHEAD_MS / 1000);
  const gate = ctx.createGain();
  input.connect(ownKey);
  sidechain.connect(outerKey);
  input.connect(delay).connect(gate).connect(output);

  const first = gateSettings(initial);
  ownKey.gain.value = first.ownKey;
  outerKey.gain.value = first.outerKey;
  delay.delayTime.value = first.lookahead;

  let detector: AudioWorkletNode | null = null;
  let settings = first;
  let disposed = false;
  const ready = loadDetector(ctx).then((ok) => {
    if (!ok || disposed) {
      return false;
    }
    detector = new AudioWorkletNode(ctx, "audioui-gate", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    for (const name of [
      "attack",
      "floor",
      "hold",
      "release",
      "threshold",
    ] as const) {
      detector.parameters.get(name)?.setValueAtTime(settings[name], 0);
    }
    ownKey.connect(detector);
    outerKey.connect(detector);
    gate.gain.value = 0;
    detector.connect(gate.gain);
    return true;
  });
  gate.gain.value = 1;

  return {
    dispose: () => {
      disposed = true;
      for (const node of [
        input,
        sidechain,
        ownKey,
        outerKey,
        delay,
        gate,
        output,
      ]) {
        node.disconnect();
      }
      detector?.disconnect();
    },
    input,
    output,
    ready,
    sidechain,
    update: (state) => {
      settings = gateSettings(state);
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
      delay.delayTime.setTargetAtTime(
        settings.lookahead,
        ctx.currentTime,
        RAMP_SECONDS
      );
      for (const name of [
        "attack",
        "floor",
        "hold",
        "release",
        "threshold",
      ] as const) {
        detector?.parameters
          .get(name)
          ?.setValueAtTime(settings[name], ctx.currentTime);
      }
    },
  };
}
