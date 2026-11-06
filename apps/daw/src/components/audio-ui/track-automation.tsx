"use client";

import type { Device, ParameterDescriptor } from "@audio-ui/core/device";
import type { Breakpoint } from "@audio-ui/core/envelope";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AutomationEnvelope } from "@/components/audio-ui/automation-envelope";
import {
  type ArrangementTrack,
  type AutomatedParameter,
  type DeviceParameterKey,
  deviceParameterKey,
  flatAutomation,
  MACRO_COUNT,
  type Mix,
  panPosition,
  type TrackDevice,
  volumeGain,
  volumeValue,
} from "@/lib/arrangement";
import { TrashIcon } from "@phosphor-icons/react";

/** A gain as the decibels it plays at. */
function formatGain(gain: number) {
  if (gain <= 0) {
    return "-inf dB";
  }
  const db = 20 * Math.log10(gain);
  return `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

/** What each of a track's own parameters is called, how its envelope's values read, and where it stands in the mix. */
const PARAMETERS: Record<
  "pan" | "volume",
  { format: (y: number) => string; label: string; ofMix: (mix: Mix) => number }
> = {
  pan: {
    format: (y) => {
      const pan = Math.round(panPosition(y) * 100);
      if (pan === 0) {
        return "C";
      }
      return `${pan < 0 ? "L" : "R"}${Math.abs(pan)}`;
    },
    label: "Pan",
    ofMix: (mix) => (mix.pan + 1) / 2,
  },
  volume: {
    format: (y) => formatGain(volumeGain(y)),
    label: "Volume",
    ofMix: (mix) => volumeValue(mix.gain),
  },
};

/** A track's own parameters it automates, in the chooser's order. */
export const AUTOMATED_PARAMETERS = ["volume", "pan"] as const;

/** A parameter of one of a track's devices that an envelope can move: its key, the device it is on, its name, how a value reads, and where it stands now, 0 to 1 of its travel. */
export interface AutomationTarget {
  format: (y: number) => string;
  /** The device's name, which the chooser groups its parameters under. */
  group: string;
  key: DeviceParameterKey;
  label: string;
  standing: number;
}

/** A device as the chooser reads it: its name, its parameters, and how a value of one reads and where it sits on its travel. */
type DescribedDevice = Pick<
  Device<readonly ParameterDescriptor[]>,
  "denormalize" | "format" | "name" | "normalize" | "parameters"
>;

const percent = (y: number) => `${Math.round(y * 100)} %`;

/**
 * What a track's devices let an envelope move, device by device, down the
 * racks within: every parameter of a device `find` knows, and a rack's eight
 * macros, named as the rack is (`rackName`).
 */
export function deviceTargets(
  devices: readonly TrackDevice[],
  find: (id: string) => { device: DescribedDevice } | undefined,
  rackName: (device: TrackDevice) => string = () => "Rack"
): AutomationTarget[] {
  return devices.flatMap((device): AutomationTarget[] => {
    if (device.rack) {
      const macros = Array.from({ length: MACRO_COUNT }, (_, index) => ({
        format: percent,
        group: rackName(device),
        key: deviceParameterKey(device.id, `macro-${index + 1}`),
        label: device.rack?.macros[index]?.name ?? `Macro ${index + 1}`,
        standing: device.rack?.macros[index]?.value ?? 0,
      }));
      return [
        ...macros,
        ...device.rack.chains.flatMap((chain) =>
          deviceTargets(chain.devices, find, rackName)
        ),
      ];
    }
    const entry = find(device.device)?.device;
    if (!entry) {
      return [];
    }
    return entry.parameters.map((parameter) => ({
      format: (y: number) =>
        entry.format(parameter.id, entry.denormalize(parameter.id, y)),
      group: entry.name,
      key: deviceParameterKey(device.id, parameter.id),
      label: parameter.label,
      standing: entry.normalize(
        parameter.id,
        device.state[parameter.id] ?? parameter.default
      ),
    }));
  });
}

/** What the chooser and the envelope need of a parameter: its name, how it reads, and where it stands without an envelope. */
function describeTarget(
  parameter: AutomatedParameter,
  targets: readonly AutomationTarget[],
  mix: Mix
): { format: (y: number) => string; label: string; standing: number } {
  if (parameter === "pan" || parameter === "volume") {
    const own = PARAMETERS[parameter];
    return { format: own.format, label: own.label, standing: own.ofMix(mix) };
  }
  const target = targets.find((item) => item.key === parameter);
  return target
    ? {
        format: target.format,
        label: labelOf(parameter, targets),
        standing: target.standing,
      }
    : { format: percent, label: labelOf(parameter, targets), standing: 0 };
}

/** A parameter's name: the track's own, or a device's with the device's. */
function labelOf(
  parameter: AutomatedParameter,
  targets: readonly AutomationTarget[]
): string {
  if (parameter === "pan" || parameter === "volume") {
    return PARAMETERS[parameter].label;
  }
  const target = targets.find((item) => item.key === parameter);
  return target ? `${target.group} ${target.label}` : "Parameter";
}

/** The chooser's entries: the track's own volume and pan, then its devices' parameters, device by device. */
function chooserGroups(targets: readonly AutomationTarget[], output: boolean) {
  const groups = new Map<string, { label: string; value: string }[]>();
  for (const target of targets) {
    const items = groups.get(target.group) ?? [];
    items.push({ label: target.label, value: target.key });
    groups.set(target.group, items);
  }
  return [
    ...(output
      ? [
          {
            items: AUTOMATED_PARAMETERS.map((value) => ({
              label: PARAMETERS[value].label,
              value: value as string,
            })),
            label: "",
          },
        ]
      : []),
    ...[...groups].map(([label, items]) => ({ items, label })),
  ];
}

/** In a track's header: which parameter its lane shows, a dot on the ones automated, and a button that clears that envelope. */
function TrackAutomationChooser({
  onClear,
  onParameterChange,
  output = true,
  parameter,
  targets = [],
  track,
}: {
  onClear: (trackId: string, parameter: AutomatedParameter) => void;
  onParameterChange: (trackId: string, parameter: AutomatedParameter) => void;
  /** Whether the track has an output. One without, such as a MIDI track with no instrument, has no volume or pan to automate, and the chooser lists only its devices' parameters. Defaults to `true`. */
  output?: boolean;
  parameter: AutomatedParameter;
  /** The parameters of the track's devices it can automate besides its volume and pan, as `deviceTargets` gives them. */
  targets?: readonly AutomationTarget[];
  track: ArrangementTrack;
}) {
  const { automation, id: trackId, name } = track;
  const groups = useMemo(() => chooserGroups(targets, output), [targets, output]);
  const items = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const change = useCallback(
    (next: string | null) =>
      onParameterChange(trackId, (next ?? "volume") as AutomatedParameter),
    [onParameterChange, trackId]
  );
  const clear = useCallback(
    () => onClear(trackId, parameter),
    [onClear, parameter, trackId]
  );
  const label = labelOf(parameter, targets);
  return (
    <div
      className="flex h-7 items-center gap-1 pe-1"
      data-slot="track-automation-chooser"
    >
      <Select items={items} onValueChange={change} value={parameter}>
        <SelectTrigger
          aria-label={`${name} automation`}
          className="min-w-0 flex-1"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.label || "track"}>
              {group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                  {automation?.[item.value as AutomatedParameter] ? (
                    <span
                      aria-label="automated"
                      className="size-1.5 self-center rounded-full bg-primary"
                      role="img"
                    />
                  ) : null}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <Button
        aria-label={`Clear the ${label.toLowerCase()} envelope of ${name}`}
        disabled={!automation?.[parameter]}
        onClick={clear}
        size="icon-xs"
        variant="ghost"
      >
        <TrashIcon
        />
      </Button>
    </div>
  );
}

/**
 * A track's envelope for one parameter, over its lane. Until the track has
 * one, the line stands flat at the mix's value, faint, and the first edit
 * draws it; a parameter moved by hand since (`overridden`) is greyed, as its
 * mix is what plays.
 */
function TrackAutomation({
  describe,
  duration,
  mix,
  onChange,
  onCommit,
  overridden = [],
  parameter,
  snapStep,
  targets = [],
  track,
}: {
  /** A time of the arrangement in words, such as "Bar 3, beat 2", for each point's value text. */
  describe: (seconds: number) => string;
  duration: number;
  mix: Mix;
  onChange: (
    trackId: string,
    parameter: AutomatedParameter,
    points: readonly Breakpoint[]
  ) => void;
  onCommit: () => void;
  /** The track's parameters moved by hand since they were automated. */
  overridden?: readonly AutomatedParameter[];
  parameter: AutomatedParameter;
  /** The grid a point snaps to in time, in the arrangement's units. 0 is free. */
  snapStep: number;
  /** The parameters of the track's devices, for an envelope of one of them: how it reads and where it stands. */
  targets?: readonly AutomationTarget[];
  track: ArrangementTrack;
}) {
  const { id: trackId, name: trackName } = track;
  const points = track.automation?.[parameter];
  const { format, label, standing } = describeTarget(parameter, targets, mix);
  const value = useMemo(
    () => (points ? [...points] : flatAutomation(standing)),
    [points, standing]
  );
  const change = useCallback(
    (next: Breakpoint[]) => onChange(trackId, parameter, next),
    [onChange, parameter, trackId]
  );
  const formatValue = useCallback(
    (point: { x: number; y: number }) =>
      `${describe(point.x * duration)}, ${format(point.y)}`,
    [describe, duration, format]
  );
  return (
    <AutomationEnvelope
      aria-label={`${trackName} ${label.toLowerCase()} automation`}
      className={cn(
        !points && "opacity-50",
        overridden.includes(parameter) && "opacity-50 grayscale"
      )}
      duration={duration}
      formatValue={formatValue}
      onValueChange={change}
      onValueCommitted={onCommit}
      snap={{ x: snapStep / duration, y: 0 }}
      value={value}
    />
  );
}

export { TrackAutomation, TrackAutomationChooser };