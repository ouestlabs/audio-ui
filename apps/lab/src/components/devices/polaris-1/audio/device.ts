import { type DeviceState, defineDevice } from "@/lib/engine/device";

/**
 * What Polaris-1 is, as data: its parameters, with their ranges, units and
 * defaults. Nothing else is written twice: the worklet makes an `AudioParam`
 * for each one and hands them to the kernel in this order, and the panel draws
 * a knob for each one.
 */
export const polarisDevice = defineDevice({
  description:
    "A drive compiled to WebAssembly: the sound pushed into a soft clip, a tone after it, mixed with the dry sound.",
  id: "lab.polaris",
  name: "Polaris-1",
  parameters: [
    {
      default: 18,
      id: "drive",
      label: "Drive",
      max: 36,
      min: 0,
      step: 0.5,
      unit: "dB",
    },
    {
      default: 3000,
      id: "tone",
      label: "Tone",
      max: 12_000,
      min: 200,
      scale: "log",
      unit: "Hz",
    },
    {
      default: 100,
      id: "mix",
      label: "Mix",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

export type PolarisState = DeviceState<typeof polarisDevice.parameters>;
export type PolarisParam = keyof PolarisState;
