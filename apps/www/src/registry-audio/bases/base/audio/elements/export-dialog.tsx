"use client";

import {
  type ComponentProps,
  type ReactNode,
  type SubmitEvent,
  useCallback,
  useId,
} from "react";
import { Button } from "@/registry/bases/base/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/registry/bases/base/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import type { AudioFileFormat } from "@/registry-audio/bases/base/lib/audio-encode";
import type {
  ExportNormalize,
  ExportSettings,
} from "@/registry-audio/bases/base/lib/audio-export";
import { LOUDNESS_TARGETS } from "@/registry-audio/bases/base/lib/loudness";

interface SettingItem {
  label: string;
  value: string;
}

const FORMATS: SettingItem[] = [
  { label: "WAV", value: "wav" },
  { label: "FLAC", value: "flac" },
  { label: "MP3", value: "mp3" },
];

const BIT_DEPTHS: Record<"flac" | "wav", SettingItem[]> = {
  flac: [
    { label: "16-bit", value: "16" },
    { label: "24-bit", value: "24" },
  ],
  wav: [
    { label: "16-bit", value: "16" },
    { label: "24-bit", value: "24" },
    { label: "32-bit float", value: "32" },
  ],
};

const BITRATES: SettingItem[] = [128, 192, 256, 320].map((kbps) => ({
  label: `${kbps} kbps`,
  value: String(kbps),
}));

const NORMALIZE: SettingItem[] = [
  { label: "Off", value: "off" },
  { label: "Peak, 0 dBFS", value: "peak" },
  {
    label: `Streaming, ${LOUDNESS_TARGETS.streaming} LUFS`,
    value: String(LOUDNESS_TARGETS.streaming),
  },
  {
    label: `Podcast, ${LOUDNESS_TARGETS.podcast} LUFS`,
    value: String(LOUDNESS_TARGETS.podcast),
  },
  {
    label: `Broadcast, ${LOUDNESS_TARGETS.broadcast} LUFS`,
    value: String(LOUDNESS_TARGETS.broadcast),
  },
];

const toNormalize = (value: string): ExportNormalize =>
  value === "off" || value === "peak" ? value : Number(value);

/** A label and the select it names, on one row. */
function SettingSelect({
  items,
  label,
  onValueChange,
  value,
}: {
  items: SettingItem[];
  label: string;
  onValueChange: (value: string) => void;
  value: string;
}) {
  const id = useId();
  const change = useCallback(
    (next: string | null) => {
      if (next !== null) {
        onValueChange(next);
      }
    },
    [onValueChange]
  );
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-2">
      <span className="text-muted-foreground text-sm" id={id}>
        {label}
      </span>
      <Select items={items} onValueChange={change} value={value}>
        <SelectTrigger aria-labelledby={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

interface ExportDialogProps
  extends Omit<ComponentProps<typeof Dialog>, "children"> {
  /** Fired by Export with the settings, as the dialog closes: render, then pass the channels to `exportSound` from `@/lib/audio-export`. */
  onExport: (settings: ExportSettings) => void;
  /** Fired with the settings as one of them changes. */
  onSettingsChange: (settings: ExportSettings) => void;
  /** What the export renders, as the reader counts it, such as "Bars 1 to 9". */
  range?: ReactNode;
  /** The settings shown, and what Export sends. */
  settings: ExportSettings;
}

/**
 * The settings of an export: the file's format, its bit depth (WAV, FLAC) or
 * its bitrate (MP3), and its level, left as it is, brought to its peak, or
 * to a loudness target. Controlled: it renders and writes nothing itself.
 */
function ExportDialog({
  onExport,
  onSettingsChange,
  range,
  settings,
  ...props
}: ExportDialogProps) {
  const pickFormat = useCallback(
    (value: string) => {
      const format = value as AudioFileFormat;
      onSettingsChange({
        ...settings,
        // A FLAC holds whole numbers only: a WAV's 32-bit floats become 24 bits.
        bitDepth:
          format === "flac" && settings.bitDepth === 32
            ? 24
            : settings.bitDepth,
        format,
      });
    },
    [onSettingsChange, settings]
  );
  const pickBitDepth = useCallback(
    (value: string) =>
      onSettingsChange({
        ...settings,
        bitDepth: Number(value) as ExportSettings["bitDepth"],
      }),
    [onSettingsChange, settings]
  );
  const pickBitrate = useCallback(
    (value: string) =>
      onSettingsChange({ ...settings, bitrate: Number(value) }),
    [onSettingsChange, settings]
  );
  const pickNormalize = useCallback(
    (value: string) =>
      onSettingsChange({ ...settings, normalize: toNormalize(value) }),
    [onSettingsChange, settings]
  );
  const submit = useCallback(
    (event: SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      onExport(settings);
    },
    [onExport, settings]
  );
  return (
    <Dialog {...props}>
      <DialogContent className="sm:max-w-sm">
        <form className="flex flex-col gap-6" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Export</DialogTitle>
            <DialogDescription>
              {range ?? "Renders the sound to a file."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <SettingSelect
              items={FORMATS}
              label="Format"
              onValueChange={pickFormat}
              value={settings.format}
            />
            {settings.format === "mp3" ? (
              <SettingSelect
                items={BITRATES}
                label="Bitrate"
                onValueChange={pickBitrate}
                value={String(settings.bitrate)}
              />
            ) : (
              <SettingSelect
                items={BIT_DEPTHS[settings.format]}
                label="Bit depth"
                onValueChange={pickBitDepth}
                value={String(settings.bitDepth)}
              />
            )}
            <SettingSelect
              items={NORMALIZE}
              label="Normalize"
              onValueChange={pickNormalize}
              value={String(settings.normalize)}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <DialogClose render={<Button type="submit" />}>Export</DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ExportDialog, type ExportDialogProps };
