"use client";

import { type ReactNode, useCallback } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { Knob } from "@/registry-audio/bases/base/audio/elements/knob";
import type {
  Rack,
  RackChain,
  RackMapping,
} from "@/registry-audio/bases/base/lib/arrangement";

/** A parameter of a device inside the rack that a macro can turn. */
export interface RackParameter {
  device: string;
  /** The device's name, which the menu groups its parameters under. */
  deviceName: string;
  label: string;
  parameter: string;
}

/** A chain's mix, a chain with none at unity. */
export type RackChainMix = NonNullable<RackChain["mix"]>;

/** A rack's eight macros, by the place each has. */
const MACRO_SLOTS = Array.from(
  { length: 8 },
  (_, index) => `macro-${index + 1}`
);

const UNITY: RackChainMix = { gain: 1, muted: false, pan: 0, soloed: false };

const percent = (value: number) => `${Math.round(value * 100)} %`;
const decibels = (gain: number) =>
  gain <= 0 ? "-inf dB" : `${(20 * Math.log10(gain)).toFixed(1)} dB`;

/** Which device each parameter is on, in the order the devices come. */
function byDevice(parameters: readonly RackParameter[]) {
  const devices = new Map<
    string,
    { name: string; parameters: RackParameter[] }
  >();
  for (const parameter of parameters) {
    const device = devices.get(parameter.device) ?? {
      name: parameter.deviceName,
      parameters: [],
    };
    device.parameters.push(parameter);
    devices.set(parameter.device, device);
  }
  return [...devices.entries()];
}

/** An item of a macro's menu: one parameter to map, or one mapping to let go. */
function MacroItem<Value>({
  children,
  index,
  onPick,
  value,
}: {
  children: ReactNode;
  index: number;
  onPick: (index: number, value: Value) => void;
  value: Value;
}) {
  const pick = useCallback(() => onPick(index, value), [index, onPick, value]);
  return <DropdownMenuItem onClick={pick}>{children}</DropdownMenuItem>;
}

