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
import { type ReactNode, useCallback } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import {
  FilterTypeSelect,
  isFilterType,
} from "@/registry-audio/bases/base/audio/elements/filter-type-select";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import {
  isWaveform,
  WaveformSelect,
} from "@/registry-audio/bases/base/audio/elements/waveform-select";

type AnyDevice = Device<readonly ParameterDescriptor[]>;
type AnyState = Record<string, ParameterValue>;

interface ControlProps<Parameter> {
  device: AnyDevice;
  /** A parameter that has no effect for now: its knob is drawn off. */
  disabled?: boolean;
  /** The group the control is shown in: a label that starts with its name drops it, since the group already says it. */
  group?: string;
  /** Called with the whole new state. */
  onValueChange: (state: AnyState) => void;
  parameter: Parameter;
  value: AnyState;
}

/** `Low mid gain` under `Low mid` reads `Gain`. */
function withoutGroup(label: string, group?: string) {
  if (!(group && label.startsWith(`${group} `))) {
    return label;
  }
  const rest = label.slice(group.length + 1);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function NumberControl({
  device,
  disabled,
  group,
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
    <div className="flex min-w-0 max-w-full flex-col items-center gap-0.5">
      <span
        aria-hidden="true"
        className="max-w-full truncate text-muted-foreground text-xs"
        title={parameter.label}
      >
        {withoutGroup(parameter.label, group)}
      </span>
      <Knob
        anchor={parameter.anchor}
        aria-label={parameter.label}
        className="mb-5"
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
/** More options than fit as buttons: they go in a list. */
const MAX_BUTTONS = 6;

function ChoiceControl({
  device,
  disabled,
  onValueChange,
  parameter,
  value,
}: ControlProps<ChoiceParameter>) {
  const current = value[parameter.id];
  const pickFromList = useCallback(
    (option: string | null) => {
      if (option) {
        onValueChange(
          device.set(value as never, parameter.id, option) as AnyState
        );
      }
    },
    [device, onValueChange, parameter.id, value]
  );
  const pick = useCallback(
    (option: string) =>
      onValueChange(
        device.set(value as never, parameter.id, option) as AnyState
      ),
    [device, onValueChange, parameter.id, value]
  );
  let control: ReactNode;
  if (parameter.options.every((option) => isWaveform(option.value))) {
    // A choice of waveforms is drawn as the waves, not named.
    control = (
      <WaveformSelect
        aria-label={parameter.label}
        className="grid w-auto grid-cols-2 gap-1"
        disabled={disabled}
        onValueChange={pick}
        options={parameter.options}
        value={typeof current === "string" ? current : parameter.default}
      />
    );
  } else if (parameter.options.every((option) => isFilterType(option.value))) {
    // A choice of filter types is drawn as the responses, not named.
    control = (
      <FilterTypeSelect
        aria-label={parameter.label}
        className="grid w-auto grid-cols-2 gap-1"
        disabled={disabled}
        onValueChange={pickFromList}
        options={parameter.options}
        value={typeof current === "string" ? current : parameter.default}
      />
    );
  } else if (parameter.options.length > MAX_BUTTONS) {
    control = (
      <Select
        disabled={disabled}
        items={parameter.options}
        onValueChange={pickFromList}
        value={typeof current === "string" ? current : parameter.default}
      >
        <SelectTrigger aria-label={parameter.label} className="w-28" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {parameter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  } else {
    control = (
      <div
        aria-label={parameter.label}
        className={cn(
          "justify-center gap-1",
          // Four options in a column are taller than a knob: they sit two by two.
          parameter.options.length > 2 ? "grid grid-cols-2" : "flex flex-wrap"
        )}
        role="group"
      >
        {parameter.options.map((option) => (
          <ChoiceOption
            disabled={disabled}
            key={option.value}
            label={option.label}
            onPick={pick}
            pressed={current === option.value}
            value={option.value}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span aria-hidden="true" className="text-muted-foreground text-xs">
        {parameter.label}
      </span>
      {control}
    </div>
  );
}

interface ChoiceOptionProps {
  disabled?: boolean;
  label: string;
  onPick: (value: string) => void;
  pressed: boolean;
  value: string;
}

function ChoiceOption({
  disabled,
  label,
  onPick,
  pressed,
  value,
}: ChoiceOptionProps) {
  const change = useCallback(() => onPick(value), [onPick, value]);
  return (
    <Toggle
      className="aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      disabled={disabled}
      onPressedChange={change}
      pressed={pressed}
      size="sm"
      variant="outline"
    >
      {label}
    </Toggle>
  );
}

interface DeviceFrameProps {
  children: ReactNode;
  className?: string;
}

/** The frame of a device: a bordered strip with a header over a body, as a device sits in a chain. Its corners follow the style, like the blocks' surface. */
function DeviceFrame({ children, className }: DeviceFrameProps) {
  return (
    <div
      className={cn(
        "cn-audio-device flex w-full min-w-0 flex-col overflow-hidden border bg-card",
        className
      )}
      data-slot="device-frame"
    >
      {children}
    </div>
  );
}

interface DeviceHeaderProps<Parameters extends readonly ParameterDescriptor[]> {
  /** The id of the toggle that turns the device on and off, drawn as the square at the start of the header. */
  activator?: Parameters[number]["id"];
  /** What sits at the end of the header: a play button, a reading, a switch. */
  children?: ReactNode;
  device: Device<Parameters>;
  onValueChange: (state: DeviceState<Parameters>) => void;
  value: DeviceState<Parameters>;
}

function Activator({
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
    // A cell as tall as the buttons at the end, so the square sits the same distance from the top, the bottom and the start of the bar.
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Toggle
        aria-label={parameter.label}
        className="size-4 min-h-0 min-w-0 rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.5625rem))] p-0 aria-pressed:border-primary aria-pressed:bg-primary"
        onPressedChange={change}
        pressed={on}
        size="sm"
        variant="outline"
      />
    </span>
  );
}

/**
 * The title bar of a device: its on and off square, its name, and whatever the
 * face puts at the end. The buttons at the end sit the same distance from the
 * top, the bottom and the right edge of the bar, and the square sits the same
 * distance from the top, the bottom and the left edge.
 */
function DeviceHeader<const Parameters extends readonly ParameterDescriptor[]>({
  activator,
  children,
  device,
  onValueChange,
  value,
}: DeviceHeaderProps<Parameters>) {
  const parameter = device.parameters.find(
    (candidate) => candidate.id === activator
  );
  return (
    <div
      className="flex items-center gap-1 border-b bg-muted/40 p-1"
      data-slot="device-header"
    >
      {parameter?.kind === "toggle" ? (
        <Activator
          device={device as unknown as AnyDevice}
          onValueChange={onValueChange as unknown as (state: AnyState) => void}
          parameter={parameter}
          value={value as unknown as AnyState}
        />
      ) : null}
      <span
        className={`font-medium text-xs ${parameter?.kind === "toggle" ? "" : "ps-1.5"}`}
      >
        {device.name}
      </span>
      {/* The buttons at the end sit 4 px from the frame's corner, so their own corner is the frame's less that and its 1 px border: concentric, whatever the style. */}
      <div className="ms-auto flex items-center gap-2 [&_button]:rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.375rem))]">
        {children}
      </div>
    </div>
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
  /** A name the labels start with, dropped from what is shown: `Low mid gain` under `Low mid` reads `Gain`. */
  labelPrefix?: string;
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
  labelPrefix,
  onValueChange,
  value,
}: DevicePanelProps<Parameters>) {
  const props = {
    device: device as unknown as AnyDevice,
    onValueChange: onValueChange as unknown as (state: AnyState) => void,
    value: value as unknown as AnyState,
  };
  const control = (parameter: ParameterDescriptor, group?: string) => {
    if (parameter.kind === "toggle") {
      return (
        <ToggleControl {...props} key={parameter.id} parameter={parameter} />
      );
    }
    if (parameter.kind === "choice") {
      return (
        <ChoiceControl
          {...props}
          disabled={disabled.includes(parameter.id as never)}
          key={parameter.id}
          parameter={parameter}
        />
      );
    }
    return (
      <NumberControl
        {...props}
        disabled={disabled.includes(parameter.id as never)}
        group={group}
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
          "grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] items-start justify-items-center gap-x-2 gap-y-2",
          className
        )}
        data-slot="device-panel"
        role="group"
      >
        {shown.map((parameter) => control(parameter, labelPrefix))}
      </div>
    );
  }
  const grouped = new Set<string>(groups.flatMap((group) => group.parameters));
  const rest = shown.filter((parameter) => !grouped.has(parameter.id));
  return (
    <div
      aria-label={device.name}
      className={cn("flex flex-wrap items-start gap-x-5 gap-y-2", className)}
      data-slot="device-panel"
      role="group"
    >
      {groups.map((group) => (
        <div
          aria-label={group.label}
          className="flex flex-col gap-1"
          key={group.label}
          role="group"
        >
          <span
            aria-hidden="true"
            className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
          >
            {group.label}
          </span>
          <div className="flex gap-2">
            {shown
              .filter((parameter) =>
                group.parameters.includes(parameter.id as never)
              )
              .map((parameter) => control(parameter, group.label))}
          </div>
        </div>
      ))}
      {rest.length > 0 ? (
        <div className="flex gap-2">
          {rest.map((parameter) => control(parameter))}
        </div>
      ) : null}
    </div>
  );
}

export { DeviceFrame, DeviceHeader, DevicePanel, DeviceToggle };
