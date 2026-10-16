"use client";

import type {
  Device,
  DeviceState,
  NumberParameter,
  ParameterDescriptor,
  ToggleParameter,
} from "@audio-ui/core/device";
import { useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

type AnyDevice = Device<readonly ParameterDescriptor[]>;
type AnyState = Record<string, number | boolean>;

interface ControlProps<Parameter> {
  device: AnyDevice;
  /** Called with the whole new state. */
  onValueChange: (state: AnyState) => void;
  parameter: Parameter;
  value: AnyState;
}

function NumberControl({
  device,
  onValueChange,
  parameter,
  value,
}: ControlProps<NumberParameter>) {
  const current = value[parameter.id];
  const format = useCallback(
    (next: number) => device.format(parameter.id, next),
    [device, parameter.id]
  );
  const change = useCallback(
    (next: number) =>
      onValueChange(device.set(value as never, parameter.id, next) as AnyState),
    [device, onValueChange, parameter.id, value]
  );
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        {parameter.label}
      </span>
      <Knob
        anchor={parameter.anchor}
        aria-label={parameter.label}
        defaultValue={parameter.default}
        formatValue={format}
        max={parameter.max}
        min={parameter.min}
        onValueChange={change}
        scale={parameter.scale}
        size="sm"
        step={parameter.step}
        value={typeof current === "number" ? current : parameter.default}
        valueLabel="always"
      />
    </div>
  );
}

function ToggleControl({
  device,
  onValueChange,
  parameter,
  value,
}: ControlProps<ToggleParameter>) {
  const on = value[parameter.id] === true;
  const change = useCallback(
    (pressed: boolean) =>
      onValueChange(
        device.set(value as never, parameter.id, pressed) as AnyState
      ),
    [device, onValueChange, parameter.id, value]
  );
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Toggle
        aria-label={parameter.label}
        onPressedChange={change}
        pressed={on}
        size="sm"
        variant="outline"
      >
        {device.format(parameter.id, on)}
      </Toggle>
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        {parameter.label}
      </span>
    </div>
  );
}

interface DevicePanelProps<Parameters extends readonly ParameterDescriptor[]> {
  className?: string;
  device: Device<Parameters>;
  /** Parameter ids left out, such as the ones a custom face draws itself. */
  exclude?: readonly Parameters[number]["id"][];
  /** Called with the whole new state: store it, and drive the engine from it. */
  onValueChange: (state: DeviceState<Parameters>) => void;
  /** The state of the device. The panel keeps none: it draws this. */
  value: DeviceState<Parameters>;
}

/**
 * A panel for any device: a knob per number and a toggle per switch, from its
 * descriptors, so a device someone defines is usable the day it is defined.
 * Ranges, steps, scales and readouts come from the device, and every change
 * goes back through `device.set`, so a value is always inside its bounds.
 * Controlled: it holds no state, a host owns it.
 */
function DevicePanel<const Parameters extends readonly ParameterDescriptor[]>({
  className,
  device,
  exclude = [],
  onValueChange,
  value,
}: DevicePanelProps<Parameters>) {
  const props = {
    device: device as unknown as AnyDevice,
    onValueChange: onValueChange as unknown as (state: AnyState) => void,
    value: value as unknown as AnyState,
  };
  return (
    <div
      aria-label={device.name}
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] items-start justify-items-center gap-x-3 gap-y-4",
        className
      )}
      data-slot="device-panel"
      role="group"
    >
      {device.parameters
        .filter((parameter) => !exclude.includes(parameter.id as never))
        .map((parameter) =>
          parameter.kind === "toggle" ? (
            <ToggleControl
              {...props}
              key={parameter.id}
              parameter={parameter}
            />
          ) : (
            <NumberControl
              {...props}
              key={parameter.id}
              parameter={parameter}
            />
          )
        )}
    </div>
  );
}

export { DevicePanel };