function Macro({
  index,
  mappings,
  onChange,
  onCommit,
  onMap,
  onUnmap,
  parameters,
  value,
}: {
  index: number;
  mappings: readonly RackMapping[];
  onChange: (index: number, value: number) => void;
  onCommit?: () => void;
  onMap: (index: number, parameter: RackParameter) => void;
  onUnmap: (index: number, mapping: RackMapping) => void;
  parameters: readonly RackParameter[];
  value: number;
}) {
  const name = `Macro ${index + 1}`;
  const change = useCallback(
    (next: number) => onChange(index, next),
    [index, onChange]
  );
  const labelOf = (mapping: RackMapping) =>
    parameters.find(
      (parameter) =>
        parameter.device === mapping.device &&
        parameter.parameter === mapping.parameter
    );
  return (
    <div className="flex flex-col items-center gap-0.5" data-slot="rack-macro">
      <Knob
        aria-label={name}
        formatValue={percent}
        max={1}
        min={0}
        onValueChange={change}
        onValueCommitted={onCommit}
        size="sm"
        step={0.01}
        value={value}
        valueLabel="hidden"
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              aria-label={`${name}: ${mappings.length} mapped`}
              className={cn(
                "max-w-16 truncate rounded px-1 text-[10px] text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                mappings.length > 0 && "text-foreground"
              )}
              type="button"
            />
          }
        >
          {mappings.length > 0
            ? `${index + 1} · ${mappings.length}`
            : index + 1}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={parameters.length === 0}>
              Map a parameter
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-(--available-height) w-auto overflow-y-auto">
              {byDevice(parameters).map(([device, group]) => (
                <DropdownMenuGroup key={device}>
                  <DropdownMenuLabel>{group.name}</DropdownMenuLabel>
                  {group.parameters.map((parameter) => (
                    <MacroItem
                      index={index}
                      key={parameter.parameter}
                      onPick={onMap}
                      value={parameter}
                    >
                      {parameter.label}
                    </MacroItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {mappings.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Mapped, choose to let go</DropdownMenuLabel>
                {mappings.map((mapping) => {
                  const found = labelOf(mapping);
                  return (
                    <MacroItem
                      index={index}
                      key={`${mapping.device}:${mapping.parameter}`}
                      onPick={onUnmap}
                      value={mapping}
                    >
                      {found
                        ? `${found.deviceName}: ${found.label}`
                        : mapping.parameter}
                    </MacroItem>
                  );
                })}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ChainRow({
  chain,
  onMix,
  onMixCommit,
  onRemove,
  onSelect,
  removable,
  selected,
}: {
  chain: RackChain;
  onMix: (chain: string, mix: Partial<RackChainMix>) => void;
  onMixCommit?: () => void;
  onRemove: (chain: string) => void;
  onSelect: (chain: string) => void;
  removable: boolean;
  selected: boolean;
}) {
  const mix = { ...UNITY, ...chain.mix };
  const { id } = chain;
  const select = useCallback(() => onSelect(id), [id, onSelect]);
  const remove = useCallback(() => onRemove(id), [id, onRemove]);
  const setGain = useCallback(
    (gain: number) => onMix(id, { gain }),
    [id, onMix]
  );
  // A switch is a step of its own.
  const setOn = useCallback(
    (on: boolean) => {
      onMix(id, { muted: !on });
      onMixCommit?.();
    },
    [id, onMix, onMixCommit]
  );
  const setSolo = useCallback(
    (soloed: boolean) => {
      onMix(id, { soloed });
      onMixCommit?.();
    },
    [id, onMix, onMixCommit]
  );
  return (
    <li
      className={cn(
        "flex items-center gap-1 rounded-md px-1 py-0.5",
        selected && "bg-muted"
      )}
      data-slot="rack-chain"
    >
      <button
        aria-pressed={selected}
        className="min-w-0 flex-1 truncate rounded px-1 text-start text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={select}
        type="button"
      >
        {chain.name}
      </button>
      <Knob
        aria-label={`${chain.name} volume`}
        formatValue={decibels}
        max={2}
        min={0}
        onValueChange={setGain}
        onValueCommitted={onMixCommit}
        size="sm"
        step={0.01}
        value={mix.gain}
        valueLabel="hidden"
      />
      <Toggle
        aria-label={`${chain.name} on`}
        onPressedChange={setOn}
        pressed={!mix.muted}
        size="sm"
        variant="outline"
      >
        On
      </Toggle>
      <Toggle
        aria-label={`Solo ${chain.name}`}
        onPressedChange={setSolo}
        pressed={mix.soloed}
        size="sm"
        variant="outline"
      >
        S
      </Toggle>
      <Button
        aria-label={`Remove ${chain.name}`}
        className="text-muted-foreground"
        disabled={!removable}
        onClick={remove}
        size="icon-sm"
        variant="ghost"
      >
        <IconPlaceholder
          aria-hidden="true"
          className="size-4"
          hugeicons="Cancel01Icon"
          lucide="XIcon"
          phosphor="XIcon"
          remixicon="RiCloseLine"
          tabler="IconX"
        />
      </Button>
    </li>
  );
}

/**
 * The face of a rack: its eight macros, each with a menu that maps a
 * parameter of a device inside to it or lets one go; its chains, each with
 * its volume, switch and solo, one of them picked; and the picked chain's
 * devices, which the host draws as `children`. Controlled: every change is a
 * callback, and the knobs report the end of a turn with the commit callbacks.
 */
function RackPanel({
  children,
  className,
  controls,
  enabled = true,
  onEnabledChange,
  title = "Rack",
  onAddChain,
  onChainMix,
  onChainMixCommit,
  onMacroChange,
  onMacroCommit,
  onMapMacro,
  onRemoveChain,
  onSelectChain,
  onUnmapMacro,
  parameters,
  rack,
  selectedChain,
}: {
  /** The picked chain's devices. */
  children?: ReactNode;
  className?: string;
  /** What sits at the end of the title bar: a host's grip, fold and remove buttons. */
  controls?: ReactNode;
  /** Whether the rack is on; with `onEnabledChange`, its square in the title bar. */
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Its name in the title bar. @default "Rack" */
  title?: string;
  onAddChain: () => void;
  onChainMix: (chain: string, mix: Partial<RackChainMix>) => void;
  onChainMixCommit?: () => void;
  onMacroChange: (index: number, value: number) => void;
  onMacroCommit?: () => void;
  onMapMacro: (index: number, parameter: RackParameter) => void;
  onRemoveChain: (chain: string) => void;
  onSelectChain: (chain: string) => void;
  onUnmapMacro: (index: number, mapping: RackMapping) => void;
  /** The parameters of the devices inside that a macro can turn. */
  parameters: readonly RackParameter[];
  rack: Rack;
  selectedChain: string | null;
}) {
  return (
    <div
      className={cn(
        "cn-audio-device flex h-full min-w-0 flex-col overflow-hidden border bg-card",
        className
      )}
      data-slot="rack-panel"
    >
      {/* A device's title bar, as every face has: its square, its name, and the host's controls at the end. */}
      <div
        className="flex items-center gap-1 border-b bg-muted/40 p-1"
        data-slot="device-header"
      >
        {onEnabledChange ? (
          <span className="flex size-6 shrink-0 items-center justify-center">
            <Toggle
              aria-label={`${title} on`}
              className="size-4 min-h-0 min-w-0 rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.5625rem))] p-0 aria-pressed:border-primary aria-pressed:bg-primary"
              onPressedChange={onEnabledChange}
              pressed={enabled}
              size="sm"
              variant="outline"
            />
          </span>
        ) : null}
        <span
          className={cn("font-medium text-xs", !onEnabledChange && "ps-1.5")}
        >
          {title}
        </span>
        <div className="ms-auto flex items-center gap-2 [&_button]:rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.375rem))]">
          {controls}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 p-2">
        <div
          aria-label="Macros"
          className="grid shrink-0 grid-cols-4 content-start gap-x-2 gap-y-1"
          role="group"
        >
          {MACRO_SLOTS.map((slot, index) => (
            <Macro
              index={index}
              key={slot}
              mappings={rack.macros[index]?.mappings ?? []}
              onChange={onMacroChange}
              onCommit={onMacroCommit}
              onMap={onMapMacro}
              onUnmap={onUnmapMacro}
              parameters={parameters}
              value={rack.macros[index]?.value ?? 0}
            />
          ))}
        </div>
        <div className="flex w-72 shrink-0 flex-col gap-1 border-s ps-3">
          <ul aria-label="Chains" className="flex flex-col gap-0.5">
            {rack.chains.map((chain) => (
              <ChainRow
                chain={chain}
                key={chain.id}
                onMix={onChainMix}
                onMixCommit={onChainMixCommit}
                onRemove={onRemoveChain}
                onSelect={onSelectChain}
                removable={rack.chains.length > 1}
                selected={chain.id === selectedChain}
              />
            ))}
          </ul>
          <Button
            className="self-start"
            onClick={onAddChain}
            size="sm"
            variant="ghost"
          >
            <IconPlaceholder
              aria-hidden="true"
              className="size-4"
              hugeicons="PlusSignIcon"
              lucide="PlusIcon"
              phosphor="PlusIcon"
              remixicon="RiAddLine"
              tabler="IconPlus"
            />
            Add a chain
          </Button>
        </div>
        <div className="flex min-w-0 flex-1 border-s ps-3">{children}</div>
      </div>
    </div>
  );
}

export { RackPanel };
