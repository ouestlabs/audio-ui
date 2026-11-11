"use client";

import { midiToHz } from "@audio-ui/engine/pitch";
import { type ReactNode, useCallback, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/registry/bases/base/ui/toggle-group";
import { Fader } from "@/registry-audio/bases/base/audio/elements/fader";
import { Piano } from "@/registry-audio/bases/base/audio/elements/piano";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  MAX_DRAWBAR,
  ORGAN_DRAWBARS,
  ORGAN_PRESETS,
  type OrganDrawbar,
  type OrganNote,
  type OrganState,
  organDevice,
  organPreset,
} from "@/registry-audio/bases/base/devices/organ/device";

/** The controls by what they do, beside the drawbars. */
const GROUPS = [
  { label: "Percussion", parameters: ["percussion", "harmonic", "decay"] },
  { label: "Tone", parameters: ["click", "drive"] },
  { label: "Output", parameters: ["volume"] },
] as const;

/** What the panel draws itself: the drawbars as faders, and the rotary speaker in the title bar. */
const DRAWN = [...ORGAN_DRAWBARS.map((bar) => bar.id), "rotary"] as const;
const ROTARY = organDevice.parameters.find(
  (parameter) => parameter.id === "rotary"
) as Extract<(typeof organDevice.parameters)[number], { id: "rotary" }>;
/** The percussion's harmonic and decay do nothing while it is off. */
const PERCUSSION_OFF = ["harmonic", "decay"] as const;
const NONE = [] as const;

const PRESET_NAMES = ORGAN_PRESETS.map((preset) => ({
  label: preset.name,
  value: preset.name,
}));

/** The keyboard's two octaves, from C3. */
const LOWEST = 48;
const HIGHEST = 72;

interface DrawbarProps {
  footage: string;
  id: OrganDrawbar;
  onChange: (id: OrganDrawbar, level: number) => void;
  value: number;
}

/** A drawbar: a fader from 0 to 8, its footage under it. */
function Drawbar({ footage, id, onChange, value }: DrawbarProps) {
  const change = useCallback(
    (level: number) => onChange(id, level),
    [id, onChange]
  );
  return (
    <div className="flex h-full w-6 flex-col items-center gap-2">
      <Fader
        aria-label={`Drawbar ${footage}`}
        className="min-h-0 flex-1 [--fader-min-height:6rem]"
        max={MAX_DRAWBAR}
        min={0}
        onValueChange={change}
        size="sm"
        step={1}
        thumbMarks={false}
        value={value}
        valueLabel="hidden"
      />
      <span
        aria-hidden="true"
        className="font-mono text-[10px] text-muted-foreground"
      >
        {footage}
      </span>
    </div>
  );
}

interface OrganPanelProps {
  /** The notes held now, such as on a MIDI keyboard: their keys light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The key played is let go. */
  onNoteOff?: () => void;
  /** A key is played, as a note of the organ. */
  onNoteOn?: (note: OrganNote) => void;
  onValueChange: (state: OrganState) => void;
  value: OrganState;
}

/**
 * The face of the Organ device: its six registrations and the rotary speaker
 * in its title bar, its nine drawbars, its percussion, key click, drive and
 * volume, and a keyboard that plays it. Controlled like `DevicePanel`: the
 * state is `value`, and a key leaves through `onNoteOn` and `onNoteOff`, so
 * it plays through whatever engine a host gives it.
 */
function OrganPanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: OrganPanelProps) {
  const [preset, setPreset] = useState<string | null>(null);
  const pickPreset = useCallback(
    (name: string | null) => {
      if (name) {
        setPreset(name);
        onValueChange(organPreset(name));
      }
    },
    [onValueChange]
  );
  // A control moved by hand makes the sound the preset's no more.
  const change = useCallback(
    (state: OrganState) => {
      setPreset(null);
      onValueChange(state);
    },
    [onValueChange]
  );
  const pull = useCallback(
    (id: OrganDrawbar, level: number) =>
      change(organDevice.set(value, id, level)),
    [change, value]
  );
  const pickRotary = useCallback(
    (values: unknown[]) => {
      const [rotary] = values;
      if (typeof rotary === "string") {
        change(organDevice.set(value, "rotary", rotary));
      }
    },
    [change, value]
  );
  const play = useCallback(
    (pitch: number, details: { velocity?: number }) =>
      onNoteOn?.({
        frequency: midiToHz(pitch),
        velocity: details.velocity ?? 0.8,
      }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={organDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select items={PRESET_NAMES} onValueChange={pickPreset} value={preset}>
          <SelectTrigger
            aria-label="Preset"
            className="w-28 data-[size=sm]:h-6"
            size="sm"
          >
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRESET_NAMES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <ToggleGroup
          aria-label="Rotary"
          onValueChange={pickRotary}
          size="sm"
          spacing={0}
          value={[value.rotary]}
          variant="outline"
        >
          {ROTARY.options.map((option) => (
            <ToggleGroupItem
              aria-label={`Rotary ${option.label}`}
              className="h-6 px-2 text-xs"
              key={option.value}
              value={option.value}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="organ-panel"
      >
        <div className="flex min-h-0 gap-5">
          <div
            aria-label="Drawbars"
            className="flex flex-col gap-1"
            role="group"
          >
            <span
              aria-hidden="true"
              className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider"
            >
              Drawbars
            </span>
            <div className="flex min-h-0 flex-1 gap-1 pt-2.5">
              {ORGAN_DRAWBARS.map((bar) => (
                <Drawbar
                  footage={bar.footage}
                  id={bar.id}
                  key={bar.id}
                  onChange={pull}
                  value={value[bar.id]}
                />
              ))}
            </div>
          </div>
          <DevicePanel
            device={organDevice}
            disabled={value.percussion ? NONE : PERCUSSION_OFF}
            exclude={DRAWN}
            groups={GROUPS}
            onValueChange={change}
            value={value}
          />
        </div>
        <Piano
          activeNotes={activeNotes}
          aria-label="Play the organ"
          className="mt-auto min-h-14 flex-1"
          maxPitch={HIGHEST}
          minPitch={LOWEST}
          onNoteOff={release}
          onNoteOn={play}
          size="sm"
        />
      </div>
    </DeviceFrame>
  );
}

export { OrganPanel };
