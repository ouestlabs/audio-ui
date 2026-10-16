"use client";

import type {
  ChoiceParameter,
  Device,
  DeviceState,
  NumberParameter,
  ParameterDescriptor,
  ParameterValue,
  ToggleParameter,
} from "@audio-ui/core/device";
import { useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";

type AnyDevice = Device<readonly ParameterDescriptor[]>;
type AnyState = Record<string, ParameterValue>;

interface ControlProps<Parameter> {
  device: AnyDevice;
  /** A parameter that has no effect for now: its knob is drawn off. */
  disabled?: boolean;
  /** Called with the whole new state. */
  onValueChange: (state: AnyState) => void;
  parameter: Parameter;
  value: AnyState;
}

function NumberControl({
  device,
  disabled,
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
        disabled={disabled}
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

/** A switch is one button that carries its own label, filled when it is on. */
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
    <Toggle
      aria-label={parameter.label}
      className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onPressedChange={change}
      pressed={on}
      size="sm"
      variant="outline"
    >
      {parameter.label}
    </Toggle>
  );
}

/** A pick from a short list: one button per option, the picked one filled. */
function ChoiceControl({
  device,
  onValueChange,
  parameter,
  value,
}: ControlProps<ChoiceParameter>) {
  const current = value[parameter.id];
  const pick = useCallback(
    (option: string) =>
      onValueChange(
        device.set(value as never, parameter.id, option) as AnyState
      ),
    [device, onValueChange, parameter.id, value]
  );
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        {parameter.label}
      </span>
      <div
        aria-label={parameter.label}
        className="flex flex-wrap justify-center gap-1"
        role="group"
      >
        {parameter.options.map((option) => (
          <ChoiceOption
            key={option.value}
            label={option.label}
            onPick={pick}
            pressed={current === option.value}
            value={option.value}
          />
        ))}
      </div>
    </div>
  );
}

interface ChoiceOptionProps {
  label: string;
  onPick: (value: string) => void;
  pressed: boolean;
  value: string;
}

function ChoiceOption({ label, onPick, pressed, value }: ChoiceOptionProps) {
  const change = useCallback(() => onPick(value), [onPick, value]);
  return (
    <Toggle
      className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onPressedChange={change}
      pressed={pressed}
      size="sm"
      variant="outline"
    >
      {label}
    </Toggle>
  );
}

interface DeviceToggleProps<Parameters extends readonly ParameterDescriptor[]> {
  device: Device<Parameters>;
  /** The id of a toggle parameter. */
  id: Parameters[number]["id"];
  onValueChange: (state: DeviceState<Parameters>) => void;
  value: DeviceState<Parameters>;
}

/**
 * One switch of a device on its own, for a face that places it where it wants,
 * such as a header: the same button the panel makes for it.
 */
function DeviceToggle<const Parameters extends readonly ParameterDescriptor[]>({
  device,
  id,
  onValueChange,
  value,
}: DeviceToggleProps<Parameters>) {
  const parameter = device.parameters.find((candidate) => candidate.id === id);
  if (parameter?.kind !== "toggle") {
    return null;
  }
  return (
    <ToggleControl
      device={device as unknown as AnyDevice}
      onValueChange={onValueChange as unknown as (state: AnyState) => void}
      parameter={parameter}
      value={value as unknown as AnyState}
    />
  );
}

interface DevicePanelProps<Parameters extends readonly ParameterDescriptor[]> {
  className?: string;
  device: Device<Parameters>;
  /** Parameter ids drawn off, such as a knob a switch makes useless for now. */
  disabled?: readonly Parameters[number]["id"][];
  /** Parameter ids left out, such as the ones a custom face draws itself. */
  exclude?: readonly Parameters[number]["id"][];
  /**
   * Parameters gathered by what they do, each group under its name, in this
   * order: a compressor's curve, its timing, its output. What is in no group
   * follows them.
   */
  groups?: readonly {
    label: string;
    parameters: readonly Parameters[number]["id"][];
  }[];
  /** Called with the whole new state: store it, and drive the engine from it. */
  onValueChange: (state: DeviceState<Parameters>) => void;
  /** The state of the device. The panel keeps none: it draws this. */
  value: DeviceState<Parameters>;
}

/**
 * A panel for any device: a knob per number, a toggle per switch and a row of
 * buttons per choice, from its
 * descriptors, so a device someone defines is usable the day it is defined.
 * Ranges, steps, scales and readouts come from the device, and every change
 * goes back through `device.set`, so a value is always inside its bounds.
 * Controlled: it holds no state, a host owns it.
 */
function DevicePanel<const Parameters extends readonly ParameterDescriptor[]>({
  className,
  device,
  disabled = [],
  exclude = [],
  groups,
  onValueChange,
  value,
}: DevicePanelProps<Parameters>) {
  const props = {
    device: device as unknown as AnyDevice,
    onValueChange: onValueChange as unknown as (state: AnyState) => void,
    value: value as unknown as AnyState,
  };
  const control = (parameter: ParameterDescriptor) => {
    if (parameter.kind === "toggle") {
      return (
        <ToggleControl {...props} key={parameter.id} parameter={parameter} />
      );
    }
    if (parameter.kind === "choice") {
      return (
        <ChoiceControl {...props} key={parameter.id} parameter={parameter} />
      );
    }
    return (
      <NumberControl
        {...props}
        disabled={disabled.includes(parameter.id as never)}
        key={parameter.id}
        parameter={parameter}
      />
    );
  };
  const shown = device.parameters.filter(
    (parameter) => !exclude.includes(parameter.id as never)
  );
  if (!groups) {
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
        {shown.map(control)}
      </div>
    );
  }
  const grouped = new Set<string>(groups.flatMap((group) => group.parameters));
  const rest = shown.filter((parameter) => !grouped.has(parameter.id));
  return (
    <div
      aria-label={device.name}
      className={cn("flex flex-wrap items-start gap-x-8 gap-y-5", className)}
      data-slot="device-panel"
      role="group"
    >
      {groups.map((group) => (
        <div
          aria-label={group.label}
          className="flex flex-col gap-2"
          key={group.label}
          role="group"
        >
          <span
            aria-hidden="true"
            className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
          >
            {group.label}
          </span>
          <div className="flex gap-3">
            {shown
              .filter((parameter) =>
                group.parameters.includes(parameter.id as never)
              )
              .map(control)}
          </div>
        </div>
      ))}
      {rest.length > 0 ? (
        <div className="flex gap-3">{rest.map(control)}</div>
      ) : null}
    </div>
  );
}

export { DevicePanel, DeviceToggle };
