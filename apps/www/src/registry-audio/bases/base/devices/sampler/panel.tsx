"use client";

import { midiToHz } from "@audio/note";
import type { Pad as PadPrimitive } from "@audio-ui/react";
import { type ReactNode, useCallback, useMemo } from "react";
import { cn } from "@/registry/bases/base/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import { Pad, PadItem } from "@/registry-audio/bases/base/audio/elements/pad";
import {
  DeviceFrame,
  DeviceHeader,
  DevicePanel,
} from "@/registry-audio/bases/base/audio/panels/device-panel";
import {
  SAMPLER_FIRST_NOTE,
  SAMPLER_SLICES,
  type SamplerNote,
  type SamplerState,
  samplerDevice,
  sliceOf,
} from "@/registry-audio/bases/base/devices/sampler/device";

/** What the title bar holds: the sample, a list. */
const HEADER_CONTROLS = ["sample"] as const;
const SAMPLE = samplerDevice.parameters.find(
  (parameter) => parameter.id === "sample"
) as Extract<(typeof samplerDevice.parameters)[number], { id: "sample" }>;

const PADS = Array.from({ length: SAMPLER_SLICES }, (_, slice) => ({
  label: String(slice + 1),
  value: String(slice),
}));

interface SamplerPanelProps {
  /** The notes held now, such as on a MIDI keyboard: the pads of their slices light up as they are played. */
  activeNotes?: readonly number[];
  /** Whatever the host puts at the end of the title bar: a device chain's grip, fold and remove buttons. */
  children?: ReactNode;
  className?: string;
  /** The pad struck is let go. */
  onNoteOff?: () => void;
  /** A pad is struck, as the note of its slice. */
  onNoteOn?: (note: SamplerNote) => void;
  onValueChange: (state: SamplerState) => void;
  value: SamplerState;
}

/**
 * The face of the Sampler device: the sample it plays in its title bar, its
 * controls, and sixteen pads, one a slice, that play it. Controlled like
 * `DevicePanel`: the state is `value`, and a pad leaves through `onNoteOn`
 * and `onNoteOff` as the note of its slice, so it plays through whatever
 * engine a host gives it.
 */
function SamplerPanel({
  activeNotes,
  children,
  className,
  onNoteOff,
  onNoteOn,
  onValueChange,
  value,
}: SamplerPanelProps) {
  const pickSample = useCallback(
    (sample: string | null) => {
      if (sample) {
        onValueChange(samplerDevice.set(value, "sample", sample));
      }
    },
    [onValueChange, value]
  );
  const strike = useCallback(
    (slice: string, details: PadPrimitive.Root.OnEventDetails) =>
      onNoteOn?.({
        frequency: midiToHz(SAMPLER_FIRST_NOTE + Number(slice)),
        velocity: details.velocity,
      }),
    [onNoteOn]
  );
  const release = useCallback(() => onNoteOff?.(), [onNoteOff]);
  const lit = useMemo(
    () => (activeNotes ?? []).map((pitch) => String(sliceOf(pitch))),
    [activeNotes]
  );

  return (
    <DeviceFrame className={cn("h-full", className)}>
      <DeviceHeader
        device={samplerDevice}
        onValueChange={onValueChange}
        value={value}
      >
        <Select
          items={SAMPLE.options}
          onValueChange={pickSample}
          value={value.sample}
        >
          <SelectTrigger
            aria-label={SAMPLE.label}
            className="w-32 data-[size=sm]:h-6"
            size="sm"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SAMPLE.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {children}
      </DeviceHeader>
      <div
        className="flex min-h-0 grow flex-col gap-2 p-2"
        data-slot="sampler-panel"
      >
        <DevicePanel
          device={samplerDevice}
          exclude={HEADER_CONTROLS}
          onValueChange={onValueChange}
          value={value}
        />
        <Pad
          activePads={lit}
          aria-label="Slices"
          className="mt-auto min-h-24 flex-1 grid-rows-2"
          columns={8}
          onPadOff={release}
          onPadOn={strike}
        >
          {PADS.map((pad) => (
            <PadItem className="aspect-auto" key={pad.value} value={pad.value}>
              {pad.label}
            </PadItem>
          ))}
        </Pad>
      </div>
    </DeviceFrame>
  );
}

export { SamplerPanel };
