import { unlimitDeficitGain, unlimitGain } from "@audio/dynamics-unlimit";
import { unlimit } from "@audio/dynamics-unlimit/audio";
import { type DeviceState, defineDevice } from "@audio-ui/core/device";
import { UNLIMITER_KERNELS } from "@/registry-audio/bases/base/devices/unlimiter/kernels";
import { manifestWorklet } from "@/registry-audio/bases/base/lib/manifest-worklet";

/**
 * An unlimiter as a device: the de-limiter of `@audio/dynamics-unlimit`, its
 * parameters and the lift it gives an attack by its size, with no panel and
 * no audio in it. It gives back the attacks a limiter flattened, lifting each
 * one by what it is missing.
 */
export const unlimiterDevice = defineDevice({
  description:
    "Gives back the attacks a limiter flattened. It tells an attack by how far a fast follower of the level rises over a slow one, and lifts it by up to the amount. Adaptive, it lifts each attack by what it is missing to reach the crest, so a healthy attack is left alone; otherwise it lifts every attack in proportion to its size, the drive dB for each dB. The ceiling, when on, keeps the lifted peaks under it.",
  id: "audioui.unlimiter",
  name: "Unlimiter",
  parameters: [
    { default: true, id: "enabled", kind: "toggle", label: "On" },
    {
      default: 6,
      id: "amountDb",
      label: "Amount",
      max: 18,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 1,
      id: "drive",
      label: "Drive",
      max: 10,
      min: 0,
      step: 0.1,
    },
    {
      default: 10,
      id: "crestDb",
      label: "Crest",
      max: 25,
      min: 3,
      step: 0.5,
      unit: "dB",
    },
    {
      default: -1,
      id: "ceilingDb",
      label: "Ceiling",
      max: 0,
      min: -12,
      step: 0.1,
      unit: "dB",
    },
    { default: true, id: "adaptive", kind: "toggle", label: "Adaptive" },
    { default: false, id: "guard", kind: "toggle", label: "Guard" },
  ],
});

export type UnlimiterState = DeviceState<typeof unlimiterDevice.parameters>;

/** The controls a state does not use: the crest when it is not adaptive, the ceiling when it does not guard. */
export function unlimiterUnused(state: UnlimiterState) {
  return [
    ...(state.adaptive ? [] : (["crestDb"] as const)),
    ...(state.guard ? [] : (["ceilingDb"] as const)),
  ];
}

/** The numbers that go on the worklet for a state, in the manifest's units: with no guard, the ceiling at the manifest's own default, where no peak reaches. Off, the sound goes round it. */
export function unlimiterSettings(state: UnlimiterState) {
  return {
    modelParams: {
      adaptive: state.adaptive ? 1 : 0,
      amount: state.amountDb,
      ceiling: state.guard
        ? state.ceilingDb
        : (unlimit.params.ceiling.default as number),
      crestTarget: state.crestDb,
      drive: state.drive,
    },
    wet: state.enabled ? 1 : 0,
  };
}

/** The lift a state gives an attack, in dB, by its size: how far the fast follower of the level is over the slow one, in dB. The package's own curves. */
export function unlimiterLift(state: UnlimiterState) {
  if (!state.enabled) {
    return () => 0;
  }
  const { amountDb, crestDb, drive } = state;
  return state.adaptive
    ? (sizeDb: number) => unlimitDeficitGain(sizeDb, crestDb, amountDb, drive)
    : (sizeDb: number) => unlimitGain(sizeDb, 0, amountDb, drive);
}

/**
 * The source of the unlimiter's `AudioWorklet`, processor
 * `audioui-unlimiter`: the manifest of `@audio/dynamics-unlimit`, played by
 * `manifestWorklet`. The amount, the drive, the crest, the ceiling and
 * adaptive change as it plays.
 */
export const UNLIMITER_WORKLET = manifestWorklet({
  kernels: UNLIMITER_KERNELS,
  models: { unlimiter: "unlimit" },
  processor: "audioui-unlimiter",
});
