"use client";

import type { Breakpoint } from "@audio-ui/core/envelope";
import { useCallback, useMemo } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { AutomationEnvelope } from "@/registry-audio/bases/base/audio/elements/automation-envelope";
import {
  type ArrangementTrack,
  type AutomatedParameter,
  flatAutomation,
  type Mix,
  panPosition,
  volumeGain,
  volumeValue,
} from "@/registry-audio/bases/base/lib/arrangement";

/** A gain as the decibels it plays at. */
function formatGain(gain: number) {
  if (gain <= 0) {
    return "-inf dB";
  }
  const db = 20 * Math.log10(gain);
  return `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
}

/** What each parameter a track automates is called, how its envelope's values read, and where it stands in the mix. */
const PARAMETERS: Record<
  AutomatedParameter,
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

/** The parameters a track automates, in the chooser's order. */
export const AUTOMATED_PARAMETERS = ["volume", "pan"] as const;

const PARAMETER_ITEMS = AUTOMATED_PARAMETERS.map((value) => ({
  label: PARAMETERS[value].label,
  value,
}));

/** In a track's header: which parameter its lane shows, a dot on the ones automated, and a button that clears that envelope. */
function TrackAutomationChooser({
  onClear,
  onParameterChange,
  parameter,
  track,
}: {
  onClear: (trackId: string, parameter: AutomatedParameter) => void;
  onParameterChange: (trackId: string, parameter: AutomatedParameter) => void;
  parameter: AutomatedParameter;
  track: ArrangementTrack;
}) {
  const { automation, id: trackId, name } = track;
  const change = useCallback(
    (next: string | null) =>
      onParameterChange(trackId, next === "pan" ? "pan" : "volume"),
    [onParameterChange, trackId]
  );
  const clear = useCallback(
    () => onClear(trackId, parameter),
    [onClear, parameter, trackId]
  );
  const { label } = PARAMETERS[parameter];
  return (
    <div
      className="flex h-7 items-center gap-1 pe-1"
      data-slot="track-automation-chooser"
    >
      <Select items={PARAMETER_ITEMS} onValueChange={change} value={parameter}>
        <SelectTrigger
          aria-label={`${name} automation`}
          className="min-w-0 flex-1"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PARAMETER_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
                {automation?.[item.value] ? (
                  <span
                    aria-label="automated"
                    className="size-1.5 self-center rounded-full bg-primary"
                    role="img"
                  />
                ) : null}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        aria-label={`Clear the ${label.toLowerCase()} envelope of ${name}`}
        disabled={!automation?.[parameter]}
        onClick={clear}
        size="icon-xs"
        variant="ghost"
      >
        <IconPlaceholder
          hugeicons="Delete02Icon"
          lucide="Trash2Icon"
          phosphor="TrashIcon"
          remixicon="RiDeleteBinLine"
          tabler="IconTrash"
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
  track: ArrangementTrack;
}) {
  const { id: trackId, name: trackName } = track;
  const points = track.automation?.[parameter];
  const { format, label, ofMix } = PARAMETERS[parameter];
  const standing = ofMix(mix);
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
