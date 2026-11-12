"use client";

import { formatLevel, formatSampleRate } from "@audio-ui/engine/format";
import { type ComponentProps, useCallback, useState } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";

/** The layouts a sound can be mixed to, each with what it is. */
export const LAYOUTS = [
  { channels: 1, id: "mono", note: "One channel, sides summed" },
  { channels: 2, id: "stereo", note: "Left and right" },
  { channels: 6, id: "5.1", note: "Surround with LFE" },
  { channels: 8, id: "7.1", note: "Surround, sides and back" },
] as const;

export type SoundLayout = (typeof LAYOUTS)[number]["id"];

/** The rates a sound can be converted to, each with what it is used for. */
export const RATES = [
  { note: "Telephone, walkie-talkie", rate: 8000 },
  { note: "Low-quality PCM", rate: 11_025 },
  { note: "VoIP, wideband speech", rate: 16_000 },
  { note: "Low-quality MPEG", rate: 22_050 },
  { note: "Audio CD, MP3", rate: 44_100 },
  { note: "Video, professional audio", rate: 48_000 },
  { note: "Pro recording for CD", rate: 88_200 },
  { note: "DVD-Audio, Blu-ray", rate: 96_000 },
  { note: "HDCD, CD production", rate: 176_400 },
  { note: "Pro video, Blu-ray", rate: 192_000 },
  { note: "DXD, SACD editing", rate: 352_800 },
  { note: "Highest in common software", rate: 384_000 },
] as const;

/** The measures of a sound's level, in the order the menu lists them. */
export const LEVELS = [
  { id: "peak", label: "Peak", unit: "dBFS" },
  { id: "rms", label: "RMS", unit: "dBFS" },
  { id: "loudness", label: "Loudness", unit: "LUFS" },
] as const;

export type SoundLevelId = (typeof LEVELS)[number]["id"];

/** What the three level measures read, each in its own unit. */
export type SoundLevels = Record<SoundLevelId, number>;

const TRIGGER =
  "rounded-sm px-1 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted data-popup-open:text-foreground";

/** The row of a sound's facts under its waveform: its parts say its level, its rate and its channels, each a button that opens its menu. */
function SoundReadouts({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 font-mono text-[11px] text-muted-foreground tabular-nums",
        className
      )}
      data-slot="sound-readouts"
      {...props}
    />
  );
}

/** A plain readout in the row, not a menu: the peak beside a level that is. */
function SoundReadout({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("px-1", className)}
      data-slot="sound-readout"
      {...props}
    />
  );
}

/** The level of the sound: one measure shown, the others one click away, each with its value. Uncontrolled, it starts on `defaultMeasure`; give `measure` and `onMeasureChange` to hold it yourself. */
function SoundLevel({
  defaultMeasure = "loudness",
  levels,
  measure,
  onMeasureChange,
}: {
  defaultMeasure?: SoundLevelId;
  levels: SoundLevels;
  measure?: SoundLevelId;
  onMeasureChange?: (measure: SoundLevelId) => void;
}) {
  const [own, setOwn] = useState<SoundLevelId>(defaultMeasure);
  const shown = measure ?? own;
  const current = LEVELS.find((level) => level.id === shown) ?? LEVELS[2];
  const choose = useCallback(
    (value: string) => {
      setOwn(value as SoundLevelId);
      onMeasureChange?.(value as SoundLevelId);
    },
    [onMeasureChange]
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Level measure"
        className={TRIGGER}
        data-slot="sound-level"
        title="Level measure"
      >
        {formatLevel(levels[current.id], current.unit)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" side="top">
        <DropdownMenuRadioGroup onValueChange={choose} value={shown}>
          {LEVELS.map((level) => (
            <DropdownMenuRadioItem key={level.id} value={level.id}>
              <span className="whitespace-nowrap">{level.label}</span>
              <DropdownMenuShortcut className="tracking-normal">
                {formatLevel(levels[level.id], level.unit)}
              </DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The sample rate of the sound, and the menu of the rates to resample it to. */
function SoundRate({
  onResample,
  sampleRate,
}: {
  onResample: (rate: number) => void;
  sampleRate: number;
}) {
  const choose = useCallback(
    (value: string) => onResample(Number(value)),
    [onResample]
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Sample rate"
        className={TRIGGER}
        data-slot="sound-rate"
        title="Resample"
      >
        {formatSampleRate(sampleRate)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Resample to</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup
          onValueChange={choose}
          value={String(sampleRate)}
        >
          {RATES.map((each) => (
            <DropdownMenuRadioItem key={each.rate} value={String(each.rate)}>
              <span className="whitespace-nowrap">
                {formatSampleRate(each.rate)}
              </span>
              <DropdownMenuShortcut className="tracking-normal">
                {each.note}
              </DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The channels of the sound, and the menu of the layouts to mix it to. */
function SoundChannels({
  channels,
  onMix,
}: {
  channels: number;
  onMix: (layout: SoundLayout) => void;
}) {
  const choose = useCallback(
    (value: string) => onMix(value as SoundLayout),
    [onMix]
  );
  const current = LAYOUTS.find((layout) => layout.channels === channels);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Channels"
        className={TRIGGER}
        data-slot="sound-channels"
        title="Mix to"
      >
        {current?.id ?? `${channels} channels`}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72" side="top">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mix to</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup
          onValueChange={choose}
          value={current?.id ?? ""}
        >
          {LAYOUTS.map((layout) => (
            <DropdownMenuRadioItem key={layout.id} value={layout.id}>
              <span className="whitespace-nowrap">{layout.id}</span>
              <DropdownMenuShortcut className="tracking-normal">
                {layout.note}
              </DropdownMenuShortcut>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { SoundChannels, SoundLevel, SoundRate, SoundReadout, SoundReadouts };
