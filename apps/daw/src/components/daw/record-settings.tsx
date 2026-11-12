import { useCallback } from "react";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { RECORD_QUANTIZE } from "@/lib/recording";
import type { AudioInput } from "./use-take";

const QUANTIZE_LABELS: Record<number, string> = {
  0: "None",
  0.03125: "1/32",
  0.0625: "1/16",
  0.125: "1/8",
  0.25: "1/4",
};

export interface RecordSettingsProps {
  /** Whether letter keys play notes on the armed MIDI tracks. */
  computerKeys: boolean;
  inputDevice: string;
  inputs: readonly AudioInput[];
  monitorInput: boolean;
  onComputerKeysChange: (on: boolean) => void;
  onInputDeviceChange: (device: string) => void;
  onMonitorInputChange: (on: boolean) => void;
  onOverdubChange: (on: boolean) => void;
  onQuantizeChange: (share: number) => void;
  overdub: boolean;
  /** Record quantization, as a share of a whole note: 0 for none. */
  quantize: number;
}

/** The DAW's own items of Record's menu: MIDI overdub and quantization, the audio input and monitoring, and the computer's keyboard (REC-002, REC-003, REC-009). */
export function RecordSettings({
  computerKeys,
  inputDevice,
  inputs,
  monitorInput,
  onComputerKeysChange,
  onInputDeviceChange,
  onMonitorInputChange,
  onOverdubChange,
  onQuantizeChange,
  overdub,
  quantize,
}: RecordSettingsProps) {
  const pickQuantize = useCallback(
    (value: string) => onQuantizeChange(Number(value)),
    [onQuantizeChange]
  );
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>MIDI</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={overdub}
          onCheckedChange={onOverdubChange}
        >
          Overdub
        </DropdownMenuCheckboxItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Quantize
            <span className="ms-auto ps-4 text-muted-foreground">
              {QUANTIZE_LABELS[quantize]}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-auto">
            <DropdownMenuRadioGroup
              onValueChange={pickQuantize}
              value={String(quantize)}
            >
              {RECORD_QUANTIZE.map((share) => (
                <DropdownMenuRadioItem key={share} value={String(share)}>
                  {QUANTIZE_LABELS[share]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuCheckboxItem
          checked={computerKeys}
          onCheckedChange={onComputerKeysChange}
        >
          Computer keyboard
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Audio</DropdownMenuLabel>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Input</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-auto">
            <DropdownMenuRadioGroup
              onValueChange={onInputDeviceChange}
              value={inputDevice}
            >
              <DropdownMenuRadioItem value="">Default</DropdownMenuRadioItem>
              {inputs
                .filter((input) => input.id !== "default")
                .map((input) => (
                  <DropdownMenuRadioItem key={input.id} value={input.id}>
                    {input.label}
                  </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuCheckboxItem
          checked={monitorInput}
          onCheckedChange={onMonitorInputChange}
        >
          Monitor input (headphones)
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>
    </>
  );
}
