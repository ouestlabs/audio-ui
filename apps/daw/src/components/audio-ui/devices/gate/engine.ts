import type { SidechainBinding } from "@audio-ui/core/device";
import {
  GATE_HYSTERESIS_WORKLET,
  GATE_WORKLET,
  type GateState,
  gateSettings,
  MAX_LOOKAHEAD_MS,
} from "@/components/audio-ui/devices/gate/device";

const RAMP_SECONDS = 0.01;
/** How long after the hysteresis model fades out its input is taken away, in ms: the fade is over by then. */
const UNFEED_MS = 120;

export interface GateEngine extends SidechainBinding<GateState, AudioNode> {
  /** Connect the signal to process here. */
  readonly input: AudioNode;
  /** Connect this to the destination, or to the next device. */
  readonly output: AudioNode;
  /** Resolves once the detector and the hysteresis model are in the graph. Until then the gate stays open, and the clean model plays for the other. A context with no worklets never resolves it to `true`. */
  readonly ready: Promise<boolean>;
  /** Connect the key here: with `external` on, the gate opens and closes on this signal's level, and what it does to `input` follows. */
  readonly sidechain: AudioNode;
}

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Loads the detector and the hysteresis model into a context once. `false` when the context cannot run worklets. */
function loadDetector(ctx: BaseAudioContext): Promise<boolean> {
  const cached = loaded.get(ctx);
  if (cached) {
    return cached;
  }
  // A page without a secure origin has no worklets.
  if (!("audioWorklet" in ctx && typeof AudioWorkletNode !== "undefined")) {
    return Promise.resolve(false);
  }
  const url = URL.createObjectURL(
    new Blob([GATE_WORKLET, GATE_HYSTERESIS_WORKLET], {
      type: "text/javascript",
    })
  );
  const done = ctx.audioWorklet
    .addModule(url)
    .then(() => true)
    .catch(() => false)
    .finally(() => URL.revokeObjectURL(url));
  loaded.set(ctx, done);
  return done;
}

/**
 * A gate on the Web Audio API for a `GateState`. The browser has no gate node:
 * the clean model's level is measured by an `AudioWorklet` loaded from a blob,
 * which writes the gain to apply, and the hysteresis model is the audio.js
 * gate in a worklet of its own, loaded with it:
 *
 * ```
 * input ─→ own key ──┐
 * sidechain → key ───┴→ detector (threshold, attack, hold, release) → gain's own gain
 * input → look-ahead delay → gain → clean ───────────────────────────┐
 * input → hysteresis model (an AudioWorklet) → model wet ────────────┴→ output
 * ```
 *
 * Only one of the two keys is open: the signal's own, or the sidechain with
 * `external` on, which only the clean model takes. The sidechain is a signal
 * that goes nowhere else, it is only listened to. The detector reads the
 * signal before the delay, so the gate is open by the time a transient has
 * gone through the look-ahead; the hysteresis model looks ahead by as much
 * itself. It is fed only while it plays. Until the worklets are ready the
 * gate stays open, and the clean model plays for the other.
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
  const clean = ctx.createGain();
  const modelWet = ctx.createGain();
  input.connect(ownKey);
  sidechain.connect(outerKey);
  input.connect(delay).connect(gate).connect(clean).connect(output);
  modelWet.connect(output);

  const first = gateSettings(initial);
  ownKey.gain.value = first.ownKey;
  outerKey.gain.value = first.outerKey;
  delay.delayTime.value = first.lookahead;
  modelWet.gain.value = 0;

  let detector: AudioWorkletNode | null = null;
  let model: AudioWorkletNode | null = null;
  let settings = first;
  let latest = initial;
  let disposed = false;
  let fed = false;
  let unfeed: ReturnType<typeof setTimeout> | undefined;

  /** The hysteresis model in place of the clean one while it plays and is loaded, fed only then. */
  const route = () => {
    const modeled = model === null ? 0 : settings.modelWet;
    clean.gain.setTargetAtTime(1 - modeled, ctx.currentTime, RAMP_SECONDS);
    modelWet.gain.setTargetAtTime(modeled, ctx.currentTime, RAMP_SECONDS);
    // As values, not glides: every one makes the model again, which fades it in.
    for (const [name, value] of Object.entries(settings.modelParams)) {
      model?.parameters.get(name)?.setValueAtTime(value, ctx.currentTime);
    }
    clearTimeout(unfeed);
    if (modeled > 0 && !fed && model) {
      input.connect(model);
      fed = true;
    } else if (modeled === 0 && fed) {
      // Once the fade is over: a worklet fed nothing costs nothing.
      unfeed = setTimeout(() => {
        if (fed && model) {
          input.disconnect(model);
          fed = false;
        }
      }, UNFEED_MS);
    }
  };

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
    model = new AudioWorkletNode(ctx, "audioui-gate-hysteresis", {
      outputChannelCount: [2],
      parameterData: settings.modelParams,
      processorOptions: { model: "hysteresis" },
    });
    model.connect(modelWet);
    settings = gateSettings(latest);
    route();
    return true;
  });
  gate.gain.value = 1;

  return {
    dispose: () => {
      disposed = true;
      clearTimeout(unfeed);
      for (const node of [
        input,
        sidechain,
        ownKey,
        outerKey,
        delay,
        gate,
        clean,
        modelWet,
        output,
      ]) {
        node.disconnect();
      }
      detector?.disconnect();
      model?.disconnect();
    },
    input,
    output,
    ready,
    sidechain,
    update: (state) => {
      latest = state;
      settings = gateSettings(state);
      route();
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